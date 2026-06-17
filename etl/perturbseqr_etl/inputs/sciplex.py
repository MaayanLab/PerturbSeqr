"""
SciPlex — Harmonizome reprocessing.

Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/Sci-Plex+Drug+Perturbation+Signatures
Reference: Srivatsan et al. 2020.

Term transform:
  A549_2-Methoxyestradiol_100nM_24h up  ->  2-Methoxyestradiol::A549::::24h::100nM up

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/drug_perturbation/sciplex.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/sciplex.py
"""
from pathlib import Path
import sys

from perturbseqr_etl.inputs._utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, TERM_DELIMITER, strip_direction, harmonizome_paired_download, standardize_gmt

INTERMEDIATE = DRUG_INTERMEDIATE / "sciplex.gmt.gz"
FINAL = DRUG_OUTPUT / "sciplex.gmt.gz"


def transform(term: str) -> str:
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) < 4:
        return body + direction
    cell_line, perturbation, concentration, timepoint = parts[:4]
    return TERM_DELIMITER.join([perturbation, cell_line, "", timepoint, concentration]) + direction


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download("sciplex", INTERMEDIATE, transform_fn=transform, no_cache=no_cache)
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
