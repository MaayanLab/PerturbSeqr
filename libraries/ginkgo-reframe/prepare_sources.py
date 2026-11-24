"""Verify the reFRAME source archives and prepare local intake files.

Run with: uv run --project etl --with h5py python libraries/ginkgo-reframe/prepare_sources.py --help
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import io
import json
import os
import pickle
import shutil
import tempfile
import zipfile
from pathlib import Path

SOURCE_FILES = {
    "assets/ginkgo-reframe-short-drugs.gmt": "ginkgo-reframe-short-drugs.gmt",
    "assets/compound_meta.csv": "compound_meta.csv",
    "assets/case_controls.pkl": "case_controls.pkl",
    "calculate_dge.py": "calculate_dge.py",
    "reFRAME.ipynb": "reFRAME.ipynb",
    "create_gmt.ipynb": "create_gmt.ipynb",
}


class DataOnlyUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        raise ValueError(f"Source metadata must contain plain data, not pickle globals: {module}.{name}")


def sha256(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def prepare(source_archive: Path, full_archive: Path, output: Path):
    output.mkdir(parents=True, exist_ok=True)
    report = {"sourceArchive": {"filename": source_archive.name, "sha256": sha256(source_archive)}, "files": {}}
    with zipfile.ZipFile(source_archive) as archive:
        for member, filename in SOURCE_FILES.items():
            # Fixed allowlist: never extract arbitrary archive paths or execute source code.
            target = output / filename
            contents = archive.read(member)
            checksum = hashlib.sha256(contents).hexdigest()
            if target.exists() and sha256(target) != checksum:
                raise ValueError(f"Existing input differs; choose a new output directory: {target}")
            if not target.exists():
                target.write_bytes(contents)
            report["files"][filename] = {"archiveMember": member, "sha256": checksum, "bytes": len(contents)}
    manifest = json.loads(Path(__file__).with_name("source-manifest.json").read_text())
    if report["files"]["ginkgo-reframe-short-drugs.gmt"]["sha256"] != manifest["input"]["sha256"]:
        raise ValueError("Archived GMT differs from the manifest's frozen input")
    with (output / "case_controls.pkl").open("rb") as stream:
        conditions = DataOnlyUnpickler(stream).load()
    report["contrasts"] = {
        "conditions": len(conditions),
        "cellLines": dict(collections.Counter(k.split("::")[1] for k in conditions)),
        "timepoints": dict(collections.Counter(k.split("::")[2] for k in conditions)),
        "concentrations": dict(collections.Counter(k.split("::")[3] for k in conditions)),
        "caseSizes": dict(collections.Counter(len(v["case"]) for v in conditions.values())),
        "controlSizes": dict(collections.Counter(len(v["control"]) for v in conditions.values())),
        "caseControlOverlaps": sum(bool(set(v["case"]) & set(v["control"])) for v in conditions.values()),
    }
    with (output / "compound_meta.csv").open() as stream:
        compounds = list(csv.DictReader(stream))
    cid_to_name = {row["pubchem_cid"]: row["common_name"] for row in compounds}
    with (output / "ginkgo-reframe-short-drugs.gmt").open() as stream:
        observed = {parts[0]: set(parts[2:]) for line in stream
                    if (parts := line.rstrip("\r\n").split("\t")) and parts[0]}
    report["compoundMetadata"] = {"rows": len(compounds), "uniqueCids": len(cid_to_name)}
    full_checksum = sha256(full_archive)
    expected_full = next(a.get("sha256") for a in manifest["artifacts"] if a["kind"] == "full_signatures")
    if expected_full and expected_full != full_checksum:
        raise ValueError("Full-signature archive differs from the manifest's frozen input")
    report["fullSignaturesArchive"] = {"filename": full_archive.name, "sha256": full_checksum,
                                       "bytes": full_archive.stat().st_size}
    with zipfile.ZipFile(full_archive) as archive:
        member = archive.getinfo("deseq2.h5ad")
        if shutil.disk_usage(output).free < member.file_size + 1024 ** 3:
            raise ValueError("Full verification needs temporary space for the H5AD plus a 1 GiB margin")
        with tempfile.TemporaryDirectory(prefix="reframe-h5ad-", dir=output) as temporary:
            h5ad_path = Path(temporary) / "deseq2.h5ad"
            checksum = hashlib.sha256()
            with archive.open(member) as source, h5ad_path.open("wb") as target:
                while block := source.read(8 * 1024 ** 2):
                    checksum.update(block)
                    target.write(block)
            report["fullSignatures"] = {"archiveMember": member.filename, "bytes": member.file_size,
                                         "sha256": checksum.hexdigest()}
            verification, provenance = verify_h5ad(h5ad_path, observed, cid_to_name, conditions)
            report["fullSignatures"].update(verification)
            if not verification["gmtMatches"]:
                save_json(output / "source-verification.json", report)
                raise ValueError("Full DE results do not regenerate the supplied GMT; see source-verification.json")
    with (output / "signature_provenance.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["original_term", "source_signature_id", "pubchem_cid"])
        writer.writeheader()
        writer.writerows(provenance)
    by_label = collections.defaultdict(set)
    by_label_sources = collections.defaultdict(list)
    for row in provenance:
        label = row["original_term"].split("::", 1)[0]
        by_label[label].add(row["pubchem_cid"])
        by_label_sources[label].append(row["source_signature_id"])
    with (output / "compound_label_map.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["label", "pubchem_cid", "common_name", "candidate_cids", "source_signature_ids"])
        writer.writeheader()
        for label, cids in sorted(by_label.items()):
            cid = next(iter(cids)) if len(cids) == 1 else ""
            writer.writerow({"label": label, "pubchem_cid": cid, "common_name": cid_to_name[cid] if cid else label,
                             "candidate_cids": json.dumps(sorted(cids)),
                             "source_signature_ids": json.dumps(sorted(set(by_label_sources[label])))})
    report["compoundMetadata"].update({"mappedLabels": len(by_label),
                                       "ambiguousSurvivingLabels": {label: sorted(cids) for label, cids in by_label.items() if len(cids) > 1}})
    # Keep a durable local reference without duplicating the 2.4 GB archive on the same filesystem.
    # The importer subsequently checksums and copies this immutable input into its bundle.
    target = output / "ginkgo-reframe-deseq2.h5ad.zip"
    if target.exists():
        if sha256(target) != full_checksum:
            raise ValueError("Existing full-signature archive differs; choose another output directory")
    else:
        try:
            os.link(full_archive, target)
        except OSError:
            shutil.copyfile(full_archive, target)
    for filename in ("signature_provenance.csv", "compound_label_map.csv"):
        report["files"][filename] = {"sha256": sha256(output / filename), "bytes": (output / filename).stat().st_size}
    save_json(output / "source-verification.json", report)
    print(json.dumps(report, indent=2, sort_keys=True))


def verify_h5ad(path, observed, cid_to_name, conditions):
    import h5py
    import numpy as np
    with h5py.File(path, "r") as data:
        read_index = lambda group: data[group][data[group].attrs.get("_index", "_index")].asstr()[:]
        obs, genes = read_index("obs"), read_index("var")
        if len(set(obs)) != len(obs) or len(set(genes)) != len(genes):
            raise ValueError("Full signatures require unique condition and gene identifiers")
        if set(obs) != set(conditions):
            raise ValueError("H5AD conditions differ from the supplied case/control map")
        shape = (len(obs), len(genes))
        for name in ("X", "layers/logFC", "layers/pValue"):
            if data[name].shape != shape:
                raise ValueError(f"Unexpected matrix shape for {name}")
        report = {"shape": list(shape), "X": "DESeq2 adjusted p-value (padj)",
                  "layers": {"logFC": "log2FoldChange", "pValue": "unadjusted pvalue"},
                  "dtype": str(data["X"].dtype), "obsExamples": list(obs[:3]),
                  "geneExamples": list(genes[:5])}
        predicted, provenance = {}, {}
        empty, overwritten, all_nan = 0, 0, 0
        for start in range(0, len(obs), 64):
            effects = data["layers/logFC"][start:start + 64]
            pvalues = data["layers/pValue"][start:start + 64]
            for offset, signature in enumerate(obs[start:start + 64]):
                cid, cell, _, _ = signature.split("::")
                name = cid_to_name[cid]
                label = name if len(name) < 90 else cid
                all_nan += int(np.isnan(pvalues[offset]).all())
                for direction, mask in (("up", effects[offset] > 1), ("down", effects[offset] < -1)):
                    selected = np.flatnonzero(mask)
                    selected = selected[np.argsort(pvalues[offset, selected], kind="quicksort")]
                    selected = selected[pvalues[offset, selected] < 0.05][:1000]
                    if not len(selected):
                        empty += 1
                        continue
                    term = f"{label}::{cell}::::10uM {direction}"
                    overwritten += int(term in predicted)
                    predicted[term] = set(genes[selected])
                    provenance[term] = {"original_term": term, "source_signature_id": signature, "pubchem_cid": cid}
        missing = sorted(observed.keys() - predicted.keys())
        extra = sorted(predicted.keys() - observed.keys())
        conflicts = [term for term in observed.keys() & predicted.keys() if observed[term] != predicted[term]]
        report.update({"gmtMatches": not (missing or extra or conflicts), "regeneratedGeneSets": len(predicted),
                       "emptyDirectionalResults": empty, "overwrittenNameDirectionKeys": overwritten,
                       "allNanConditions": all_nan, "missingTerms": missing[:10], "extraTerms": extra[:10],
                       "membershipConflictCount": len(conflicts), "membershipConflictExamples": sorted(conflicts)[:10]})
        return report, [provenance[term] for term in sorted(provenance)]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-archive", type=Path, required=True)
    parser.add_argument("--full-signatures", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/upstream/ginkgo-reframe"))
    args = parser.parse_args()
    prepare(args.source_archive.resolve(), args.full_signatures.resolve(), args.output.resolve())
