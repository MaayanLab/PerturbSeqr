"""
LINCS L1000 CP drug metadata: the compounds that appear in the Perturb-Seqr CP GMT, annotated with the
Clue.io compound registry (compoundinfo_beta.txt) + the Drug Repurposing Hub (curated moa / target /
clinical phase) trimmed to GMT compounds.
"""
import sys
from pathlib import Path

import pandas as pd

from perturbseqr_etl.data_sources import CACHE_DIR
from perturbseqr_etl.data_sources.lincs_l1000.cp._display import display_names
from perturbseqr_etl.gmt import iter_term_fields
from perturbseqr_etl.metadata import write_table
from perturbseqr_etl.metadata.drug import inherit_variant_moa
from perturbseqr_etl.metadata_sources.drug_repurposing_hub.helpers import join_drh
from perturbseqr_etl.metadata_sources.pubchem.helpers import add_pubchem

HERE = Path(__file__).parent
OUT_DIR = HERE / "intermediate"
OUT_NAME = "lincs-l1000-cp-drug_metadata"
COMPOUNDINFO = CACHE_DIR / "compoundinfo_beta.txt"
CP_GMT = OUT_DIR / "lincs-l1000-cp.gmt.gz"

# Clue.io compoundinfo column -> our column (lincs_* = Clue.io's own annotations).
COLS = {"cmap_name": "lincs_drug_name", "pert_id": "lincs_pert_id", "inchi_key": "inchi_key",
        "canonical_smiles": "smiles", "target": "lincs_target", "moa": "lincs_moa",
        "compound_aliases": "lincs_aliases"}
FIRST_COLS = ["lincs_drug_name", "pubchem_title", "pubchem_cid", "lincs_pert_id", "inchi_key", "smiles"]


def _gmt_keys(path: Path) -> set[str]:
    """Distinct compound keys in the CP GMT: the perturbation name (field [0]) AND the BRD pert_id (the
    last extra), so compoundinfo still matches after the BRD-coded names are relabeled (see _display)."""
    keys: set[str] = set()
    for fields in iter_term_fields(path):
        keys.update((fields[0], fields[-1]))
    return keys


def drug_metadata(no_cache: bool = False) -> Path:
    """Build the CP drug table trimmed to the compounds in the CP GMT, plus curated drh_* cols."""
    if not CP_GMT.exists():
        raise FileNotFoundError(
            f"CP GMT intermediate missing: {CP_GMT}\n  Run cp/gmt.py first: "
            f"uv run --project etl python -m perturbseqr_etl.data_sources.lincs_l1000.cp.gmt")

    gmt_keys = _gmt_keys(CP_GMT)
    ci = pd.read_csv(COMPOUNDINFO, sep="\t", dtype=str, keep_default_na=False)
    df = ci[ci["cmap_name"].isin(gmt_keys) | ci["pert_id"].isin(gmt_keys)]
    df = df[list(COLS)].rename(columns=COLS)
    # relabel BRD-coded names with the same readable alias/PubChem title the GMT uses (keeps the two joinable)
    disp = display_names()
    df["lincs_drug_name"] = [disp.get(pid, name) for pid, name in zip(df["lincs_pert_id"], df["lincs_drug_name"])]
    df = df[df["lincs_drug_name"] != ""].drop_duplicates("lincs_drug_name").reset_index(drop=True)

    # derive PubChem CID from the Clue.io InChIKey, falling back to the canonical SMILES
    from perturbseqr_etl.metadata_sources.pubchem.helpers import resolve_cids
    cids = resolve_cids(zip(df.index, df["inchi_key"], df["smiles"]))
    df["pubchem_cid"] = [str(cids.get(i, "")) for i in df.index]
    df = add_pubchem(df, cid_col="pubchem_cid", name_col="pubchem_title", synonyms=False)   # PubChem Title (shared core col)

    df = join_drh(df, cid_col="pubchem_cid", name_col="lincs_drug_name", inchi_col="inchi_key")
    # salt forms get base compound MoA. Base looked up in the full Clue.io registry (ci), not just GMT compounds
    lincs_src = ci.rename(columns={"cmap_name": "lincs_drug_name", "moa": "lincs_moa", "target": "lincs_target"})
    df = inherit_variant_moa(df, name_col="lincs_drug_name", value_cols=["lincs_moa", "lincs_target"],
                             source=lincs_src, source_name_col="lincs_drug_name")
    df = df[FIRST_COLS + [c for c in df.columns if c not in FIRST_COLS]]
    n_cid = (df["pubchem_cid"] != "").sum()
    n_drh = (df["drh_matched_on"] != "").sum()
    return write_table(df, OUT_DIR, OUT_NAME, label="compounds",
                       note=f"({n_cid} with PubChem CID, {n_drh} matched to Drug Repurposing Hub)")


if __name__ == "__main__":
    drug_metadata(no_cache="--no-cache" in sys.argv)
