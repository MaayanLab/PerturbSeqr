"""
Tahoe-100M drug metadata: Tahoe's (GPT-4o-inferred) drug table, enriched with the PubChem Title
and the Drug Repurposing Hub (curated moa / target / clinical phase). Compound-level data that isn't
dataset-specific (synonyms, etc.) belongs in a shared drug reference keyed by pubchem_cid, not here.

Source:  https://huggingface.co/datasets/tahoebio/Tahoe-100M/tree/main/metadata
         columns: drug, targets, moa-broad, moa-fine, human-approved, clinical-trials,
                  gpt-notes-approval, canonical_smiles, pubchem_cid
Output:  tahoe-100m-drug_metadata.parquet / .csv
         columns: tahoe_drug_name, pubchem_title, pubchem_cid, smiles,
                  targets, moa_broad, moa_fine, human_approved, clinical_trials,
                  drh_moa, drh_target, drh_clinical_phase, drh_fda_approved, drh_disease_area,
                  drh_indication, drh_inchi_key, drh_matched_on

Usage: uv run --project etl python -m perturbseqr_etl.data_sources.tahoe_100m.drug_metadata
"""
import sys
from pathlib import Path

import pandas as pd

from perturbseqr_etl.data_sources import CACHE_DIR
from perturbseqr_etl.dataloader import download_to
from perturbseqr_etl.metadata import write_table
from perturbseqr_etl.metadata_sources.drug_repurposing_hub.helpers import join_drh
from perturbseqr_etl.metadata_sources.pubchem.helpers import add_pubchem

HF_META = "https://huggingface.co/datasets/tahoebio/Tahoe-100M/resolve/main/metadata"
OUT_DIR = Path(__file__).parent / "intermediate"
OUT_NAME = "tahoe-100m-drug_metadata"

# Tahoe column -> our column name (drop gpt-notes-approval).
DRUG_COLS = {
    "drug": "tahoe_drug_name",
    "pubchem_cid": "pubchem_cid",
    "canonical_smiles": "smiles",
    "targets": "tahoe_targets",
    "moa-broad": "tahoe_moa_broad",
    "moa-fine": "tahoe_moa_fine",
    "human-approved": "tahoe_human_approved",
    "clinical-trials": "tahoe_clinical_trials",
}
# Identity columns lead the table; annotations (targets/moa/drh_*) follow in build order.
FIRST_COLS = ["tahoe_drug_name", "pubchem_title", "pubchem_cid", "smiles"]


def drug_metadata(no_cache: bool = False) -> Path:
    """Build the per-dataset drug table (Tahoe + PubChem name/synonyms + curated drh_* cols) into intermediate/."""
    dg = pd.read_parquet(download_to(f"{HF_META}/drug_metadata.parquet",
                                     CACHE_DIR / "tahoe_drug_metadata.parquet", no_cache=no_cache))
    dg = dg[list(DRUG_COLS)].rename(columns=DRUG_COLS).reset_index(drop=True)
    dg["pubchem_cid"] = dg["pubchem_cid"].astype("Int64")   # CIDs are integers; avoid 1.65e8 float rendering
    dg = add_pubchem(dg, cid_col="pubchem_cid", synonyms=False)
    dg = join_drh(dg, cid_col="pubchem_cid", name_col="tahoe_drug_name")
    dg = dg[FIRST_COLS + [c for c in dg.columns if c not in FIRST_COLS]]
    n_drh = (dg["drh_matched_on"] != "").sum()
    return write_table(dg, OUT_DIR, OUT_NAME, label="drugs", note=f"({n_drh} matched to Drug Repurposing Hub)")


if __name__ == "__main__":
    drug_metadata(no_cache="--no-cache" in sys.argv)
