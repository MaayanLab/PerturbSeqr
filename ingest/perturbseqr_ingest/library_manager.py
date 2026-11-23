"""Manifest-driven library lifecycle. Run with --help; database/network imports are lazy."""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import os
import re
import shutil
import sys
import tempfile
import uuid
from contextlib import closing
from pathlib import Path

from .library_manifest import (BUILD_VERSION, compound_annotations, compound_cid, content_hash, digest, inspect_input,
                               json_digest, load_manifest, local_path, public_s3_url, validate_manifest)
from .library_registration import backfill_existing, downloadable_artifacts, existing_manifests, register_artifacts, verify_public_s3


def write_json(path: Path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")
    temporary.replace(path)


def write_table(path: Path, rows: list[dict]):
    # CSV is always available; Parquet is additionally produced in the ETL environment.
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        for row in rows:
            writer.writerow({key: json.dumps(value) if isinstance(value, (dict, list)) else value
                             for key, value in row.items()})
    try:
        import pandas as pd
        import pyarrow  # noqa: F401
    except ImportError:
        return [path]
    pd.DataFrame(rows).to_parquet(path.with_suffix(".parquet"), index=False)
    return [path, path.with_suffix(".parquet")]


def build(manifest_path: Path, output: Path, offline: bool = False, input_path: Path | None = None) -> Path:
    manifest = load_manifest(manifest_path)
    if manifest.get("registration") == "existing":
        raise ValueError("Use register-existing for existing libraries; their signatures are already loaded")
    if manifest["input"]["gmt"].startswith("s3://") and not input_path:
        raise ValueError("This manifest is already uploaded; use stage --manifest or update --manifest")
    if input_path:
        manifest["input"]["gmt"] = str(input_path.resolve())
    records, report = inspect_input(manifest, manifest_path.parent)
    identity_manifest = {**manifest, "input": {**manifest["input"], "gmt": "<input>"}}
    recipe = {"manifest": identity_manifest, "input": report["inputSha256"],
              "compoundMetadata": report.get("compoundMetadataSha256"),
              "builder": BUILD_VERSION, "offline": offline,
              "companions": {a["path"]: digest(local_path(a["path"], manifest_path.parent))
                             for a in manifest.get("artifacts", [])
                             if a.get("path") and a.get("status", "available") == "available"}}
    identity = json_digest(recipe)
    bundle = output / manifest["slug"] / identity
    bundle.mkdir(parents=True, exist_ok=True)
    resolved_path = bundle / "resolved.json"
    if resolved_path.exists():
        verify_bundle(resolved_path)
        return resolved_path
    gmt = bundle / f"{manifest['slug']}.gmt.gz"
    generated = [gmt]
    # mtime=0 makes repeated builds byte-for-byte reproducible.
    with gmt.open("wb") as raw, gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as handle:
        for row in records:
            handle.write(("\t".join([row["term"], row["description"], *row["genes"]]) + "\n").encode())
    signature_rows = [{key: value for key, value in row.items() if key not in {"genes", "removed_duplicate_genes"}}
                      | {"dataset": manifest["slug"], "gene_set_size": len(row["genes"])} for row in records]
    generated.extend(write_table(bundle / f"{manifest['slug']}-signature_metadata.csv", signature_rows))
    labels = sorted({r["perturbation"] for r in records})
    compounds = []
    if manifest["category"] == "drug":
        compounds = compound_annotations(manifest, manifest_path.parent, labels)
        if not offline:
            generated.extend(annotate_compounds(compounds, bundle))
        generated.extend(write_table(bundle / f"{manifest['slug']}-drug_metadata.csv", compounds))
    else:
        generated.extend(write_table(bundle / f"{manifest['slug']}-gene_target_metadata.csv",
                         [{"gene_target": label, "annotation_status": "unresolved"} for label in labels]))
    cells = sorted({r["cell_line"] for r in records if r["cell_line"]})
    if cells:
        if not offline:
            from perturbseqr_etl.metadata.cell_line import build_cell_line_metadata
            from perturbseqr_etl.data_sources import CACHE_DIR
            build_cell_line_metadata(gmt, bundle, cache_dir=CACHE_DIR,
                                     out_name=f"{manifest['slug']}-cell_line_metadata")
            generated.extend(bundle / f"{manifest['slug']}-cell_line_metadata.{ext}" for ext in ("csv", "parquet"))
        else:
            generated.extend(write_table(bundle / f"{manifest['slug']}-cell_line_metadata.csv",
                             [{"cell_line": cell, "annotation_status": "unresolved"} for cell in cells]))
    if manifest["category"] == "gene" and not offline:
        from perturbseqr_etl.metadata.gene import build_gene_target_metadata
        from perturbseqr_etl.data_sources import CACHE_DIR
        build_gene_target_metadata(gmt, bundle, cache_dir=CACHE_DIR,
                                   out_name=f"{manifest['slug']}-gene_target_metadata")
        generated.extend(bundle / f"{manifest['slug']}-gene_target_metadata.{ext}" for ext in ("csv", "parquet"))
    report["metadataMode"] = "offline" if offline else "reference-annotations"
    report["builderVersion"] = BUILD_VERSION
    report["resolvedCompounds"] = sum(bool(c["cid"]) for c in compounds)
    write_json(bundle / "validation.json", report)
    generated.append(bundle / "validation.json")
    write_json(bundle / "manifest.json", manifest)
    write_json(bundle / "compounds.json", compounds)
    artifacts = []
    distribution = manifest.get("distribution", {})
    # Only outputs generated in THIS invocation can become public artifacts.
    # In particular, a companion left by an interrupted build must retain its own policy.
    for path in sorted(set(generated)):
        kind = "gmt" if path == gmt else "validation" if path.name == "validation.json" else path.name.split("-", 1)[-1]
        if kind not in {"gmt", "validation"}:
            kind = path.stem.removeprefix(manifest["slug"] + "-")
        artifacts.append(file_artifact(path, kind, identity, manifest["slug"],
                                       distribution.get("gmt" if kind == "gmt" else "metadata", "public")))
    for number, artifact in enumerate(manifest.get("artifacts", [])):
        status = artifact.get("status", "available")
        if status != "available":
            artifacts.append({**artifact, "status": status, "path": None, "url": None})
        elif artifact.get("url") or artifact.get("s3"):
            artifacts.extend(downloadable_artifacts({**manifest, "artifacts": [artifact]}))
        else:
            source = local_path(artifact["path"], manifest_path.parent)
            target = bundle / f"companion-{number}-{source.name}"
            shutil.copyfile(source, target)
            descriptor = file_artifact(target, artifact["kind"], identity, manifest["slug"],
                                       artifact.get("distribution", "public"), artifact.get("label"))
            if artifact.get("format"):
                descriptor["format"] = artifact["format"]
            artifacts.append(descriptor)
    # Include actual reference annotations and generated bytes, not just the build recipe.
    # A fresh reference-data build can never overwrite another revision's immutable artifacts.
    identity = json_digest({"recipe": recipe, "report": report, "compounds": compounds,
                            "artifacts": [{k: v for k, v in a.items() if k != "objectKey"} for a in artifacts]})
    for artifact in artifacts:
        if artifact.get("objectKey"):
            artifact["objectKey"] = f"libraries/{manifest['slug']}/{identity}/{artifact['path']}"
    resolved = {"manifest": manifest, "identity": identity, "revisionId": str(uuid.uuid5(uuid.NAMESPACE_URL, identity)),
                "report": report, "artifacts": artifacts, "compounds": compounds,
                "builderVersion": BUILD_VERSION, "recipe": recipe}
    write_json(resolved_path, resolved)
    return resolved_path


def annotate_compounds(compounds: list[dict], bundle: Path):
    """Explicit CIDs bypass name search; enrich names/annotations with existing ETL sources."""
    import pandas as pd
    from perturbseqr_etl.metadata_sources.pubchem import pubchem
    from perturbseqr_etl.metadata_sources.pubchem.helpers import add_pubchem
    from perturbseqr_etl.metadata_sources.drug_repurposing_hub.helpers import join_drh
    unresolved = [row["label"] for row in compounds if not row["cid"]]
    resolved = pubchem.names_to_cids(unresolved) if unresolved else {}
    for row in compounds:
        if not row["cid"] and resolved.get(row["label"]):
            row["cid"] = str(resolved[row["label"]])
            row["resolution"] = "pubchem-name"
    frame = pd.DataFrame({"source_label": [r["label"] for r in compounds],
                          "pubchem_cid": pd.array([r["cid"] for r in compounds], dtype="Int64")})
    frame = add_pubchem(frame, cid_col="pubchem_cid", name_col="pubchem_title", synonyms=False)
    frame = join_drh(frame, cid_col="pubchem_cid", name_col="source_label")
    generated = write_table(bundle / "reference-annotations.csv", frame.where(pd.notna(frame), None).to_dict("records"))
    clean = lambda value: "" if pd.isna(value) else str(value)
    for row, annotation in zip(compounds, frame.to_dict("records")):
        title = clean(annotation.get("pubchem_title"))
        if not (row.get("source_name") and len(row["source_name"]) < 90):
            row["name"] = title if title and len(title) < 90 else ("CID:" + row["cid"] if row["cid"] else row["label"])
        row["aliases"] = sorted({*row["aliases"], row["name"], *([title] if title else []), *([row["cid"], "CID:" + row["cid"]] if row["cid"] else [])})
        row["moa"] = clean(annotation.get("drh_moa"))
        row["target"] = clean(annotation.get("drh_target"))
        approval = clean(annotation.get("drh_fda_approved")).lower()
        row["fda_approved"] = approval == "yes" if approval else None
    return generated


def file_artifact(path, kind, identity, slug, status, label=None):
    return {"kind": kind, "label": label or kind.replace("_", " ").title(), "path": path.name,
            "objectKey": f"libraries/{slug}/{identity}/{path.name}", "status": status,
            "format": "gmt.gz" if path.name.endswith(".gmt.gz") else path.suffix.lstrip("."),
            "bytes": path.stat().st_size, "sha256": digest(path)}


def verify_bundle(path: Path) -> dict:
    value = json.loads(path.read_text())
    expected = json_digest({"recipe": value["recipe"], "report": value["report"], "compounds": value["compounds"],
                            "artifacts": [{k: v for k, v in a.items() if k != "objectKey"} for a in value["artifacts"]]})
    normalized_manifest = {**value["manifest"], "input": {**value["manifest"]["input"], "gmt": "<input>"}}
    if expected != value["identity"] or normalized_manifest != value["recipe"]["manifest"]:
        raise ValueError("Bundle manifest/metadata checksum mismatch; rebuild instead of editing resolved.json")
    if value["revisionId"] != str(uuid.uuid5(uuid.NAMESPACE_URL, expected)):
        raise ValueError("Bundle revision identity mismatch")
    for artifact in value["artifacts"]:
        if artifact.get("path"):
            if Path(artifact["path"]).name != artifact["path"] or artifact.get("objectKey") != f"libraries/{value['manifest']['slug']}/{expected}/{artifact['path']}":
                raise ValueError("Invalid bundle artifact path/object key")
            file = path.parent / artifact["path"]
            if digest(file) != artifact["sha256"]:
                raise ValueError(f"Bundle artifact checksum mismatch: {file}")
    return value


def connection():
    import psycopg2
    return psycopg2.connect(os.environ["DATABASE_URL"])


def storage(bucket=None):
    import boto3
    from botocore.config import Config
    endpoint = os.environ.get("INGEST_S3_ENDPOINT")
    bucket = bucket or os.environ["LIBRARY_S3_BUCKET"]
    kwargs = {"region_name": os.environ.get("AWS_REGION", "us-east-1")}
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    elif os.environ.get("MINIO_ENDPOINT"):
        kwargs.update(endpoint_url=("https://" if os.environ.get("MINIO_SECURE") == "true" else "http://") + os.environ["MINIO_ENDPOINT"],
                      aws_access_key_id=os.environ["MINIO_ROOT_USER"], aws_secret_access_key=os.environ["MINIO_ROOT_PASSWORD"],
                      config=Config(s3={"addressing_style": "path"}))
    return boto3.client("s3", **kwargs), bucket


def public_downloads(bundle):
    """Choose downloadable files and use the same flat naming as the existing bucket."""
    kinds = {"gmt", "full_signatures", "expression_counts", "signature_metadata", "drug_metadata",
             "cell_line_metadata", "gene_target_metadata", "sample_metadata", "compound_metadata"}
    slug = bundle["manifest"]["slug"]
    local = {}
    links = []
    for item in bundle["artifacts"]:
        kind = item["kind"]
        if kind not in kinds:
            continue
        if not item.get("path"):
            links.append(item)
            continue
        name = re.sub(r"^companion-\d+-", "", item["path"])
        if not name.startswith(f"{slug}-") and name != f"{slug}.gmt.gz":
            name = f"{slug}-{name}"
        if name in local:
            raise ValueError(f"Multiple artifacts would use the same S3 key: {name}")
        local[name] = item
    # Where the builder generated both formats, publish only Parquet.
    return [(item, name) for name, item in local.items()
            if not (item["kind"].endswith("_metadata") and name.endswith(".csv")
                    and name[:-4] + ".parquet" in local)] + [(item, None) for item in links]


def upload_public_bundle(bundle_path: Path, bucket: str) -> Path:
    """Upload explicitly public files and emit a portable S3 manifest; no database access."""
    from botocore.exceptions import ClientError

    bundle = verify_bundle(bundle_path)
    source = bundle["manifest"]
    downloads = public_downloads(bundle)
    files = [(item, key) for item, key in downloads if key]
    if any(a["status"] != "public" for a, _ in files):
        raise ValueError("Public-bucket upload requires all local artifacts to be approved for public distribution")
    if bundle["compounds"] and source.get("distribution", {}).get("metadata") == "restricted":
        raise ValueError("The generated compound annotations are restricted")
    public_s3_url(f"s3://{bucket}/check")
    client, bucket = storage(bucket)

    def upload(path, key, sha256, size):
        def head():
            try:
                return client.head_object(Bucket=bucket, Key=key)
            except ClientError as error:
                if error.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 404:
                    raise
                return None

        existing = head()
        if existing is None:
            print(f"Uploading {path.name} ({size:,} bytes) to s3://{bucket}/{key}", file=sys.stderr, flush=True)
            client.upload_file(str(path), bucket, key, ExtraArgs={"Metadata": {"sha256": sha256}})
            existing = head()
        if (not existing or existing["ContentLength"] != size
                or existing.get("Metadata", {}).get("sha256") != sha256):
            raise ValueError(f"S3 object differs from build; refusing to replace it: s3://{bucket}/{key}")

    gmt, gmt_key = next((item, key) for item, key in files if item["kind"] == "gmt")
    annotations = next((item for item, key in files if key == f"{source['slug']}-drug_metadata.{item['format']}" and item["kind"] == "drug_metadata"), None)
    if bundle["compounds"] and annotations is None:
        raise ValueError("The bundle needs its generated drug metadata for compound annotation")
    artifacts = []
    for item, key in downloads:
        artifact = {key: item[key] for key in ("kind", "label", "format", "bytes", "sha256") if key in item}
        if key:
            artifact["s3"] = f"s3://{bucket}/{key}"
            upload(bundle_path.parent / item["path"], key, item["sha256"], item["bytes"])
        elif item["status"] == "external":
            location = "s3" if item.get("s3") else "url"
            artifact[location] = item[location]
        else:
            artifact["status"] = item["status"]
        artifacts.append(artifact)

    # The uploaded GMT is canonical. Keep the source hash and preparation recipe in provenance.
    manifest = {**source, "artifacts": artifacts, "input": {
        key: value for key, value in source["input"].items() if key not in {"gmt", "sha256", "preparation", "compoundMetadata"}
    }}
    manifest["input"].update(gmt=f"s3://{bucket}/{gmt_key}", sha256=gmt["sha256"])
    manifest["processing"] = {**source.get("processing", {}), "sourceGmtSha256": bundle["report"]["inputSha256"],
                              "preparation": source["input"].get("preparation"), "metadataMode": bundle["report"]["metadataMode"]}
    if annotations:
        key = f"{source['slug']}-drug_metadata.{annotations['format']}"
        manifest["input"]["compoundAnnotations"] = {"s3": f"s3://{bucket}/{key}", "sha256": annotations["sha256"]}
    validate_manifest(manifest)
    verify_public_s3(downloadable_artifacts(manifest))
    result = bundle_path.parent / "s3-manifest.json"
    write_json(result, manifest)
    return result


def read_remote_manifest(manifest_path: Path):
    """Read only the GMT and small annotation lookup; companions are checked by HEAD."""
    import requests

    manifest = load_manifest(manifest_path)
    if manifest.get("registration") == "existing":
        raise ValueError("Use register-existing for a legacy catalog backfill")
    source = manifest["input"]
    uri = source["gmt"]
    if not uri.startswith("s3://"):
        raise ValueError("stage --manifest requires an S3 GMT. Build and upload the source files first")
    artifacts = downloadable_artifacts(manifest)
    gmt = [a for a in artifacts if a["kind"] == "gmt"]
    if len(gmt) != 1 or gmt[0].get("s3") != uri or gmt[0].get("sha256") not in {None, source["sha256"]}:
        raise ValueError("Declare one public GMT artifact matching input.gmt and its checksum")
    verify_public_s3(artifacts)

    def download(uri, path):
        with requests.get(public_s3_url(uri), stream=True, timeout=(10, 90)) as response:
            response.raise_for_status()
            with path.open("wb") as out:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    out.write(chunk)

    with tempfile.TemporaryDirectory(prefix="perturbseqr-s3-") as directory:
        temp = Path(directory)
        path = temp / ("input.gmt.gz" if uri.endswith(".gz") else "input.gmt")
        download(uri, path)
        local = {**manifest, "input": {**source, "gmt": str(path)}}
        records, report = inspect_input(local, manifest_path.parent)
        compounds = []
        if manifest["category"] == "drug":
            labels = {r["perturbation"] for r in records}
            if annotation := source.get("compoundAnnotations"):
                path = temp / "compounds.json"
                download(annotation["s3"], path)
                if digest(path) != annotation["sha256"]:
                    raise ValueError("Compound annotations checksum does not match manifest")
                if annotation["s3"].endswith(".parquet"):
                    import polars as pl
                    compounds = pl.read_parquet(path).to_dicts()
                elif annotation["s3"].endswith(".csv"):
                    with path.open(newline="") as stream:
                        compounds = list(csv.DictReader(stream))
                    for compound in compounds:
                        compound["cid"] = compound.get("cid") or None
                        compound["aliases"] = json.loads(compound.get("aliases") or "[]")
                        compound["fda_approved"] = {"True": True, "False": False, "": None}[compound.get("fda_approved", "")]
                else:
                    compounds = json.loads(path.read_text())
                policy = source.get("compoundLabels", "names")
                if (not isinstance(compounds, list) or len(compounds) != len(labels)
                        or not all(isinstance(c, dict) and isinstance(c.get("label"), str)
                                   and "cid" in c and (c["cid"] is None or isinstance(c["cid"], str)
                                                       and compound_cid(c["cid"], "names-and-pubchem-cids") == c["cid"])
                                   and (not compound_cid(c["label"], policy) or compound_cid(c["label"], policy) == c["cid"])
                                   and isinstance(c.get("aliases", []), list)
                                   and all(isinstance(a, str) for a in c.get("aliases", [])) for c in compounds)
                        or {c["label"] for c in compounds} != labels):
                    raise ValueError("Compound annotations must contain exactly one entry per GMT label")
            else:
                compounds = compound_annotations(local, manifest_path.parent, labels)
        report["resolvedCompounds"] = sum(bool(c["cid"]) for c in compounds)
    return manifest, records, report, artifacts, compounds


def stage_remote(manifest_path: Path):
    manifest, records, report, artifacts, compounds = read_remote_manifest(manifest_path)
    identity = json_digest({"manifest": manifest, "builder": BUILD_VERSION, "report": report, "compounds": compounds})
    return store_revision(manifest, identity, records, report, artifacts, compounds)


def stage(bundle_path: Path):
    bundle = verify_bundle(bundle_path)
    manifest = bundle["manifest"]
    client, bucket = storage()
    # Immutable keys. Store all staged objects privately; download URLs are signed only for published artifacts.
    for artifact in bundle["artifacts"]:
        if artifact.get("path"):
            client.upload_file(str(bundle_path.parent / artifact["path"]), bucket, artifact["objectKey"],
                               ExtraArgs={"Metadata": {"sha256": artifact["sha256"]}})
            head = client.head_object(Bucket=bucket, Key=artifact["objectKey"])
            if head["ContentLength"] != artifact["bytes"] or head.get("Metadata", {}).get("sha256") != artifact["sha256"]:
                raise ValueError(f"S3 artifact verification failed: {artifact['objectKey']}")
    canonical_manifest = {**manifest, "input": {**manifest["input"], "preparation": None}}
    gmt = next(a for a in bundle["artifacts"] if a["kind"] == "gmt")
    from .library_manifest import read_records
    records = list(read_records(bundle_path.parent / gmt["path"], canonical_manifest))
    return store_revision(manifest, bundle["identity"], records, bundle["report"], bundle["artifacts"], bundle["compounds"])


def store_revision(manifest, identity, records, report, artifacts, compound_rows):
    from psycopg2.extras import Json, execute_values
    revision_id = str(uuid.uuid5(uuid.NAMESPACE_URL, identity))
    with closing(connection()) as conn, conn, conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", ["library:" + manifest["slug"]])
        cur.execute("SELECT id FROM app_public.library_revision WHERE id=%s", [revision_id])
        if cur.fetchone():
            return revision_id
        cur.execute("""INSERT INTO app_public.gene_set_library (name,description,slug,category,resource_key)
                       VALUES (%s,%s,%s,%s,%s) ON CONFLICT (slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id""",
                    [manifest["displayName"], manifest["description"], manifest["slug"], manifest["category"], manifest["resource"]["key"]])
        library_id = str(cur.fetchone()[0])
        cur.execute("""INSERT INTO app_public.library_revision (id,library_id,version,checksum,manifest,report,status)
                       VALUES (%s,%s,%s,%s,%s,%s,'staged')""",
                    [revision_id, library_id, manifest["version"], identity, Json(manifest), Json(report)])
        symbols = sorted({gene for row in records for gene in row["genes"]})
        execute_values(cur, "INSERT INTO app_public.gene(symbol) VALUES %s ON CONFLICT(symbol) DO NOTHING", [(s,) for s in symbols])
        cur.execute("SELECT symbol,id FROM app_public.gene WHERE symbol=ANY(%s)", [symbols])
        genes = {symbol: str(gid) for symbol, gid in cur.fetchall()}
        compounds = {row["label"]: row for row in compound_rows}
        def gene_set_rows():
            for row in records:
                compound = compounds.get(row["perturbation"], {})
                ids = {genes[gene]: position for position, gene in enumerate(row["genes"])}
                yield [str(uuid.uuid5(uuid.UUID(revision_id), row["term"])), row["term"], row["description"],
                       content_hash(row["genes"]), Json(ids), len(ids),
                       library_id, revision_id, row["perturbation"], compound.get("cid")]
        execute_values(cur, """INSERT INTO app_public.gene_set
                      (id,term,description,hash,gene_ids,n_gene_ids,library_id,revision_id,perturbation,cid)
                      VALUES %s""", gene_set_rows(), page_size=1000)
        for row in compound_rows:
            cur.execute("INSERT INTO app_public.library_compound(revision_id,label,cid,metadata) VALUES (%s,%s,%s,%s)",
                        [revision_id, row["label"], row["cid"], Json(row)])
        register_artifacts(cur, revision_id, [{k: v for k, v in a.items() if k != "path"} for a in artifacts])
    return revision_id


def index(revision_id: str) -> str:
    import requests
    from psycopg2.extras import Json
    with closing(connection()) as conn, conn, conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", ["library-index:" + revision_id])
        cur.execute("SELECT library_id,status FROM app_public.library_revision WHERE id=%s", [revision_id])
        row = cur.fetchone()
        if not row:
            raise ValueError("Unknown revision; stage first")
        library_id, _ = row
        cur.execute("""SELECT id,status,revision_ids::text[] FROM app_public.library_generation WHERE candidate_revision_id=%s
                    AND ((status='published' AND id=(SELECT id FROM app_public.current_background()))
                     OR (status IN ('ready','building') AND parent_background_id IS NOT DISTINCT FROM (SELECT id FROM app_public.current_background())))
                    ORDER BY created DESC LIMIT 1""", [revision_id])
        existing = cur.fetchone()
        if existing and existing[1] != 'building':
            return str(existing[0])
        if existing:
            background, revisions = str(existing[0]), [str(r) for r in existing[2]]
        else:
            cur.execute("SELECT id FROM app_public.current_background()")
            parent = cur.fetchone()
            cur.execute("SELECT active_revision_id FROM app_public.gene_set_library WHERE active_revision_id IS NOT NULL AND id<>%s", [library_id])
            revisions = sorted([str(r[0]) for r in cur.fetchall()] + [revision_id])
            if parent:
                cur.execute("SELECT active_revision_id FROM app_public.gene_set_library WHERE active_revision_id IS NOT NULL")
                previous = [str(r[0]) for r in cur.fetchall()]
                if previous:
                    cur.execute("""INSERT INTO app_public.library_generation
                                (id,revision_ids,candidate_revision_id,status,published_at)
                                VALUES(%s,%s::uuid[],%s,'published',now()) ON CONFLICT(id) DO NOTHING""",
                                [parent[0], previous, previous[0]])
            cur.execute("""INSERT INTO app_public.background(gene_ids,n_gene_ids)
                           SELECT jsonb_object_agg(gene_id,null),count(*) FROM (
                              SELECT DISTINCT jsonb_object_keys(gene_ids) AS gene_id
                              FROM app_private.library_snapshot_sets(%s::uuid[])) genes RETURNING id""", [revisions])
            background = str(cur.fetchone()[0])
            cur.execute("""INSERT INTO app_public.library_generation(id,revision_ids,candidate_revision_id,parent_background_id,status)
                            VALUES (%s,%s::uuid[],%s,%s,'building')""", [background, revisions, revision_id, parent[0] if parent else None])
    response = requests.get(os.environ.get("ENRICH_URL", "http://127.0.0.1:8000").rstrip("/") + "/" + background, timeout=3600)
    response.raise_for_status()
    counts = response.json()
    with closing(connection()) as conn, conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM app_private.library_snapshot_sets(%s::uuid[])", [revisions])
        expected = cur.fetchone()[0]
        cur.execute("""SELECT count(*) FROM (SELECT library_id,regexp_replace(term,' (up|down)$','')
                    FROM app_private.library_snapshot_sets(%s::uuid[]) WHERE term ~ ' (up|down)$'
                    GROUP BY library_id,regexp_replace(term,' (up|down)$','')
                    HAVING count(DISTINCT substring(term FROM '(up|down)$'))=2) pairs""", [revisions])
        pairs = cur.fetchone()[0]
        if counts.get("index") != expected or counts.get("pairs") != pairs or not counts.get("persisted"):
            raise ValueError(f"Candidate index verification failed: {counts}; expected {expected} sets/{pairs} pairs")
        cur.execute("UPDATE app_public.library_generation SET status='ready',report=%s WHERE id=%s AND status='building'", [Json(counts), background])
    return background


def publish(generation_id: str):
    with closing(connection()) as conn, conn, conn.cursor() as cur:
        cur.execute("SELECT app_public.publish_library_generation(%s)", [generation_id])
        return cur.fetchone()[0]


def rollback(generation_id: str):
    import requests
    response = requests.get(os.environ.get("ENRICH_URL", "http://127.0.0.1:8000") + "/" + generation_id, timeout=3600)
    response.raise_for_status()
    with connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT app_public.rollback_library_generation(%s)", [generation_id])
        return cur.fetchone()[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["validate", "build", "upload", "register-existing", "stage", "index", "publish", "update", "rollback"])
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--manifests-dir", type=Path, default=Path("libraries"))
    parser.add_argument("--bucket", help="Public S3 bucket for the upload command")
    parser.add_argument("--input", type=Path, help="Override manifest GMT location, preserving the declared checksum")
    parser.add_argument("--output", type=Path, default=Path("data/library-builds"))
    parser.add_argument("--bundle", type=Path, help="resolved.json from build (upload or local staging)")
    parser.add_argument("--revision")
    parser.add_argument("--generation")
    parser.add_argument("--offline", action="store_true", help="Generate structural metadata/explicit CIDs without reference APIs")
    args = parser.parse_args()
    try:
        if args.command == "validate":
            if not args.manifest:
                parser.error("--manifest is required")
            manifest = load_manifest(args.manifest)
            if args.input:
                manifest["input"]["gmt"] = str(args.input.resolve())
            if manifest["input"]["gmt"].startswith("s3://"):
                _, _, report, _, _ = read_remote_manifest(args.manifest)
            else:
                _, report = inspect_input(manifest, args.manifest.parent)
            print(json.dumps(report, indent=2))
        elif args.command in {"build", "update"}:
            if not args.manifest:
                parser.error("--manifest is required")
            remote = not args.input and load_manifest(args.manifest)["input"]["gmt"].startswith("s3://")
            if not remote or args.command == "build":
                bundle = build(args.manifest.resolve(), args.output.resolve(), args.offline, args.input)
                print(f"Built: {bundle}")
            if args.command == "update":
                revision = stage_remote(args.manifest) if remote else stage(bundle)
                generation = index(revision)
                print(f"Published generation: {publish(generation)}")
        elif args.command == "upload":
            if not args.bundle or not args.bucket:
                parser.error("--bundle and --bucket are required")
            print(upload_public_bundle(args.bundle, args.bucket))
        elif args.command == "register-existing":
            manifests = existing_manifests(args.manifests_dir)
            with closing(connection()) as conn:
                print(json.dumps(backfill_existing(conn, manifests), indent=2))
        elif args.command == "stage":
            if bool(args.bundle) == bool(args.manifest):
                parser.error("Provide exactly one --bundle or --manifest")
            print(stage(args.bundle) if args.bundle else stage_remote(args.manifest))
        elif args.command == "index":
            if not args.revision:
                parser.error("--revision is required")
            print(index(args.revision))
        elif args.command in {"publish", "rollback"}:
            if not args.generation:
                parser.error("--generation is required")
            print((publish if args.command == "publish" else rollback)(args.generation))
    except (ValueError, OSError) as error:
        parser.exit(1, f"Library workflow failed: {error}\n")


if __name__ == "__main__":
    main()
