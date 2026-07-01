"""
RummaGEO Chem (Marino et al. 2024 Patterns). Harmonizome reprocessing of auto-mined drug perturbations.
https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Drug+Perturbation+Signatures
Members are already human symbols (Harmonizome maps mouse→human orthologs upstream).
"""
import sys

from perturbseqr_etl.data_sources import TERM_DELIMITER
from perturbseqr_etl.gmt import harmonizome_builder, strip_direction


def transform(term: str) -> str:
    """GSE100217_1_v_0_ethanol_mouse up  ->  ethanol::::::::::mouse::GSE100217::1::0 up (fields 1-4 blank)"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) < 6:
        return body + direction
    gse, sample_a, _v, sample_b, organism = parts[0], parts[1], parts[2], parts[3], parts[-1]
    perturbation = "_".join(parts[4:-1])
    return TERM_DELIMITER.join([perturbation, "", "", "", "", organism, gse, sample_a, sample_b]) + direction


INTERMEDIATE, FINAL, gmt = harmonizome_builder(__file__, "rummageochem", "rummageo-chem", lambda _nc: transform)

if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
