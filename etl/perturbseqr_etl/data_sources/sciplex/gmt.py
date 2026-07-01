"""
SciPlex (Srivatsan et al. 2020). Harmonizome reprocessing.
https://maayanlab.cloud/Harmonizome/dataset/Sci-Plex+Drug+Perturbation+Signatures
"""
import sys

from perturbseqr_etl.data_sources import TERM_DELIMITER
from perturbseqr_etl.gmt import harmonizome_builder, strip_direction


def transform(term: str) -> str:
    """A549_2-Methoxyestradiol_100nM_24h up  ->  2-Methoxyestradiol::A549::::24h::100nM up"""
    body, direction = strip_direction(term)
    parts = body.split("_")
    if len(parts) < 4:
        return body + direction
    cell_line, perturbation, concentration, timepoint = parts[:4]
    return TERM_DELIMITER.join([perturbation, cell_line, "", timepoint, concentration]) + direction


INTERMEDIATE, FINAL, gmt = harmonizome_builder(__file__, "sciplex", "sciplex", lambda _nc: transform)

if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
