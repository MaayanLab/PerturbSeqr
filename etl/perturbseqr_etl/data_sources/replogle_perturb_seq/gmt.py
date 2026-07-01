"""
Replogle et al. CRISPRi Perturb-seq. Harmonizome reprocessing of 3 sub-screens (Cell 2022).
Each sub-screen's up/dn pair downloaded in one pass; cell line / timepoint / screen fixed per sub-screen, all KD / CRISPRi.
Transform: 10023_ZC3H18_P1P2 + direction  ->  ZC3H18::K562::::day6::::KD::CRISPRi::P1P2::essential::10023 up
"""
import gzip
import sys
from pathlib import Path

from perturbseqr_etl.data_sources import GENE_OUTPUT, CACHE_DIR, TERM_DELIMITER
from perturbseqr_etl.dataloader import download_to
from perturbseqr_etl.gmt import HARMONIZOME_BASE, standardize_gmt

HERE = Path(__file__).parent
INTERMEDIATE = HERE / "intermediate" / "replogle-perturb-seq.gmt.gz"
FINAL = GENE_OUTPUT / "replogle-perturb-seq.gmt.gz"

PERTURBATION_TYPE = "KD"          # the entire Replogle library is uniformly CRISPRi knockdown
PERTURBATION_METHOD = "CRISPRi"
# (Harmonizome slug, cell_line, timepoint, screen_scope)
SUB_SCREENS = [
    ("reploglek562essential", "K562", "day6", "essential"),
    ("reploglek562genomewide", "K562", "day8", "genomewide"),
    ("reploglerpe1essential", "RPE1", "day7", "essential"),
]


def gmt(no_cache: bool = False) -> Path:
    if not (INTERMEDIATE.exists() and not no_cache):
        INTERMEDIATE.parent.mkdir(parents=True, exist_ok=True)
        n = 0
        with gzip.open(INTERMEDIATE, "wt") as out:
            for slug, cell_line, timepoint, screen in SUB_SCREENS:
                for disk, direction in [("up", "up"), ("dn", "down")]:
                    cache = CACHE_DIR / f"{slug}_{disk}_crisp.gmt.gz"
                    download_to(f"{HARMONIZOME_BASE}/{slug}/gene_set_library_{disk}_crisp.gmt.gz", cache, no_cache=no_cache)
                    with gzip.open(cache, "rt") as f:
                        for line in f:
                            if not line.strip():
                                continue
                            body, _, rest = line.partition("\t")  # body = "id_pert_batch"
                            parts = body.split("_")
                            if len(parts) >= 3:
                                id_, perturbation, batch = parts[:3]
                                term = TERM_DELIMITER.join([perturbation, cell_line, "", timepoint, "", PERTURBATION_TYPE, PERTURBATION_METHOD, batch, screen, id_]) + f" {direction}"
                            else:
                                term = body + f" {direction}"
                            out.write(f"{term}\t{rest}")
                            n += 1
        print(f"  {INTERMEDIATE.name}: {n} terms across {len(SUB_SCREENS)} sub-screens")
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
