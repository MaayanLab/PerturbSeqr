"""Shared LINCS cell-line resolver for cp/ + xpr/ cell_line_metadata.py."""
from pathlib import Path

import pandas as pd

from perturbseqr_etl.data_sources import CACHE_DIR
from perturbseqr_etl.gmt import distinct_term_field
from perturbseqr_etl.metadata import cell_line as cell_meta, warn_unmatched, write_table

CELLINFO = CACHE_DIR / "cellinfo_beta.txt"
# Clue.io cellinfo column -> our column (cell_iname is the source/original name we keep as cell_name).
_COLS = {"cell_iname": "cell_name", "cellosaurus_id": "Cell_ID_Cellosaur",
         "cell_lineage": "Organ", "primary_disease": "primary_disease", "subtype": "subtype"}


def resolve(cells: set[str], cache_dir: Path = CACHE_DIR) -> pd.DataFrame:
    """Resolve a set of GMT cell-line names to one row per cell: the original (source) name, the
    Cellosaurus + DepMap ids and their display names, and Organ. Unresolvable cells are kept as-is."""
    info = pd.read_csv(CELLINFO, sep="\t", dtype=str, keep_default_na=False)
    by_name = {r["cell_name"]: r for r in info[list(_COLS)].rename(columns=_COLS).to_dict("records")}

    rows, unmatched = [], []
    for cell in sorted(cells):
        base = cell.split(".", 1)[0]                            # strip LINCS clone/engineered suffix
        rec = by_name.get(cell) or by_name.get(base) or {}      # Clue.io cell registry: exact, then base line
        cvcl = rec.get("Cell_ID_Cellosaur", "")
        organ = rec.get("Organ", "")
        model = ""
        # Engineered variants (e.g. HAP1.CDK4) have their own Cellosaurus subline
        sub = cell_meta.resolve(cell, cache_dir=cache_dir) if cell != base else None
        if sub and sub["cvcl"] and sub["cvcl"] != cvcl:
            cvcl, model, organ = sub["cvcl"], sub["model"], sub["organ"] or organ
        elif not cvcl and (hit := cell_meta.resolve(base, cache_dir=cache_dir)):   # registry gap → our resolver
            cvcl, model, organ = hit["cvcl"], hit["model"], hit["organ"] or organ
        ids = cell_meta.enrich_ids(cvcl, model, cache_dir=cache_dir)   # cross-ref + Cellosaurus/DepMap display names
        cvcl, model = ids["cvcl"], ids["model"]
        if not (cvcl or model):
            unmatched.append(cell)
        rows.append({"cell_name": cell,                                            # original (Clue.io) name, kept as-is
                     "Cell_ID_Cellosaur": cvcl, "cellosaurus_name": ids["cellosaurus_name"],
                     "Cell_ID_DepMap": model, "depmap_name": ids["depmap_name"],
                     "Organ": organ, "primary_disease": rec.get("primary_disease", ""),
                     "subtype": rec.get("subtype", "")})
    df = pd.DataFrame(rows)
    warn_unmatched(unmatched, len(df), entity="cell line")
    return df


def build(gmt_path: Path, out_dir: Path, out_name: str) -> Path:
    """Read a GMT's cell lines, resolve them, write <out_name>.{parquet,csv} to out_dir."""
    if not gmt_path.exists():
        raise FileNotFoundError(f"GMT intermediate missing: {gmt_path}\n  Run the GMT builder first.")
    df = cell_meta.with_role(resolve(distinct_term_field(gmt_path, 1)))
    n_cvcl = (df["Cell_ID_Cellosaur"] != "").sum()
    n_dep = (df["Cell_ID_DepMap"] != "").sum()
    return write_table(df, out_dir, out_name, label="cell lines",
                       note=f"in GMT ({n_cvcl} Cellosaurus, {n_dep} DepMap)")
