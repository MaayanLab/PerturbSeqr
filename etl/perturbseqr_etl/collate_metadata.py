"""
Collate per-dataset metadata into overall PerturbSeqr tables. Merges by stable ID (PubChem CID /
Cellosaurus+DepMap / Ensembl), name only as a last-resort fallback; gene_target identity also includes
perturbation_type + method. Each row gets `datasets` (which datasets it appears in) and `gmt_names`
(every distinct surface form it appears under in GMTs, so anything a user sees stays findable).

Usage: uv run --project etl python -m perturbseqr_etl.collate_metadata
"""
import sys
from pathlib import Path

import pandas as pd

from perturbseqr_etl.data_sources import DATA_SOURCES_DIR, METADATA_DIR
from perturbseqr_etl.metadata import write_table

KINDS = ("drug", "cell_line", "gene_target")

# Shared output columns per kind; first is the display/sort column (`datasets`/`n_datasets` appended).
COMMON_COLS = {
    "drug": ["name", "pubchem_cid", "pubchem_title", "drh_moa", "drh_target", "drh_clinical_phase",
             "drh_fda_approved", "drh_disease_area", "drh_indication", "drh_inchi_key", "drh_matched_on"],
    "cell_line": ["cell_name", "role", "Cell_ID_Cellosaur", "cellosaurus_name", "Cell_ID_DepMap",
                  "depmap_name", "Organ"],
    "gene_target": ["gene_symbol", "perturbation_type", "method", "ensembl_id", "ncbi_gene_id", "hgnc_id",
                    "uniprot_ids", "name", "hgnc_alias_symbol", "hgnc_prev_symbol", "ncbi_synonyms"],
}

# Identity key: coalesce to the first non-empty (prefix, column); prefix keeps id spaces from colliding.
KEY_PRECEDENCE = {
    "drug": [("cid", "pubchem_cid"), ("inchi", "drh_inchi_key"), ("name", "name")],
    "cell_line": [("cvcl", "Cell_ID_Cellosaur"), ("depmap", "Cell_ID_DepMap"), ("name", "cell_name")],
    "gene_target": [("ens", "ensembl_id"), ("ncbi", "ncbi_gene_id"), ("hgnc", "hgnc_id"), ("sym", "gene_symbol")],
}
# Appended to the identity so perturbation variants of one gene stay distinct (KO vs OE = two items).
EXTRA_KEY = {"gene_target": ["perturbation_type"]}
MULTI_VALUE = {"gene_target": {"method": "|"}}   # sorted-unique join within each identity group
# Surface form per kind, collected (|-joined) into `gmt_names` so anything a user sees in a GMT stays findable.
SURFACE_COL = {"drug": "name", "cell_line": "cell_name", "gene_target": "gene_symbol"}
# Backfill a blank strong ID from a weaker signal (weak_col, strong_col, casefold); drugs try InChIKey→CID then name→CID.
BACKFILL = {"drug": [("drh_inchi_key", "pubchem_cid", None), ("name", "pubchem_cid", str.lower)],
            "gene_target": [("gene_symbol", "ensembl_id", str.upper)]}


def _norm(s: pd.Series) -> pd.Series:
    """As a stripped pandas string Series ('' for missing)."""
    return s.astype("string").fillna("").str.strip()


def _load_one(path: Path, kind: str) -> pd.DataFrame:
    ds = path.name[: -len(f"-{kind}_metadata.parquet")]
    df = pd.read_parquet(path)
    if kind == "drug":
        name_cols = [c for c in df.columns if c.endswith("_drug_name")]
        assert len(name_cols) == 1, f"{path.name}: expected one *_drug_name column, got {name_cols}"
        df = df.rename(columns={name_cols[0]: "name"})
        df["pubchem_cid"] = pd.to_numeric(df["pubchem_cid"], errors="coerce").astype("Int64")
    if kind == "cell_line" and "role" not in df.columns:   # lincs cp/xpr omit it
        df["role"] = [("cell_line" if (c or m) else "cell_type")
                      for c, m in zip(_norm(df["Cell_ID_Cellosaur"]), _norm(df["Cell_ID_DepMap"]))]
    df = df[[c for c in COMMON_COLS[kind] if c in df.columns]].copy()
    df["_dataset"] = ds
    return df


def _backfill(df: pd.DataFrame, kind: str) -> tuple[pd.DataFrame, int, int]:
    """Fill blank strong IDs from resolved weak→strong maps (drop weak keys mapping to >1 strong)."""
    df = df.copy()
    n_fill = n_amb = 0
    for weak_col, strong_col, casefold in BACKFILL.get(kind, []):
        strong = _norm(df[strong_col])
        weak = _norm(df[weak_col])
        if casefold:
            weak = weak.map(lambda s: casefold(s) if s else "")
        mapping: dict[str, str] = {}
        ambiguous: set[str] = set()
        for w, s in zip(weak[(strong != "") & (weak != "")], strong[(strong != "") & (weak != "")]):
            if w in ambiguous:
                continue
            if mapping.get(w, s) != s:
                del mapping[w]; ambiguous.add(w)
            else:
                mapping[w] = s
        filled = strong.copy()
        for i in df.index[(strong == "") & weak.isin(mapping.keys())]:
            filled.at[i] = mapping[weak.at[i]]; n_fill += 1
        df[strong_col] = filled
        n_amb += len(ambiguous)
    return df, n_fill, n_amb


def _build_key(df: pd.DataFrame, kind: str) -> pd.Series:
    key = pd.Series("", index=df.index, dtype="string")
    for prefix, col in KEY_PRECEDENCE[kind]:
        val = _norm(df[col])
        if prefix == "name":
            val = val.str.lower()
        elif prefix == "sym":
            val = val.str.upper()
        key = key.mask((key == "") & (val != ""), prefix + ":" + val)
    for col in EXTRA_KEY.get(kind, []):
        key = key + "::" + _norm(df[col])
    return key


def collate(kind: str, *, data_sources_dir: Path = DATA_SOURCES_DIR, out_dir: Path = METADATA_DIR) -> Path:
    files = sorted(data_sources_dir.glob(f"**/intermediate/*-{kind}_metadata.parquet"))
    if not files:
        raise FileNotFoundError(
            f"No {kind} metadata under {data_sources_dir}. Run the per-dataset metadata builders first.")
    df = pd.concat([_load_one(p, kind) for p in files], ignore_index=True)
    n_in = len(df)
    df, n_fill, n_amb = _backfill(df, kind)
    df["_key"] = _build_key(df, kind)
    df["_surface"] = _norm(df[SURFACE_COL[kind]])          # every GMT surface form, for findability

    value_cols = COMMON_COLS[kind]
    for c in value_cols:                                   # blank → NA so groupby.first() = first non-empty
        s = _norm(df[c]) if c in df.columns else pd.Series("", index=df.index, dtype="string")
        df[c] = s.where(s != "", pd.NA)
    df["_richness"] = df[value_cols].notna().sum(axis=1)   # richest occurrence wins (deterministic)
    df = df.sort_values(["_key", "_richness", "_dataset"], ascending=[True, False, True], kind="stable")

    g = df.groupby("_key", sort=True)
    mv = MULTI_VALUE.get(kind, {})
    out = g[[c for c in value_cols if c not in mv]].first()
    for col, sep in mv.items():                            # sorted-unique non-empty (e.g. method)
        out[col] = g[col].agg(lambda s: sep.join(sorted({x for x in s.dropna()})))
    out["gmt_names"] = g["_surface"].agg(lambda s: "|".join(sorted({x for x in s if x})))
    out["datasets"] = g["_dataset"].agg(lambda s: ",".join(sorted(set(s))))
    out["n_datasets"] = g["_dataset"].nunique()
    out = out.reset_index(drop=True)

    for c in value_cols:
        out[c] = out[c].fillna("")
    if kind == "drug":
        out["pubchem_cid"] = pd.to_numeric(out["pubchem_cid"].replace("", pd.NA), errors="coerce").astype("Int64")
    out = out[value_cols + ["gmt_names", "datasets", "n_datasets"]].sort_values(value_cols[0], kind="stable").reset_index(drop=True)

    note = f"from {len(files)} datasets, {n_in} rows; backfilled {n_fill}, ambiguous-dropped {n_amb}"
    return write_table(out, out_dir, f"perturbseqr-{kind}_metadata", label=kind, note=f"({note})")


def main() -> None:
    for kind in KINDS:
        collate(kind)


if __name__ == "__main__":
    main()
