"""
Perturb Atlas Mouse. Like the human dataset (shared make_transform / load_meta, Mus musculus meta).
Harmonizome pre-maps these mouse DEGs to human orthologs upstream, so standardize as human.
"""
import sys

from perturbseqr_etl.gmt import harmonizome_builder
from perturbseqr_etl.data_sources.perturb_atlas._perturbatlas import load_meta, make_transform

INTERMEDIATE, FINAL, gmt = harmonizome_builder(
    __file__, "perturbatlasmouse", "perturb-atlas-mouse",
    lambda nc: make_transform(load_meta("Mus musculus", no_cache=nc)),
    gene=True, parse_organism=lambda _k: "human")

if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
