# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
# ]
# ///
"""
DeepCover MoA — Harmonizome reprocessing.

Source: https://wren.hms.harvard.edu/DeepCoverMOA/
Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/DeepCoverMOA+Drug+Mechanisms+of+Action
Reference: Mitchell et al., Nature Biotechnology 2023. PMID:36593396.
Raw data: MassIVE MSV000089282.

Term transform:
  (4-Chlorobenzyl)pyridine up  ->  (4-Chlorobenzyl)pyridine::HCT116::::24h::10uM up

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/drug_perturbation/deepcover-moa.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/deepcover_moa.py
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, TERM_DELIMITER, strip_direction, harmonizome_paired_download, standardize_gmt

INTERMEDIATE = DRUG_INTERMEDIATE / "deepcover-moa.gmt.gz"
FINAL = DRUG_OUTPUT / "deepcover-moa.gmt.gz"

CELL_LINE = "HCT116"
TIMEPOINT = "24h"
CONCENTRATION = "10uM"


def transform(term: str) -> str:
    body, direction = strip_direction(term)
    return TERM_DELIMITER.join([body, CELL_LINE, "", TIMEPOINT, CONCENTRATION]) + direction


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download("deepcovermoa", INTERMEDIATE, transform_fn=transform, no_cache=no_cache)
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
