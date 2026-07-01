"""
Tahoe-100M. GMT from HuggingFace pseudobulk DESeq2.

pseudobulk DE table → top-100 up/dn per condition → ::-format
Source:    https://huggingface.co/datasets/tahoebio/Tahoe-100M  (pseudobulk_differential_expression)

Term shape:    {drug}::{cell_line}::{cell_type}::24h::{conc}uM up|down

Usage: uv run --project etl python -m perturbseqr_etl.data_sources.tahoe_100m.gmt [--no-cache]
"""

import sys
import json
from pathlib import Path
from collections import defaultdict

import polars as pl
from huggingface_hub import hf_hub_download
from tqdm import tqdm

from perturbseqr_etl.data_sources import CACHE_DIR, METADATA_DIR, TERM_DELIMITER
from perturbseqr_etl.gmt import top_up_down, write_up_down_gmt
from perturbseqr_etl.metadata.gene import non_protein_coding_genes

REPO_ID = "tahoebio/Tahoe-100M"
HF_RESOLVE = f"https://huggingface.co/datasets/{REPO_ID}/resolve/main"
HERE = Path(__file__).parent
INTERMEDIATE = HERE / "intermediate" / "tahoe-100m.gmt.gz"
TAHOE_ORGAN_PATH = METADATA_DIR / "tahoe_cell_organ.json"

# Fixed HF snapshot of 1026 DE pseudobulk shards (the filename even embeds "-of-01026"), so we derive
# the list rather than hit the repo-listing API every run. Bump if upstream re-shards.
# https://huggingface.co/datasets/tahoebio/Tahoe-100M/tree/main/metadata/pseudobulk_differential_expression
N_DE_SHARDS = 1026
DE_FILES = [f"metadata/pseudobulk_differential_expression/train-{i:05d}-of-{N_DE_SHARDS:05d}.parquet"
            for i in range(N_DE_SHARDS)]


def load_cell_line_metadata() -> dict:
    print("Loading cell-line metadata...")
    path = hf_hub_download(repo_id=REPO_ID, filename="metadata/cell_line_metadata.parquet", repo_type="dataset")
    df = pl.read_parquet(path)
    out: dict = {}
    for row in df.iter_rows(named=True):
        cell_name = row.get("cell_name", "")
        for col in ["Cell_ID_Cellosaur", "Cell_ID_DepMap", "Cell_Name_Vevo"]:
            if col in row and row[col]:
                out[row[col]] = cell_name or row.get("Cell_Name_Vevo", "")
    print(f"  {len(out):,} cell-line ID mappings")
    return out


def process_parquet_file(local_path, drop_symbols: set, cell_line_dict: dict) -> dict:
    lf = pl.scan_parquet(local_path).filter(
        pl.col("drug").is_not_null()
        & ~pl.col("drug").str.to_uppercase().str.contains("DMSO")
        & pl.col("concentration").is_not_null()
        & (pl.col("concentration") > 0)
        & pl.col("padj").is_not_null()
        & (pl.col("padj") <= 0.05)
        & pl.col("gene_name").is_not_null()
        & pl.col("log2FoldChange").is_not_null()
    )
    df = lf.select(["drug", "concentration", "Cell_Name_Vevo", "gene_name", "log2FoldChange"]).collect()
    if len(df) == 0:
        return {}
    df = df.with_columns(pl.col("gene_name").str.to_uppercase().alias("gene_upper")).filter(
        (pl.col("gene_upper") != "") & ~pl.col("gene_upper").is_in(list(drop_symbols))
    )
    if len(df) == 0:
        return {}
    df = df.with_columns([
        (pl.col("concentration").cast(pl.Utf8) + "uM").alias("conc_str"),
        pl.col("Cell_Name_Vevo").replace(cell_line_dict, default=pl.col("Cell_Name_Vevo")).alias("cell_name"),
    ]).with_columns(
        # Triple-pipe so we can split safely (drug names may contain underscores).
        (pl.col("drug") + "|||" + pl.col("conc_str") + "|||" + pl.col("cell_name")).alias("condition")
    )
    out: dict = defaultdict(list)
    for condition, gene, log2fc in df.select(["condition", "gene_upper", "log2FoldChange"]).iter_rows():
        out[condition].append((gene, log2fc))
    return out


def gmt(no_cache: bool = False) -> Path:
    """Stage A+B: build the canonical intermediate GMT from the HuggingFace pseudobulk DE table.
    Cache-guarded (skips the ~hours run if the intermediate exists). Returns the intermediate path."""
    if INTERMEDIATE.exists() and not no_cache:
        print(f"Intermediate already exists: {INTERMEDIATE}\nUse --no-cache to regenerate.")
        return INTERMEDIATE

    drop_symbols = non_protein_coding_genes("Mammalia/Homo_sapiens", CACHE_DIR)   # Stage-C drop set (keeps unknowns)
    print(f"  {len(drop_symbols):,} non-protein-coding symbols to drop in the early scan filter")
    cell_line_dict = load_cell_line_metadata()
    organ_map = json.loads(TAHOE_ORGAN_PATH.read_text()) if TAHOE_ORGAN_PATH.exists() else {}

    all_results: dict = defaultdict(list)
    print(f"\nProcessing {len(DE_FILES)} parquet files...")
    for filename in tqdm(DE_FILES, desc="Files"):
        local = hf_hub_download(repo_id=REPO_ID, filename=filename, repo_type="dataset")
        for cond, genes in process_parquet_file(local, drop_symbols, cell_line_dict).items():
            all_results[cond].extend(genes)
    print(f"\n{len(all_results):,} conditions, {sum(len(v) for v in all_results.values()):,} significant pairs")

    print("\nBuilding top-100 up/dn gene sets per condition...")
    up_sets: dict = {}
    down_sets: dict = {}
    for condition, pairs in tqdm(all_results.items(), desc="Conditions"):
        up, down = top_up_down(pairs)
        if up:
            up_sets[condition] = up
        if down:
            down_sets[condition] = down

    def _term(condition: str) -> str | None:
        try:
            drug, conc, cell_line = condition.split("|||", 2)
        except ValueError:
            return None
        return TERM_DELIMITER.join([drug, cell_line, organ_map.get(cell_line, ""), "24h", conc])

    n = write_up_down_gmt(up_sets, down_sets, _term, INTERMEDIATE)
    print(f"  {INTERMEDIATE}: {n} terms")
    print("\nDone. Stage C (standardize: PC filter + alias rename → data/) is a downstream step.")
    return INTERMEDIATE


if __name__ == "__main__":
    gmt(no_cache="--no-cache" in sys.argv)
