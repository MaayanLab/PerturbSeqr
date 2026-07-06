"""
CM4AI (cm4ai.org) CRISPRi KD signatures in KOLF2.1J hiPSCs, Characteristic Direction up/down.
https://www.nature.com/articles/s41587-026-03199-w. Upstream GMTs are manual placement.
"""
import sys
from pathlib import Path

from perturbseqr_etl.data_sources import GENE_OUTPUT, TERM_DELIMITER
from perturbseqr_etl.gmt import merge_up_down, standardize_gmt, strip_direction

HERE = Path(__file__).parent
UPSTREAM_UP = HERE / "upstream" / "kolf_crispri_cd_up.gmt"
UPSTREAM_DOWN = HERE / "upstream" / "kolf_crispri_cd_down.gmt"
INTERMEDIATE = HERE / "intermediate" / "cm4ai.gmt.gz"
FINAL = GENE_OUTPUT / "cm4ai.gmt.gz"

CELL_LINE = "KOLF2.1J"
PERTURBATION_TYPE = "KD"
PERTURBATION_METHOD = "CRISPRi"


def transform(term: str) -> str:
    body, direction = strip_direction(term)
    gene = body.split("_", 1)[0]     # col1 is a bare gene or GENE_KOLF2.1J_144h_..._CRISPRi
    return TERM_DELIMITER.join([gene, CELL_LINE, "", "", "", PERTURBATION_TYPE, PERTURBATION_METHOD]) + direction


def gmt(no_cache: bool = False) -> Path:
    if missing := [p for p in (UPSTREAM_UP, UPSTREAM_DOWN) if not p.exists()]:
        raise NotImplementedError(
            f"CM4AI upstream GMTs missing (manual placement): {', '.join(p.name for p in missing)}")
    n = merge_up_down(UPSTREAM_UP, UPSTREAM_DOWN, INTERMEDIATE, transform_fn=transform)
    print(f"  {INTERMEDIATE.name}: {n} terms")
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
