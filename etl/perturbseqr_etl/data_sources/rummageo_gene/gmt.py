"""
RummaGEO Gene. Harmonizome reprocessing of automatically-mined gene perturbations (Marino et al. 2024).
https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Gene+Perturbation+Signatures

Term transform (fields 1-6, cellLine/cellType/timepoint/concentration/perturbation_type/method, are blank):
  GSE100102_0_v_5_cgas_mouse up  ->  cgas::::::::::::::mouse::GSE100102::0::5 up
Harmonizome already maps mouse DEGs to human orthologs upstream, so members are human symbols.

Usage: uv run --project etl python -m perturbseqr_etl.data_sources.rummageo_gene.gmt [--no-cache]
"""
import sys

from perturbseqr_etl.data_sources import TERM_DELIMITER
from perturbseqr_etl.gmt import harmonizome_builder, strip_direction


def transform(term: str) -> str:
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) < 6:
        return body + direction
    gse, sample_a, _v, sample_b, organism = parts[0], parts[1], parts[2], parts[3], parts[-1]
    perturbation = "_".join(parts[4:-1])
    return TERM_DELIMITER.join([perturbation, "", "", "", "", "", "",
                                organism, gse, sample_a, sample_b]) + direction


INTERMEDIATE, FINAL, gmt = harmonizome_builder(__file__, "rummageogene", "rummageo-gene", lambda _nc: transform, gene=True)

if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
