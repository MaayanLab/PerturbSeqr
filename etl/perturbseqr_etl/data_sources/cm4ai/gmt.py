"""
CM4AI (cm4ai.org) CRISPRi KD signatures in KOLF2.1J hiPSCs, limma-voom up/down.
https://www.nature.com/articles/s41587-026-03199-w. Upstream GMTs are manual placement.
"""
import gzip
import sys
from pathlib import Path

from perturbseqr_etl.data_sources import GENE_OUTPUT, TERM_DELIMITER
from perturbseqr_etl.gmt import load_gmt_dict, standardize_gmt, strip_direction

HERE = Path(__file__).parent
UPSTREAM_UP = HERE / "upstream" / "cm4ai_lv_up.gmt"
UPSTREAM_DOWN = HERE / "upstream" / "cm4ai_lv_down.gmt"
INTERMEDIATE = HERE / "intermediate" / "cm4ai.gmt.gz"
FINAL = GENE_OUTPUT / "cm4ai.gmt.gz"

PERTURBATION_TYPE = "KD"
PERTURBATION_METHOD = "CRISPRi"


def transform(term: str) -> str:
    """LV term is gene::KOLF2.1J::hiPSCs::144H::conc; slot in perturbation_type/method at fields 5/6."""
    body, direction = strip_direction(term)
    fields = (body.split(TERM_DELIMITER) + [""] * 5)[:5]
    return TERM_DELIMITER.join(fields + [PERTURBATION_TYPE, PERTURBATION_METHOD]) + direction


def gmt(no_cache: bool = False) -> Path:
    if missing := [p for p in (UPSTREAM_UP, UPSTREAM_DOWN) if not p.exists()]:
        raise NotImplementedError(
            f"CM4AI upstream GMTs missing (manual placement): {', '.join(p.name for p in missing)}")
    INTERMEDIATE.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with gzip.open(INTERMEDIATE, "wt") as f:              # LV terms carry the up/down direction inline
        for path in (UPSTREAM_UP, UPSTREAM_DOWN):
            for key, genes in load_gmt_dict(path).items():
                term, _, desc = key.partition("\t")
                f.write(f"{transform(term)}\t{desc}\t" + "\t".join(genes) + "\n")
                n += 1
    print(f"  {INTERMEDIATE.name}: {n} terms")
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
