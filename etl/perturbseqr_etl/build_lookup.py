"""
Build the static drug lookup JSON the frontend fetches (public/metadata/drug_lookup.json) from the
collated drug metadata. 
"""
import json
import sys
from pathlib import Path

import pandas as pd

from perturbseqr_etl.data_sources import METADATA_DIR

PUBLIC_METADATA = METADATA_DIR.parent.parent / "public" / "metadata"   # Next serves public/ at site root


def _drug_info(row) -> dict:
    cid = "" if pd.isna(row.pubchem_cid) else str(int(row.pubchem_cid))
    moa, target = row.drh_moa or "", row.drh_target or ""
    return {
        "cid": cid,
        "moa": moa,
        "target": target,
        "fda_approved": row.drh_fda_approved == "yes",
        "clinical_phase": row.drh_clinical_phase or "",
        "name": row.pubchem_title or row.name or "",
        "source": "drug_repurposing_hub" if row.drh_matched_on else "pubchem",
        "moa_source": "drug_repurposing_hub" if moa else "",
        "source_url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}" if cid else "",
    }


def build_drug_lookup() -> Path:
    df = pd.read_parquet(METADATA_DIR / "perturbseqr-drug_metadata.parquet")
    # Every distinct surface form in gmt_names becomes a lookup key, so no name is dropped. When one
    # name maps to several CIDs, the entry seen in the most datasets wins.
    df = df.sort_values(["n_datasets", "pubchem_cid"], ascending=[False, True], na_position="last")
    lookup: dict[str, dict] = {}
    for row in df.itertuples(index=False):
        info = _drug_info(row)
        for surface in str(row.gmt_names).split("|"):
            if (key := surface.strip().lower()) and key not in lookup:
                lookup[key] = info
    PUBLIC_METADATA.mkdir(parents=True, exist_ok=True)
    out = PUBLIC_METADATA / "drug_lookup.json"
    out.write_text(json.dumps(lookup))
    print(f"drug_lookup.json: {len(lookup)} keys from {len(df)} drugs -> {out}")
    return out


def main() -> None:
    build_drug_lookup()


if __name__ == "__main__":
    main()
