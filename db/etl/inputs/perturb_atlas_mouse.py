# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
# ]
# ///
"""
Perturb Atlas Mouse.

Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Mouse+Gene+Perturbations
Reference: Zhang et al. 2024 Nucleic Acids Res.

Same per-gene perturbation_type re-sourcing as perturb_atlas_human; shares its make_transform
against PerturbAtlas's `meta.csv.gz` filtered to Mus musculus.

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/gene_perturbation/perturb-atlas-mouse.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/perturb_atlas_mouse.py
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import GENE_INTERMEDIATE, GENE_OUTPUT, harmonizome_paired_download, standardize_gmt
from _perturbatlas import load_meta, make_transform

INTERMEDIATE = GENE_INTERMEDIATE / "perturb-atlas-mouse.gmt.gz"
FINAL = GENE_OUTPUT / "perturb-atlas-mouse.gmt.gz"


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download(
        "perturbatlasmouse", INTERMEDIATE,
        transform_fn=make_transform(load_meta("Mus musculus", no_cache=no_cache)),
        no_cache=no_cache,
    )
    standardize_gmt(INTERMEDIATE, FINAL, parse_organism=lambda _k: "mouse")
    return FINAL


if __name__ == "__main__":
    print(download())
