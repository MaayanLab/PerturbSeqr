"""
Drug Repurposing Hub. Helpers for using the data (the consumer half of this source).

build.py produces drug_repurposing_hub.parquet (one row per pert_iname: moa, target, clinical_phase,
disease_area, indication, pubchem_cid, inchi_key, smiles). These helpers load it and join it onto a
dataset's drug table. Imported by per-dataset metadata.py builders.
"""
import re
from functools import lru_cache
from pathlib import Path

import pandas as pd

PARQUET = Path(__file__).parent / "intermediate" / "drug_repurposing_hub.parquet"

# Salt forms get base compound MoA.
_SALT_WORDS = [
    "dihydrochloride", "hydrochloride", "hydrobromide", "hydroiodide", "hydrofluoride",
    "methanesulfonate", "benzenesulfonate", "mesylate", "besylate", "tosylate", "esylate",
    "napsylate", "isethionate", "edisylate", "xinafoate", "teoclate",
    "hemisulfate", "bisulfate", "sulfate", "sulphate", "diphosphate", "phosphate",
    "bitartrate", "tartrate", "maleate", "hemifumarate", "fumarate", "succinate", "citrate",
    "oxalate", "malonate", "mandelate", "malate", "aspartate", "glutamate", "gluconate",
    "trifluoroacetate", "acetate", "formate", "propionate", "lactate", "pamoate", "embonate",
    "palmitate", "stearate", "oleate", "laurate", "valerate", "decanoate", "enanthate", "cypionate",
    "nitrate", "bromide", "chloride", "iodide", "fluoride",
    "disodium", "sodium", "dipotassium", "potassium", "calcium", "magnesium", "zinc", "lithium",
    "ammonium", "meglumine", "choline", "tromethamine", "benzathine", "hydrogen",
    "sesquihydrate", "hemihydrate", "monohydrate", "dihydrate", "trihydrate", "hydrate", "anhydrous", "salt",
]
_ACID_ADJ = [
    "hydrochloric", "sulfuric", "sulphuric", "phosphoric", "nitric", "acetic", "citric", "tartaric",
    "maleic", "fumaric", "succinic", "malic", "mandelic", "trifluoroacetic", "methanesulfonic",
    "benzenesulfonic", "oxalic", "lactic", "pamoic",
]
_W = "|".join(_SALT_WORDS)
_STEREO_RE = re.compile(r"^(?:\(\s*[0-9RSEZ±+\-,/\s]+\)\s*-?\s*|rac-|cis-|trans-)+", re.I)
_PAREN_SALT_RE = re.compile(r"\s*\(\s*(?:" + _W + r")\s*\)\s*$", re.I)
_SALT_RE = re.compile(r"[\s,]+(?:" + _W + r")\s*$", re.I)
_ACID_RE = re.compile(r"[\s,]+(?:" + "|".join(_ACID_ADJ) + r")\s+acid\s*$", re.I)


def strip_variant(name: str) -> str:
    """Strip leading stereo descriptors and trailing salt/hydrate counterions to the base compound name."""
    s = _STEREO_RE.sub("", str(name).strip()).strip()
    prev = None
    while s != prev:                                          # iterate: "... hydrochloride hydrate" needs two passes
        prev = s
        s = _SALT_RE.sub("", _ACID_RE.sub("", _PAREN_SALT_RE.sub("", s)).strip()).strip()
    return s.strip(" -,")


@lru_cache(maxsize=1)
def load() -> pd.DataFrame:
    """The merged DRH table (keyed by pert_iname). Raises if build.py hasn't run."""
    if not PARQUET.exists():
        raise FileNotFoundError(f"DRH parquet missing: {PARQUET}\n")
    return pd.read_parquet(PARQUET)


def _clean_cid(v) -> str:
    s = str(v).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return "" if s in ("", "nan", "None", "<NA>") else s


def join_drh(df: pd.DataFrame, *, cid_col: str = "pubchem_cid", name_col: str = "drug_name",
             inchi_col: str | None = None) -> pd.DataFrame:
    """Add curated DRH columns (drh_moa, drh_target, drh_clinical_phase, drh_fda_approved,
    drh_disease_area, drh_indication, drh_inchi_key, drh_matched_on, moa_inherited_from) to a dataset's
    drug table, matching pubchem_cid → inchi_key → name. A salt/stereo variant with no MoA backfills its
    empty pharmacology fields from its base compound (drh_matched_on='variant_base', moa_inherited_from=base)."""
    by_cid, by_inchi, by_name = {}, {}, {}
    for rec in load().to_dict("records"):
        if (cid := _clean_cid(rec.get("pubchem_cid"))):
            by_cid.setdefault(cid, rec)
        if (ik := (rec.get("inchi_key") or "").strip()):
            by_inchi.setdefault(ik, rec)
        by_name.setdefault(str(rec.get("pert_iname", "")).lower(), rec)

    out = {k: [] for k in ("drh_moa", "drh_target", "drh_clinical_phase", "drh_fda_approved",
                           "drh_disease_area", "drh_indication", "drh_inchi_key", "drh_matched_on",
                           "moa_inherited_from")}
    for _, row in df.iterrows():
        cid = _clean_cid(row.get(cid_col))
        ik = str(row.get(inchi_col, "")).strip() if inchi_col else ""
        name = str(row.get(name_col, ""))
        key = name.lower()
        if cid and cid in by_cid:
            rec, matched = by_cid[cid], "pubchem_cid"
        elif ik and ik in by_inchi:
            rec, matched = by_inchi[ik], "inchi_key"
        elif key in by_name:
            rec, matched = by_name[key], "name"
        else:
            rec, matched = {}, ""
        base_rec, inherited = {}, ""
        if not str(rec.get("moa") or "").strip():              # no MoA yet → inherit the base compound's (salt/stereo variant)
            base = strip_variant(name).lower()
            if base and base != key and (b := by_name.get(base)) and str(b.get("moa") or "").strip():
                base_rec, inherited = b, b.get("pert_iname", "")
                matched = matched or "variant_base"
        fld = lambda k: (rec.get(k) or base_rec.get(k) or "")  # variant's own value wins; base only backfills empties
        phase = fld("clinical_phase")
        out["drh_moa"].append(fld("moa"))
        out["drh_target"].append(fld("target"))
        out["drh_clinical_phase"].append(phase)
        out["drh_fda_approved"].append(("yes" if str(phase).lower() == "launched" else "no") if matched else "")
        out["drh_disease_area"].append(fld("disease_area"))
        out["drh_indication"].append(fld("indication"))
        out["drh_inchi_key"].append(rec.get("inchi_key", "") or "")   # the variant's own DRH structure, never the base's
        out["drh_matched_on"].append(matched)
        out["moa_inherited_from"].append(inherited)
    return df.assign(**{k: pd.Series(v, index=df.index) for k, v in out.items()})
