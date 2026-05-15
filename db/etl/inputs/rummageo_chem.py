# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
# ]
# ///
"""
RummaGEO Chem — Harmonizome reprocessing of automatically-mined drug perturbations.

Source: https://rummageo.com
Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Drug+Perturbation+Signatures
Reference: Marino et al. 2024 Patterns.

Harmonizome supplies the DEG gene-set lists. RummaGEO's per-sample GEO annotations are too
messy to extract cell line / cell type without mistakes, so v1 leaves those blank.

Term transform:
  GSE100217_1_v_0_ethanol_mouse up  ->  ethanol::::::::::mouse::GSE100217::1::0 up
Fields 1-4 (cell line / type / timepoint / concentration) are blank.

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/drug_perturbation/rummageo-chem.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/rummageo_chem.py
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, TERM_DELIMITER, strip_direction, harmonizome_paired_download, standardize_gmt

INTERMEDIATE = DRUG_INTERMEDIATE / "rummageo-chem.gmt.gz"
FINAL = DRUG_OUTPUT / "rummageo-chem.gmt.gz"

# Organism is at canonical position 5 (after pert/cellLine/cellType/timepoint/concentration).
_parse_organism = lambda key: key.rsplit(" ", 1)[0].split(TERM_DELIMITER)[5] if TERM_DELIMITER in key else "human"


def transform(term: str) -> str:
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) < 6:
        return body + direction
    gse, sample_a, _v, sample_b, organism = parts[0], parts[1], parts[2], parts[3], parts[-1]
    perturbation = "_".join(parts[4:-1])
    return TERM_DELIMITER.join([perturbation, "", "", "", "", organism, gse, sample_a, sample_b]) + direction


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download("rummageochem", INTERMEDIATE, transform_fn=transform, no_cache=no_cache)
    standardize_gmt(INTERMEDIATE, FINAL, parse_organism=_parse_organism)
    return FINAL


if __name__ == "__main__":
    print(download())
