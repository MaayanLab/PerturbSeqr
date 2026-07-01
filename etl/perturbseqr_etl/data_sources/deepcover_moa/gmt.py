"""
DeepCover MoA (Mitchell et al. Nat Biotechnol 2023). Harmonizome reprocessing, fixed HCT116/24h/10uM.
https://maayanlab.cloud/Harmonizome/dataset/DeepCoverMOA+Drug+Mechanisms+of+Action
"""
import sys

from perturbseqr_etl.data_sources import TERM_DELIMITER
from perturbseqr_etl.gmt import harmonizome_builder, strip_direction

CELL_LINE = "HCT116"
TIMEPOINT = "24h"
CONCENTRATION = "10uM"


def transform(term: str) -> str:
    body, direction = strip_direction(term)
    return TERM_DELIMITER.join([body, CELL_LINE, "", TIMEPOINT, CONCENTRATION]) + direction


INTERMEDIATE, FINAL, gmt = harmonizome_builder(__file__, "deepcovermoa", "deepcover-moa", lambda _nc: transform)

if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
