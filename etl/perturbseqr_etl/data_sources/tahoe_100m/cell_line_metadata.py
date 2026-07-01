"""
Tahoe-100M cell-line metadata. One row per cell line.

Tahoe provides cell-line table on HuggingFace. We keep identity columns and deduplicate on cell line IDs.

Source:  https://huggingface.co/datasets/tahoebio/Tahoe-100M/tree/main/metadata
         columns: cell_name, Cell_ID_DepMap, Cell_ID_Cellosaur, Organ, Driver_Gene_Symbol,
                  Driver_VarZyg, Driver_VarType, Driver_ProtEffect_or_CdnaEffect,
                  Driver_Mech_InferDM, Driver_GeneType_DM
Output:  tahoe-100m-cell_line_metadata.parquet / .csv
         columns: cell_name, Cell_ID_Cellosaur, cellosaurus_name, Cell_ID_DepMap, depmap_name, Organ

Usage: uv run --project etl python -m perturbseqr_etl.data_sources.tahoe_100m.cell_line_metadata
"""
import sys
from pathlib import Path

import pandas as pd

from perturbseqr_etl.data_sources import CACHE_DIR
from perturbseqr_etl.dataloader import download_to
from perturbseqr_etl.metadata import cell_line as cell_meta, write_table

HF_META = "https://huggingface.co/datasets/tahoebio/Tahoe-100M/resolve/main/metadata"
OUT_DIR = Path(__file__).parent / "intermediate"
OUT_NAME = "tahoe-100m-cell_line_metadata"

CELL_LINE_COLS = ["cell_name", "Cell_ID_DepMap", "Cell_ID_Cellosaur", "Organ"]
# cell_name is Tahoe's own (original) name; add each registry's display name alongside the ids Tahoe ships.
OUT_COLS = ["cell_name", "Cell_ID_Cellosaur", "cellosaurus_name", "Cell_ID_DepMap", "depmap_name", "Organ"]

def cell_line_metadata(no_cache: bool = False) -> Path:
    cl = pd.read_parquet(download_to(f"{HF_META}/cell_line_metadata.parquet",
                                     CACHE_DIR / "tahoe_cell_line_metadata.parquet", no_cache=no_cache))
    cl = cl[CELL_LINE_COLS].drop_duplicates().reset_index(drop=True)
    names = [cell_meta.enrich_ids(cvcl, model, cache_dir=CACHE_DIR) for cvcl, model in
             zip(cl["Cell_ID_Cellosaur"].fillna("").astype(str), cl["Cell_ID_DepMap"].fillna("").astype(str))]
    cl["cellosaurus_name"] = [n["cellosaurus_name"] for n in names]
    cl["depmap_name"] = [n["depmap_name"] for n in names]
    cl = cl[OUT_COLS].fillna("")                                  # Tahoe ships some NaN ids → "" for consistent filtering
    return write_table(cell_meta.with_role(cl), OUT_DIR, OUT_NAME, label="cell lines")

if __name__ == "__main__":
    cell_line_metadata(no_cache="--no-cache" in sys.argv)
