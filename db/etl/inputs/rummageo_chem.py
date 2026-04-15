# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
RummaGEO Chem — Harmonizome reprocessing of automatically-mined drug perturbations.

Source: https://rummageo.com
Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Drug+Perturbation+Signatures
Reference: Marino et al. 2024 Patterns.

Term transform (cell info from db/data/metadata/rummageo_metadata.json; cleaner pulls
cell-line and descriptive type apart):
  GSE100217_1_v_0_ethanol_mouse up  ->  ethanol::{cellLine}::{cellType}::{timepoint}::::mouse::GSE100217::1::0 up

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/drug_perturbation/rummageo-chem.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/rummageo_chem.py
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, D, strip_direction, load_metadata, harmonizome_paired_download, standardize_gmt
from _rummageo import clean_rummageo_cell

INTERMEDIATE = DRUG_INTERMEDIATE / "rummageo-chem.gmt.gz"
FINAL = DRUG_OUTPUT / "rummageo-chem.gmt.gz"

# RummaGEO encodes organism in canonical position 5 (after pert/cellLine/cellType/timepoint/concentration).
# Strip the direction suffix and ::-split to extract it for filter_to_human_pc routing.
_parse_organism = lambda key: key.rsplit(" ", 1)[0].split(D)[5] if D in key else "human"


def make_transform(metadata: dict):
    def transform(term: str) -> str:
        body, direction = strip_direction(term)
        parts = body.split("_")
        if len(parts) < 6:
            return body + direction
        gse, sample_a, _v, sample_b, organism = parts[0], parts[1], parts[2], parts[3], parts[-1]
        perturbation = "_".join(parts[4:-1])
        meta = metadata.get(f"{gse}-{sample_a}", {})
        cell_line = meta.get("cell_line") or ""
        cell_type = meta.get("cell_type") or ""
        timepoint = meta.get("timepoint") or ""
        if cell_line and " " in cell_line:
            cell_line, extracted = clean_rummageo_cell(cell_line)
            if extracted and not cell_type:
                cell_type = extracted
        return D.join([perturbation, cell_line, cell_type, timepoint, "", organism, gse, sample_a, sample_b]) + direction
    return transform


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download(
        "rummageochem", INTERMEDIATE,
        transform_fn=make_transform(load_metadata("rummageo_metadata.json")),
        no_cache=no_cache,
    )
    standardize_gmt(INTERMEDIATE, FINAL, parse_organism=_parse_organism)
    return FINAL


if __name__ == "__main__":
    print(download())
