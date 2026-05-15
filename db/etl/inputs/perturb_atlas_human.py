# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
# ]
# ///
"""
Perturb Atlas Human — Harmonizome DEG lists + authoritative PerturbAtlas metadata.

Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/PerturbAtlas+Signatures+of+Differentially+Expressed+Genes+for+Gene+Perturbations
Reference: Zhang et al. 2024 Nucleic Acids Res.

Harmonizome strips the per-gene perturbation-type suffixes (`-+*@`) from PerturbAtlas's
`target` field, so we re-source the per-gene perturbation_type by joining each Harmonizome
row to PerturbAtlas's own `meta.csv.gz` on `perturb_id` (see _perturbatlas.py).
Harmonizome supplies the DEG gene sets.

Term transform:
  Perturb_10000_KD_CPSF6_SRP013565 up  ->  CPSF6::K562::::::::KD::::SRP013565::10000 up
Field 5 = perturbation_type (KD/KO/OE/Mut). Field 6 (perturbation_method) is left blank.
Field 1/2 partition: only literal tissue_type=="cell line" routes tissue_name to cellLine;
else cellType.

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/gene_perturbation/perturb-atlas-human.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/perturb_atlas_human.py
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import GENE_INTERMEDIATE, GENE_OUTPUT, harmonizome_paired_download, standardize_gmt
from _perturbatlas import load_meta, make_transform

INTERMEDIATE = GENE_INTERMEDIATE / "perturb-atlas-human.gmt.gz"
FINAL = GENE_OUTPUT / "perturb-atlas-human.gmt.gz"


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download(
        "perturbatlas", INTERMEDIATE,
        transform_fn=make_transform(load_meta("Homo sapiens", no_cache=no_cache)),
        no_cache=no_cache,
    )
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
