# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Perturb Atlas Mouse — Harmonizome reprocessing.

Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Mouse+Gene+Perturbations
Reference: Zhang et al. 2024 Nucleic Acids Res.

Term transform: same as perturb_atlas_human (shares perturbatlas_metadata.json + cleaner).

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/gene_perturbation/perturb-atlas-mouse.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/perturb_atlas_mouse.py
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import GENE_INTERMEDIATE, GENE_OUTPUT, load_metadata, harmonizome_paired_download, standardize_gmt
from perturb_atlas_human import make_transform

INTERMEDIATE = GENE_INTERMEDIATE / "perturb-atlas-mouse.gmt.gz"
FINAL = GENE_OUTPUT / "perturb-atlas-mouse.gmt.gz"


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download(
        "perturbatlasmouse", INTERMEDIATE,
        transform_fn=make_transform(load_metadata("perturbatlas_metadata.json")),
        no_cache=no_cache,
    )
    standardize_gmt(INTERMEDIATE, FINAL, parse_organism=lambda _k: "mouse")
    return FINAL


if __name__ == "__main__":
    print(download())
