#!/usr/bin/env python3
"""
Broad Drug Repurposing Hub — download into parquet file.

Sources: public, https://repo-hub.broadinstitute.org/repurposing#download-data:
  repo-drug-annotation-20200324.txt    (662 KB)  pert_iname	clinical_phase	moa	target	disease_area	indication
    7,540 rows (one per drug)
  repo-sample-annotation-20240610.txt  (4.1 MB)  broad_id	pert_iname	qc_incompatible	purity	vendor	catalog_no	vendor_name	expected_mass	smiles	InChIKey	pubchem_cid	deprecated_broad_id
    22,615 rows (per-lot; 7,524 distinct drugs)

Outputs (-> intermediate/, gitignored):
  repo_drug_annotation.parquet       (221 KB)  pert_iname	clinical_phase	moa	target	disease_area	indication
  repo_sample_annotation.parquet     (1.2 MB)  broad_id	pert_iname	qc_incompatible	purity	vendor	catalog_no	vendor_name	expected_mass	smiles	InChIKey	pubchem_cid	deprecated_broad_id
  drug_repurposing_hub.parquet/.csv  (754 KB)  pert_iname	clinical_phase	moa	target	disease_area	indication	broad_id	smiles	inchi_key	pubchem_cid

Usage: uv run db/etl/inputs/metadata/drug_repurposing_hub/build.py [--no-cache]
"""
import sys
from pathlib import Path

import pandas as pd

from perturbseqr_etl.inputs._dataloader import download_to

BASE = "https://repo-hub.broadinstitute.org/public/data"
DRUG_FILE = "repo-drug-annotation-20200324.txt"
SAMPLE_FILE = "repo-sample-annotation-20240610.txt"
UPSTREAM = Path(__file__).parent / "upstream"
OUT = Path(__file__).parent / "intermediate"


_read = lambda path: pd.read_csv(path, sep="\t", dtype=str, skiprows=9).fillna("")
# download_to falls back to curl for repo-hub's incomplete cert chain (see _utils).
_download_to_parquet = lambda src, pq, no_cache=False: (
    df := _read(download_to(f"{BASE}/{src}", UPSTREAM / src, no_cache=no_cache))).to_parquet(OUT / pq, index=False) or df


def build(no_cache: bool = False) -> Path:
    UPSTREAM.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    drug = _download_to_parquet(DRUG_FILE, "repo_drug_annotation.parquet", no_cache)
    samp = _download_to_parquet(SAMPLE_FILE, "repo_sample_annotation.parquet", no_cache)

    chem = (samp[["pert_iname", "broad_id", "smiles", "InChIKey", "pubchem_cid"]]
            .replace("", pd.NA)
            .groupby("pert_iname", as_index=False).first()
            .rename(columns={"InChIKey": "inchi_key"}))

    drh = drug.merge(chem, on="pert_iname", how="outer").fillna("")
    drh["pubchem_cid"] = pd.to_numeric(drh["pubchem_cid"], errors="coerce").astype("Int64")
    drh.to_parquet(OUT / "drug_repurposing_hub.parquet", index=False)
    drh.to_csv(OUT / "drug_repurposing_hub.csv", index=False)
    print(f"-> {OUT}/drug_repurposing_hub.parquet")
    return OUT


if __name__ == "__main__":
    build(no_cache="--no-cache" in sys.argv)
