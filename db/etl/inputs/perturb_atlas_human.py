# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Perturb Atlas Human — Harmonizome reprocessing.

Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations
Reference: Zhang et al. 2024 Nucleic Acids Res.

Term transform (cell info from db/data/metadata/perturbatlas_metadata.json; the cleaner
disambiguates cell-line names from descriptive tissue strings):
  Perturb_10000_KD_CPSF6_SRP013565 up  ->  CPSF6::::{cellType}::::::KD::SRP013565::10000 up

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/gene_perturbation/perturb-atlas-human.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/perturb_atlas_human.py
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import GENE_INTERMEDIATE, GENE_OUTPUT, D, strip_direction, load_metadata, harmonizome_paired_download, standardize_gmt

INTERMEDIATE = GENE_INTERMEDIATE / "perturb-atlas-human.gmt.gz"
FINAL = GENE_OUTPUT / "perturb-atlas-human.gmt.gz"


def make_transform(metadata: dict):
    def transform(term: str) -> str:
        body, direction = strip_direction(term)
        parts = body.split("_")
        if len(parts) < 5:
            return body + direction
        prefix, id_, pert_type, perturbation, dataset = parts[:5]
        meta = metadata.get(f"{prefix}-{id_}", {})
        # PerturbAtlas cell_line values mix actual codes with descriptive strings; we dump the
        # full value into the cell_type slot rather than guessing — TODO: build curated mapping.
        cell_val = (meta.get("cell_line") or "").replace("\\,", ",").strip()
        return D.join([perturbation, "", cell_val, "", "", pert_type, dataset, id_]) + direction
    return transform


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download(
        "perturbatlas", INTERMEDIATE,
        transform_fn=make_transform(load_metadata("perturbatlas_metadata.json")),
        no_cache=no_cache,
    )
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
