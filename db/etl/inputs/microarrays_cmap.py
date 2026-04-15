# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
#   "requests",
#   "tqdm",
#   "polars",
#   "pandas>=2.0",
#   "numpy",
# ]
# ///
"""
Microarrays CMap (Build 02) — Harmonizome z-score matrix joined with Bioconductor instance
metadata to recover full per-experiment cell line / concentration / timepoint / batch.

Sources:
  - Harmonizome: gene_attribute_matrix.txt.gz (z-scores per drug-instance)
    https://maayanlab.cloud/static/hdfs/harmonizome/data/cmap/gene_attribute_matrix.txt.gz
  - Bioconductor signatureSearchData: cmap_instances_02.txt (per-instance metadata)
    https://raw.githubusercontent.com/bioc/signatureSearchData/master/inst/extdata/cmap_instances_02.txt

Reference: Lamb et al. 2006.

Term shape:
  Harmonizome column header:  {drug}-{instance_id}      (e.g. metformin-1)
  Joined canonical:            {drug}::{cell_line}::::{timepoint}h::{conc}::batch{batch_id} {direction}
                               (e.g. metformin::MCF7::::6h::10uM::batch1 up)

Threshold: |z-score| ≥ 0.95 → up/dn member; cap at top 100 each direction; signatures
with <5 surviving genes drop. (Matches the previous PerturbSeqr CMap pipeline at
db/data/scripts/process_cmap_build02.py.)

Pipeline: ETL stage 0 (input acquisition).
Usage: uv run db/etl/inputs/microarrays_cmap.py
"""
from pathlib import Path
import gzip
import sys

import pandas as pd
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))
from _utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, CACHE_DIR, D, download_to, standardize_gmt

INTERMEDIATE = DRUG_INTERMEDIATE / "microarrays-cmap.gmt.gz"
FINAL = DRUG_OUTPUT / "microarrays-cmap.gmt.gz"
MATRIX_PATH = CACHE_DIR / "cmap_gene_attribute_matrix.txt.gz"
INSTANCES_PATH = CACHE_DIR / "cmap_instances_02.txt"

MATRIX_URL = "https://maayanlab.cloud/static/hdfs/harmonizome/data/cmap/gene_attribute_matrix.txt.gz"
INSTANCES_URL = "https://raw.githubusercontent.com/bioc/signatureSearchData/master/inst/extdata/cmap_instances_02.txt"

ZSCORE_CUTOFF = 0.95
TOP_N = 100
MIN_GENES = 5


def _format_concentration(conc_molar: float) -> str:
    """Molar → human-readable {value}{unit}: nM / uM / mM with trailing-zero trim."""
    conc_um = conc_molar * 1e6
    if conc_um >= 1000:
        val, unit = conc_um / 1000, "mM"
    elif conc_um >= 1:
        val, unit = conc_um, "uM"
    elif conc_um >= 0.001:
        val, unit = conc_um * 1000, "nM"
    else:
        val, unit = conc_um, "uM"
    return f"{int(val)}{unit}" if val == int(val) else f"{val:.2g}{unit}"


def _load_instance_lookup() -> dict[str, str]:
    """{instance_id: canonical-term-body-without-direction} from Bioconductor's metadata."""
    download_to(INSTANCES_URL, INSTANCES_PATH)
    df = pd.read_csv(INSTANCES_PATH, sep="\t")
    out: dict[str, str] = {}
    for _, row in df.iterrows():
        instance_id = str(row["instance_id"])
        body = D.join([
            str(row["cmap_name"]),
            str(row["cell2"]),
            "",
            f"{int(row['duration (h)'])}h",
            _format_concentration(row["concentration (M)"]),
            f"batch{row['batch_id']}",
        ])
        out[instance_id] = body
    return out


def _parse_harmonizome_column(col: str) -> tuple[str, str]:
    """{drug}-{instance_id} → (drug, instance_id). Drug names may contain dashes, so
    split from the right and only when the trailing piece is a pure-numeric instance id."""
    parts = col.rsplit("-", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0], parts[1]
    return col, ""


def _load_harmonizome_matrix() -> pd.DataFrame:
    """Load the gene × signature z-score matrix from Harmonizome's `gene_attribute_matrix.txt.gz`.
    Layout (row 0 header, rows 1-2 metadata, row 3+ data):
      header:  #, #, Drug Name-Perturbation ID, drug-id1, drug-id2, ...
      data:    GENE_SYMBOL, na, gene_id, z-score, z-score, ...
    """
    download_to(MATRIX_URL, MATRIX_PATH)
    with gzip.open(MATRIX_PATH, "rt") as f:
        col_names = f.readline().strip().split("\t")[3:]
    df = pd.read_csv(
        MATRIX_PATH, sep="\t", skiprows=3, index_col=0, compression="gzip",
        header=None, usecols=lambda x: x not in (1, 2),
    )
    df.columns = col_names
    return df.apply(pd.to_numeric, errors="coerce")


def download(no_cache: bool = False) -> Path:
    """Stage A+B: load matrix + instances → join → canonical INTERMEDIATE.
    Stage C: standardize → FINAL."""
    print("  Loading Bioconductor instance metadata...")
    instance_lookup = _load_instance_lookup()
    print(f"  {len(instance_lookup):,} instance records")

    print("  Loading Harmonizome z-score matrix...")
    matrix = _load_harmonizome_matrix()
    print(f"  matrix: {matrix.shape[0]:,} genes × {matrix.shape[1]:,} signatures")

    INTERMEDIATE.parent.mkdir(parents=True, exist_ok=True)
    n = matched = unmatched = 0
    with gzip.open(INTERMEDIATE, "wt") as f_out:
        for col in tqdm(matrix.columns, desc="signatures"):
            _, instance_id = _parse_harmonizome_column(col)
            if instance_id not in instance_lookup:
                unmatched += 1
                continue
            matched += 1
            body = instance_lookup[instance_id]
            zscores = matrix[col].dropna()
            up_genes = [g.upper() for g in zscores[zscores >= ZSCORE_CUTOFF].sort_values(ascending=False).head(TOP_N).index]
            dn_genes = [g.upper() for g in zscores[zscores <= -ZSCORE_CUTOFF].sort_values().head(TOP_N).index]
            if len(up_genes) >= MIN_GENES:
                f_out.write(f"{body} up\t\t" + "\t".join(up_genes) + "\n"); n += 1
            if len(dn_genes) >= MIN_GENES:
                f_out.write(f"{body} down\t\t" + "\t".join(dn_genes) + "\n"); n += 1
    print(f"  matched {matched} / unmatched {unmatched}")
    print(f"  {INTERMEDIATE.name}: {n} terms")
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
