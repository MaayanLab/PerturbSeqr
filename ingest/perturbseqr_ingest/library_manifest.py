"""Manifest and GMT handling shared by the library CLI. No network or database imports."""
from __future__ import annotations

import csv
import gzip
import hashlib
import json
import re
import uuid
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import quote

SCHEMA_VERSION = 1
BUILD_VERSION = 5
FIELDS = ("perturbation", "cell_line", "cell_type", "timepoint", "concentration")
GENE_FIELDS = (*FIELDS, "perturbation_type", "perturbation_method")
KINDS = {"gmt", "signature_metadata", "drug_metadata", "cell_line_metadata",
         "gene_target_metadata", "full_signatures", "expression_counts", "sample_metadata",
         "compound_metadata", "processing_notes", "validation"}


def digest(path: Path) -> str:
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def json_digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def content_hash(genes) -> str:
    """Keep the established gene-content fingerprint independent of library/signature identity."""
    return str(uuid.uuid5(uuid.UUID(int=0), '\t'.join(sorted(set(genes)))))


def local_path(value: str, base: Path) -> Path:
    path = Path(value).expanduser()
    return path.resolve() if path.is_absolute() else (base / path).resolve()


def s3_location(uri: str) -> tuple[str, str]:
    """S3 references contain the literal object key, with no query or fragment."""
    match = re.fullmatch(r"s3://([a-z0-9][a-z0-9-]{1,61}[a-z0-9])/([^?#\s]+)", uri)
    if not match or any(part in {"", ".", ".."} for part in match[2].split("/")):
        raise ValueError(f"Expected s3://bucket/object-key: {uri}")
    return match[1], match[2]


def public_s3_url(uri: str) -> str:
    bucket, key = s3_location(uri)
    return f"https://{bucket}.s3.amazonaws.com/{quote(key, safe='/')}"


def load_manifest(path: Path) -> dict:
    manifest = json.loads(path.read_text())
    validate_manifest(manifest)
    return manifest


def validate_manifest(m: dict) -> None:
    import jsonschema
    schema = json.loads(Path(__file__).with_name("library-manifest.schema.json").read_text())
    try:
        jsonschema.Draft202012Validator(schema).validate(m)
    except jsonschema.ValidationError as error:
        location = ".".join(map(str, error.absolute_path)) or "manifest"
        raise ValueError(f"{location}: {error.message}") from error
    if not isinstance(m, dict) or m.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError("manifest.schemaVersion must be 1")
    allowed = {"schemaVersion", "slug", "displayName", "category", "resource", "version",
               "description", "input", "sources", "publications", "license", "presentation",
               "processing", "artifacts", "pairing", "distribution", "registration"}
    if unknown := m.keys() - allowed:
        raise ValueError(f"Unknown manifest fields: {sorted(unknown)}")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", m.get("slug", "")):
        raise ValueError("slug must be a lowercase hyphenated identifier")
    for key in ("displayName", "version", "description"):
        if not isinstance(m.get(key), str) or not m[key].strip():
            raise ValueError(f"{key} is required")
    if "," in m["displayName"]:
        raise ValueError("displayName cannot contain commas (legacy enrichment filter transport)")
    if m.get("category") not in {"drug", "gene"}:
        raise ValueError("category must be drug or gene")
    if not isinstance(m.get("resource"), dict) or not m["resource"].get("key"):
        raise ValueError("resource.key is required")
    inp = m.get("input", {})
    if not isinstance(inp.get("gmt"), str) or not inp["gmt"]:
        raise ValueError("input.gmt is required")
    if inp["gmt"].startswith("s3://"):
        s3_location(inp["gmt"])
        if m.get("registration") != "existing" and not inp.get("sha256"):
            raise ValueError("Remote input.gmt requires a SHA-256 checksum")
    if annotations := inp.get("compoundAnnotations"):
        s3_location(annotations["s3"])
        if m["category"] != "drug" or inp.get("compoundMetadata"):
            raise ValueError("compoundAnnotations requires a drug library without a separate compoundMetadata mapping")
    if inp.get("organism") != "human" or inp.get("geneIdentifiers") != "symbol":
        raise ValueError("First-version intake requires human gene symbols; convert upstream explicitly")
    if inp.get("compoundLabels", "names") not in {"names", "names-and-pubchem-cids"}:
        raise ValueError("input.compoundLabels must be names or names-and-pubchem-cids")
    if inp.get("sha256") and not re.fullmatch("[0-9a-f]{64}", inp["sha256"]):
        raise ValueError("input.sha256 must be a lowercase SHA-256 digest")
    preparation = inp.get("preparation")
    if preparation:
        columns = preparation.get("fields")
        required = GENE_FIELDS if m["category"] == "gene" else FIELDS
        if not isinstance(columns, list) or len(set(columns)) != len(columns) or "perturbation" not in columns:
            raise ValueError("input.preparation.fields must declare unique source field names")
        defaults = preparation.get("defaults", {})
        if any(field not in columns and field not in defaults for field in required):
            raise ValueError("Preparation must map/default every canonical field")
        if any(value and not preparation.get("provenance", {}).get(field) for field, value in defaults.items()):
            raise ValueError("Nonempty preparation defaults require field-specific provenance")
    if m.get("pairing", "allow-unpaired") not in {"allow-unpaired", "require-complete"}:
        raise ValueError("pairing must be allow-unpaired or require-complete")
    for link in [*m.get("sources", []), *m.get("publications", [])]:
        if not isinstance(link, dict) or not re.match(r"https?://", link.get("url", "")):
            raise ValueError("sources/publications must contain HTTP(S) URLs")
    distribution = m.get("distribution", {})
    for value in distribution.values():
        if value not in {"public", "restricted"}:
            raise ValueError("distribution values must be public or restricted")
    for artifact in m.get("artifacts", []):
        if artifact.get("kind") not in KINDS:
            raise ValueError(f"Unknown artifact kind: {artifact.get('kind')}")
        status = artifact.get("status", "available")
        if status not in {"available", "template", "awaiting-source", "restricted"}:
            raise ValueError(f"Unknown artifact status: {status}")
        if status == "available" and sum(bool(artifact.get(k)) for k in ("path", "url", "s3")) != 1:
            raise ValueError("Available companion artifacts require exactly one path, URL or S3 object")
        if artifact.get("s3"):
            s3_location(artifact["s3"])
        if artifact.get("url") and not re.match(r"https?://", artifact["url"]):
            raise ValueError("Artifact URLs must be HTTP(S)")


def compound_cid(label: str, policy: str) -> str | None:
    """Bare numbers are identifiers only when explicitly declared by the operator."""
    match = re.fullmatch(r"(?:CID:|PubChem:)([1-9][0-9]*)", label, re.IGNORECASE)
    if not match and policy == "names-and-pubchem-cids":
        match = re.fullmatch(r"([1-9][0-9]*)", label)
    return str(int(match[1])) if match else None


def compound_annotations(manifest: dict, base: Path, labels) -> list[dict]:
    """Use supplied, checksum-pinned identity mappings before consulting reference services."""
    specification = manifest["input"].get("compoundMetadata")
    source = {}
    if specification:
        path = local_path(specification["path"], base)
        if specification.get("sha256") and digest(path) != specification["sha256"]:
            raise ValueError("Compound metadata checksum does not match manifest")
        with path.open(newline="", encoding="utf-8-sig") as stream:
            reader = csv.DictReader(stream)
            columns = [specification["labelColumn"], specification["cidColumn"]]
            if specification.get("nameColumn"):
                columns.append(specification["nameColumn"])
            if not set(columns).issubset(reader.fieldnames or []):
                raise ValueError(f"Compound metadata is missing required columns: {columns}")
            for record in reader:
                label = record[specification["labelColumn"]]
                cid = record[specification["cidColumn"]].strip()
                if not label or (cid and not re.fullmatch(r"[1-9][0-9]*", cid)):
                    raise ValueError("Compound metadata requires nonempty labels and positive integer CIDs")
                name = record.get(specification.get("nameColumn"), "") or label
                if label in source and source[label]["cid"] != (cid or None):
                    raise ValueError(f"Conflicting source CIDs for compound label: {label}")
                source[label] = {"cid": cid or None, "name": name}
    output = []
    for label in sorted(set(labels)):
        explicit = compound_cid(label, manifest["input"].get("compoundLabels", "names"))
        supplied = source.get(label, {})
        if explicit and supplied.get("cid") and explicit != supplied["cid"]:
            raise ValueError(f"Explicit CID conflicts with source metadata for: {label}")
        cid = supplied.get("cid") or explicit
        name = supplied.get("name", label)
        display_name = name if len(name) < 90 else ("CID:" + cid if cid else label)
        output.append({"label": label, "cid": cid, "name": display_name, "source_name": supplied.get("name", ""),
                       "moa": "", "target": "", "fda_approved": None,
                       "aliases": sorted({label, name, *([cid, "CID:" + cid] if cid else [])}),
                       "resolution": "supplied-metadata" if supplied.get("cid") else "explicit-cid" if explicit else "unresolved"})
    return output


def read_records(path: Path, manifest: dict):
    opener = gzip.open if path.name.endswith(".gz") else open
    prep = manifest["input"].get("preparation")
    canonical = GENE_FIELDS if manifest["category"] == "gene" else FIELDS
    with opener(path, "rt", encoding="utf-8-sig") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            parts = line.rstrip("\r\n").split("\t")
            if len(parts) < 3:
                raise ValueError(f"Line {line_number}: GMT requires term, description and at least one gene")
            raw_term, description, *members = parts
            match = re.fullmatch(r"(.+) (up|down)", raw_term)
            if not match:
                raise ValueError(f"Line {line_number}: exact lowercase ' up'/' down' suffix required")
            body, direction = match.groups()
            values = body.split("::")
            if prep:
                if len(values) != len(prep["fields"]):
                    raise ValueError(f"Line {line_number}: preparation field count mismatch")
                source = dict(zip(prep["fields"], values))
                fields = {**prep.get("defaults", {}), **source}
                values = [fields[name] for name in canonical]
                values += [fields[name] for name in prep["fields"] if name not in canonical]
            if len(values) < len(canonical) or not values[0].strip():
                raise ValueError(f"Line {line_number}: expected at least {len(canonical)} canonical fields")
            if any(not isinstance(value, str) or "::" in value or "\t" in value for value in values):
                raise ValueError(f"Line {line_number}: invalid term field")
            if any(value != value.strip() for value in values):
                raise ValueError(f"Line {line_number}: term fields must not have leading/trailing whitespace")
            if manifest["category"] == "gene":
                if any(t and t not in {"KO", "KD", "KI", "OE", "Mut"} for t in values[5].split("|")):
                    raise ValueError(f"Line {line_number}: invalid gene perturbation type")
            if any(not gene or gene.strip() != gene or any(c.isspace() for c in gene) or "," in gene for gene in members):
                raise ValueError(f"Line {line_number}: gene members must be unweighted symbols without whitespace")
            genes = list(dict.fromkeys(gene.upper() for gene in members))
            term = "::".join(values) + " " + direction
            yield {"term": term, "original_term": raw_term, "description": description,
                   "direction": direction, "genes": genes,
                   "removed_duplicate_genes": len(members) - len(genes),
                   **dict(zip(canonical, values)), "extras": values[len(canonical):]}


def inspect_input(manifest: dict, base: Path) -> tuple[list[dict], dict]:
    path = local_path(manifest["input"]["gmt"], base)
    sha256 = digest(path)
    if manifest["input"].get("sha256") and sha256 != manifest["input"]["sha256"]:
        raise ValueError("Input GMT checksum does not match manifest")
    records = list(read_records(path, manifest))
    if not records:
        raise ValueError("Input GMT contains no gene sets")
    terms = Counter(row["term"] for row in records)
    if duplicates := [term for term, count in terms.items() if count > 1]:
        raise ValueError(f"Duplicate canonical terms: {duplicates[:5]}")
    pairs = defaultdict(set)
    for row in records:
        pairs[row["term"].rsplit(" ", 1)[0]].add(row["direction"])
    paired = sum(directions == {"up", "down"} for directions in pairs.values())
    unpaired = len(pairs) - paired
    if unpaired and manifest.get("pairing") == "require-complete":
        raise ValueError(f"Expected complete pairs; {unpaired} one-direction signatures found")
    report = {"inputSha256": sha256, "geneSets": len(records), "pairedSignatures": paired,
              "unpairedSignatures": unpaired, "compoundLabels": len({r["perturbation"] for r in records}),
              "uniqueGenes": len({g for row in records for g in row["genes"]}),
              "directions": dict(Counter(r["direction"] for r in records)),
              "minSetSize": min(len(r["genes"]) for r in records),
              "maxSetSize": max(len(r["genes"]) for r in records),
              "duplicateGenesRemoved": sum(r["removed_duplicate_genes"] for r in records),
              "normalization": "uppercase gene symbols; deduplicate members preserving order; no size/protein-coding filter",
              "example": records[0]["term"]}
    if specification := manifest["input"].get("compoundMetadata"):
        if manifest["category"] != "drug":
            raise ValueError("input.compoundMetadata applies only to drug libraries")
        compounds = compound_annotations(manifest, base, [r["perturbation"] for r in records])
        report["compoundMetadataSha256"] = digest(local_path(specification["path"], base))
        report["sourceMappedCompounds"] = sum(c["resolution"] == "supplied-metadata" for c in compounds)
    for artifact in manifest.get("artifacts", []):
        if artifact.get("status", "available") == "available" and artifact.get("path"):
            companion = local_path(artifact["path"], base)
            if not companion.is_file() or companion.stat().st_size == 0:
                raise ValueError(f"Companion artifact missing: {artifact['path']}")
            if artifact.get("sha256") and digest(companion) != artifact["sha256"]:
                raise ValueError(f"Companion artifact checksum does not match: {artifact['path']}")
    return records, report
