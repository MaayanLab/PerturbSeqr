"""NIBR drug metadata. One row per NSN code: MoABox structure + drugseqr name/cid + PubChem Title + DRH."""
import gzip
import sys
from pathlib import Path

import pandas as pd

from perturbseqr_etl.metadata import write_table
from perturbseqr_etl.metadata.drug import inherit_variant_moa
from perturbseqr_etl.metadata_sources.pubchem.helpers import add_pubchem
from perturbseqr_etl.metadata_sources.drug_repurposing_hub.helpers import join_drh
from perturbseqr_etl.data_sources.nibr_drug_seq import _display
from perturbseqr_etl.data_sources.nibr_drug_seq.gmt import FINAL as GMT_PATH, NSN_PREFIX

OUT_DIR = Path(__file__).parent / "intermediate"
OUT_NAME = "nibr-drug-seq-drug_metadata"
FIRST_COLS = ["nibr_drug_name", "nsn_code", "pubchem_title", "pubchem_cid"]


def _gmt_nsn_codes() -> list[str]:
    """NSN codes in the GMT (the description column holds the 'NSN:<code>' tag)."""
    codes = set()
    with gzip.open(GMT_PATH, "rt") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) > 1 and parts[1].startswith(NSN_PREFIX):
                codes.add(parts[1][len(NSN_PREFIX):])
    return sorted(codes)


def drug_metadata(no_cache: bool = False) -> Path:
    if not GMT_PATH.exists():
        raise FileNotFoundError(
            f"GMT not found: {GMT_PATH}\n  Run gmt.py first: "
            f"uv run --project etl python -m perturbseqr_etl.data_sources.nibr_drug_seq.gmt")
    resolved = _display.resolve_nsn()
    moabox = _display.load_moabox()
    rows = []
    for code in _gmt_nsn_codes():
        r, mb = resolved.get(code, {}), moabox.get(code, {})
        rows.append({
            "nibr_drug_name": r.get("name") or f"{NSN_PREFIX}{code}",
            "nsn_code": code,
            "pubchem_cid": r.get("cid") or "",
            "inchi_key": mb.get("inchi_key", ""),
            "smiles": mb.get("smiles", ""),
            "cas_number": mb.get("cas_number", ""),
            "moabox_moa": mb.get("moa", ""),
        })
    dg = pd.DataFrame(rows)
    dg["pubchem_cid"] = pd.to_numeric(dg["pubchem_cid"], errors="coerce").astype("Int64")
    dg = add_pubchem(dg, cid_col="pubchem_cid", name_col="pubchem_title", synonyms=False)
    dg = join_drh(dg, cid_col="pubchem_cid", name_col="nibr_drug_name", inchi_col="inchi_key")
    dg = inherit_variant_moa(dg, name_col="nibr_drug_name", value_cols=["moabox_moa"])  # salt forms get base MoABox MoA
    dg = dg[FIRST_COLS + [c for c in dg.columns if c not in FIRST_COLS]]

    n_named = (~dg["nibr_drug_name"].str.startswith(NSN_PREFIX)).sum()
    return write_table(dg, OUT_DIR, OUT_NAME, label="drugs",
                       note=f"({n_named} named, {dg['pubchem_cid'].notna().sum()} with CID)")


if __name__ == "__main__":
    drug_metadata(no_cache="--no-cache" in sys.argv)
