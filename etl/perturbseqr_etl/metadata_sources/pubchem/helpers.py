"""
PubChem. Helpers for using the source (the consumer half).

pubchem.py wraps pubchempy (CID resolution + CID→properties/synonyms). add_pubchem joins PubChem's
preferred Title (and, optionally, a synonym list) onto a dataset's drug table by CID. Imported by
per-dataset metadata.py builders.
"""
import pandas as pd

from perturbseqr_etl.metadata import warn_unmatched


def _clean_cid(v) -> str:
    s = str(v).removesuffix(".0").strip()
    return "" if s in ("", "nan", "None", "<NA>") else s


def resolve_cids(items) -> dict:
    """Resolve compounds to PubChem CIDs. `items` is an iterable of (key, inchikey, smiles); each key
    maps to a CID (int) matched on InChIKey first, then canonical SMILES for the InChIKey misses.
    Keys with no hit are absent from the result. Centralizes the InChIKey→SMILES cascade."""
    from perturbseqr_etl.metadata_sources.pubchem import pubchem   # lazy: pubchempy is an optional source dep
    items = list(items)
    ik2cid = pubchem.inchikeys_to_cids(sorted({ik for _, ik, _ in items if ik}))
    out: dict = {}
    smi_need: dict = {}
    for key, ik, smi in items:
        if ik and (c := ik2cid.get(ik)):
            out[key] = c
        elif smi:
            smi_need[key] = smi
    if smi_need:
        smi2cid = pubchem.smiles_to_cids(sorted(set(smi_need.values())))
        for key, smi in smi_need.items():
            if (c := smi2cid.get(smi)):
                out[key] = c
    return out


def add_pubchem(df: pd.DataFrame, *, cid_col: str = "pubchem_cid", name_col: str = "pubchem_title",
                syn_col: str = "pubchem_synonyms", synonyms: bool = True,
                limit: int | None = None) -> pd.DataFrame:
    """Add the PubChem `Title` (the compound's preferred display name); with `synonyms=True` also add a
    '|'-joined synonym list. Rows without a resolvable CID get ''. `limit` caps synonyms per drug."""
    from perturbseqr_etl.metadata_sources.pubchem import pubchem   # lazy: pubchempy is an optional source dep
    cids = sorted({int(c) for v in df[cid_col] if (c := _clean_cid(v))})
    props = pubchem.cids_to_properties(cids)                              # {cid: {"Title", "SMILES", ...}}
    syns = pubchem.cids_to_synonyms(cids, limit=limit) if synonyms else {}  # {cid: [synonyms]}

    names, syn_out, unmatched = [], [], []
    for v in df[cid_col]:
        ci = int(c) if (c := _clean_cid(v)) else None
        title = props.get(ci, {}).get("Title", "") if ci else ""
        syn = syns.get(ci) if ci else None
        names.append(title)
        syn_out.append("|".join(syn) if syn else "")
        if not (title or syn):
            unmatched.append(v)
    warn_unmatched(unmatched, len(df), entity="drug→PubChem")
    cols = {name_col: pd.Series(names, index=df.index)}
    if synonyms:
        cols[syn_col] = pd.Series(syn_out, index=df.index)
    return df.assign(**cols)
