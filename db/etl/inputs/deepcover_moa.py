# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
DeepCover MoA — Harmonizome reprocessing.

Source: https://wren.hms.harvard.edu/DeepCoverMOA/
Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/DeepCoverMOA+Drug+Mechanisms+of+Action
Reference: Mitchell et al., Nature Biotechnology 2023. PMID:36593396.
Raw data: MassIVE MSV000089282.

Note: DeepCover terms have no per-experiment metadata (cell line/timepoint/concentration are
fixed at HCT116/24h/10uM), so we synthesize those slots.

Term transform:
  (4-Chlorobenzyl)pyridine up  ->  (4-Chlorobenzyl)pyridine::HCT116::::24h::10uM up

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/drug_perturbation/deepcover-moa.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/deepcover_moa.py
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, D, strip_direction, harmonizome_paired_download, standardize_gmt

INTERMEDIATE = DRUG_INTERMEDIATE / "deepcover-moa.gmt.gz"
FINAL = DRUG_OUTPUT / "deepcover-moa.gmt.gz"


def transform(term: str) -> str:
    body, direction = strip_direction(term)
    return D.join([body, "HCT116", "", "24h", "10uM"]) + direction


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download("deepcovermoa", INTERMEDIATE, transform_fn=transform, no_cache=no_cache)
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
