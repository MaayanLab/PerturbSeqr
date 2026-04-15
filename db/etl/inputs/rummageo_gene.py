# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
RummaGEO Gene — Harmonizome reprocessing of automatically-mined gene perturbations.

Source: https://rummageo.com
Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Gene+Perturbation+Signatures
Reference: Marino et al. 2024 Patterns.

Term transform: same shape as rummageo_chem (shares rummageo_metadata.json + cleaner):
  GSE100102_0_v_5_cgas_mouse up  ->  cgas::{cellLine}::{cellType}::{timepoint}::::mouse::GSE100102::0::5 up

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/gene_perturbation/rummageo-gene.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/rummageo_gene.py
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import GENE_INTERMEDIATE, GENE_OUTPUT, load_metadata, harmonizome_paired_download, standardize_gmt
from rummageo_chem import make_transform, _parse_organism

INTERMEDIATE = GENE_INTERMEDIATE / "rummageo-gene.gmt.gz"
FINAL = GENE_OUTPUT / "rummageo-gene.gmt.gz"


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download(
        "rummageogene", INTERMEDIATE,
        transform_fn=make_transform(load_metadata("rummageo_metadata.json")),
        no_cache=no_cache,
    )
    standardize_gmt(INTERMEDIATE, FINAL, parse_organism=_parse_organism)
    return FINAL


if __name__ == "__main__":
    print(download())
