"""Drug metadata builder. Distinct GMT drug names → PubChem CID/Title → Drug Repurposing Hub."""
from pathlib import Path

import pandas as pd

from perturbseqr_etl.metadata_sources.pubchem.helpers import add_pubchem
from perturbseqr_etl.metadata_sources.drug_repurposing_hub.helpers import join_drh, strip_variant


def inherit_variant_moa(df, *, name_col, value_cols, source=None, source_name_col=None,
                        provenance_col="moa_inherited_from"):
    """Salt forms get base compound MoA for dataset-specific columns (lincs_moa, moabox_moa). A variant with
    empty value_cols backfills them from its base compound's row, found via strip_variant in `source`
    (default: df itself / sibling rows). Records the base in provenance_col if not already set."""
    src = df if source is None else source
    src_name = source_name_col or name_col
    s = lambda v: "" if v is None else str(v).strip()
    index = {}
    for rec in src.to_dict("records"):
        if (k := s(rec.get(src_name)).lower()) and k not in index:
            index[k] = rec
    vals = {c: list(df[c]) for c in value_cols}
    prov = list(df[provenance_col]) if provenance_col in df.columns else [""] * len(df)
    n = 0
    for i, rec in enumerate(df.to_dict("records")):
        if all(s(rec.get(c)) for c in value_cols):
            continue
        nm = s(rec.get(name_col))
        base = strip_variant(nm).lower()
        if not base or base == nm.lower() or not (hit := index.get(base)):
            continue
        filled = False
        for c in value_cols:
            if not s(rec.get(c)) and s(hit.get(c)):
                vals[c][i] = hit.get(c); filled = True
        if filled:
            n += 1
            if not s(prov[i]):
                prov[i] = s(hit.get(src_name))
    print(f"  variant MoA inherited ({'/'.join(value_cols)}): {n}")
    return df.assign(**{c: vals[c] for c in value_cols}, **{provenance_col: prov})


def build_drug_metadata(gmt_path, out_dir, *, drug_col: str, cache_dir: Path, out_name: str | None = None):
    from perturbseqr_etl.gmt import distinct_term_field             
    from perturbseqr_etl.metadata import write_table
    from perturbseqr_etl.metadata_sources.pubchem import pubchem
    gmt_path = Path(gmt_path)
    if not gmt_path.exists():
        raise FileNotFoundError(f"GMT not found: {gmt_path}\n  Run the dataset's gmt.py first.")
    out_name = out_name or gmt_path.name.removesuffix(".gmt.gz") + "-drug_metadata"

    names = sorted(distinct_term_field(gmt_path, 0))
    cids = pubchem.names_to_cids(names)
    dg = pd.DataFrame({drug_col: names})
    dg["pubchem_cid"] = pd.Series([cids.get(n) for n in names], dtype="Int64")
    print(f"  name→CID: {dg['pubchem_cid'].notna().sum()}/{len(dg)} resolved")

    dg = add_pubchem(dg, cid_col="pubchem_cid", name_col="pubchem_title", synonyms=False)
    dg = join_drh(dg, cid_col="pubchem_cid", name_col=drug_col)
    first = [drug_col, "pubchem_title", "pubchem_cid"]
    dg = dg[first + [c for c in dg.columns if c not in first]]
    n_drh = (dg["drh_matched_on"] != "").sum()
    return write_table(dg, out_dir, out_name, label="drugs", note=f"({n_drh} matched to Drug Repurposing Hub)")
