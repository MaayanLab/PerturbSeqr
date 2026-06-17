#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["pandas", "pyarrow"]
# ///
"""
Drug Repurposing Hub — helpers for using the data (the consumer half of this source).

build.py produces drug_repurposing_hub.parquet (one row per pert_iname: moa, target, clinical_phase,
disease_area, indication, pubchem_cid, inchi_key, smiles). These helpers load it and join it onto a
dataset's drug table. Imported by per-dataset metadata.py builders.
"""
from functools import lru_cache
from pathlib import Path

import pandas as pd

PARQUET = Path(__file__).parent / "intermediate" / "drug_repurposing_hub.parquet"


@lru_cache(maxsize=1)
def load() -> pd.DataFrame:
    """The merged DRH table (keyed by pert_iname). Raises if build.py hasn't run."""
    if not PARQUET.exists():
        raise FileNotFoundError(
            f"DRH parquet missing: {PARQUET}\n"
            f"Build it: uv run db/etl/inputs/metadata/drug_repurposing_hub/build.py"
        )
    return pd.read_parquet(PARQUET)


def _clean_cid(v) -> str:
    s = str(v).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return "" if s in ("", "nan", "None", "<NA>") else s


def join_drh(df: pd.DataFrame, *, cid_col: str = "pubchem_cid", name_col: str = "drug_name",
             inchi_col: str | None = None) -> pd.DataFrame:
    """Add curated DRH columns (drh_moa, drh_target, drh_clinical_phase, drh_fda_approved,
    drh_disease_area, drh_indication, drh_inchi_key, drh_matched_on) to a dataset's drug table,
    matching pubchem_cid → inchi_key → name. Existing columns are never overwritten; drh_matched_on
    records how each row matched (or '' if unmatched)."""
    by_cid, by_inchi, by_name = {}, {}, {}
    for rec in load().to_dict("records"):
        if (cid := _clean_cid(rec.get("pubchem_cid"))):
            by_cid.setdefault(cid, rec)
        if (ik := (rec.get("inchi_key") or "").strip()):
            by_inchi.setdefault(ik, rec)
        by_name.setdefault(str(rec.get("pert_iname", "")).lower(), rec)

    out = {k: [] for k in ("drh_moa", "drh_target", "drh_clinical_phase", "drh_fda_approved",
                           "drh_disease_area", "drh_indication", "drh_inchi_key", "drh_matched_on")}
    for _, row in df.iterrows():
        cid = _clean_cid(row.get(cid_col))
        ik = str(row.get(inchi_col, "")).strip() if inchi_col else ""
        name = str(row.get(name_col, "")).lower()
        if cid and cid in by_cid:
            rec, matched = by_cid[cid], "pubchem_cid"
        elif ik and ik in by_inchi:
            rec, matched = by_inchi[ik], "inchi_key"
        elif name in by_name:
            rec, matched = by_name[name], "name"
        else:
            rec, matched = {}, ""
        out["drh_moa"].append(rec.get("moa", "") or "")
        out["drh_target"].append(rec.get("target", "") or "")
        out["drh_clinical_phase"].append(rec.get("clinical_phase", "") or "")
        out["drh_fda_approved"].append(("yes" if str(rec.get("clinical_phase", "")).lower() == "launched" else "no") if matched else "")
        out["drh_disease_area"].append(rec.get("disease_area", "") or "")
        out["drh_indication"].append(rec.get("indication", "") or "")
        out["drh_inchi_key"].append(rec.get("inchi_key", "") or "")
        out["drh_matched_on"].append(matched)
    return df.assign(**{k: pd.Series(v, index=df.index) for k, v in out.items()})
