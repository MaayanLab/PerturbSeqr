"""
Perturb Atlas Human. Harmonizome DEG lists + PerturbAtlas meta (Zhang et al. 2024 NAR).
make_transform (see _perturbatlas) re-sources per-gene perturbation_type (field 5) from meta.csv.gz; field 1/2 = cellLine/cellType.
Transform: Perturb_10000_KD_CPSF6_SRP013565 up  ->  CPSF6::K562::::::::KD::::SRP013565::10000 up
"""
import sys

from perturbseqr_etl.gmt import harmonizome_builder
from perturbseqr_etl.data_sources.perturb_atlas._perturbatlas import load_meta, make_transform

INTERMEDIATE, FINAL, gmt = harmonizome_builder(
    __file__, "perturbatlas", "perturb-atlas-human",
    lambda nc: make_transform(load_meta("Homo sapiens", no_cache=nc)), gene=True)

if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
