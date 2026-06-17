"""
RummaGEO Gene — Harmonizome reprocessing of automatically-mined gene perturbations.

Source: https://rummageo.com
Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Gene+Perturbation+Signatures
Reference: Marino et al. 2024 Patterns.

Term transform:
  GSE100102_0_v_5_cgas_mouse up  ->  cgas::::::::::::::mouse::GSE100102::0::5 up
Fields 1-6 (cell line / type / timepoint / concentration / perturbation type / method) are blank.

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/gene_perturbation/rummageo-gene.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/rummageo_gene.py
"""
from pathlib import Path
import sys

from perturbseqr_etl.inputs._utils import GENE_INTERMEDIATE, GENE_OUTPUT, TERM_DELIMITER, strip_direction, harmonizome_paired_download, standardize_gmt

INTERMEDIATE = GENE_INTERMEDIATE / "rummageo-gene.gmt.gz"
FINAL = GENE_OUTPUT / "rummageo-gene.gmt.gz"


def transform(term: str) -> str:
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) < 6:
        return body + direction
    gse, sample_a, _v, sample_b, organism = parts[0], parts[1], parts[2], parts[3], parts[-1]
    perturbation = "_".join(parts[4:-1])
    return TERM_DELIMITER.join([perturbation, "", "", "", "", "", "",
                   organism, gse, sample_a, sample_b]) + direction


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download("rummageogene", INTERMEDIATE, transform_fn=transform, no_cache=no_cache)
    # Harmonizome already maps mouse DEGs to human orthologs upstream (even for mouse studies),
    # so members are already human symbols — filter as human. Upstream mapping cell:
    # https://github.com/MaayanLab/HarmonizomePythonScripts/blob/master/RummaGEO/Gene%20Perturbation%20Signatures/RummaGEOGene.ipynb
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
