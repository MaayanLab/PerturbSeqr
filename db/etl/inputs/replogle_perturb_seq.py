# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Replogle et al. CRISPRi Perturb-seq — Harmonizome reprocessing of 3 sub-screens.

Resource: https://maayanlab.cloud/Harmonizome/resource/Replogle+et+al.%2C+Cell%2C+2022
Harmonizome (3 datasets, one per sub-screen):
  K562 essential:   https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Essential+Perturb-seq+Gene+Perturbation+Signatures
  K562 genome-wide: https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+K562+Genome-wide+Perturb-seq+Gene+Perturbation+Signatures
  RPE1 essential:   https://maayanlab.cloud/Harmonizome/dataset/Replogle+et+al.,+Cell,+2022+RPE1+Essential+Perturb-seq+Gene+Perturbation+Signatures
Reference: Replogle et al., Cell, 2022.

Harmonizome publishes 3 separate Replogle datasets (one per cell line / screen scope), each
with its own up + dn GMT pair. We download all 6 files and emit canonical terms in one pass.

Source line:    10023_ZC3H18_P1P2  (id_perturbation_batch)  + filename direction
Canonical term: ZC3H18::K562::::day6::::P1P2::essential::10023 up

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/gene_perturbation/replogle-perturb-seq.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/replogle_perturb_seq.py
"""
from pathlib import Path
import gzip
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import GENE_INTERMEDIATE, GENE_OUTPUT, CACHE_DIR, D, download_to, HARMONIZOME_BASE, standardize_gmt

INTERMEDIATE = GENE_INTERMEDIATE / "replogle-perturb-seq.gmt.gz"
FINAL = GENE_OUTPUT / "replogle-perturb-seq.gmt.gz"

# (Harmonizome slug, cell_line, timepoint, screen_scope)
SUB_SCREENS = [
    ("reploglek562essential", "K562", "day6", "essential"),
    ("reploglek562genomewide", "K562", "day8", "genomewide"),
    ("reploglerpe1essential", "RPE1", "day7", "essential"),
]


def download(no_cache: bool = False) -> Path:
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
                                term = D.join([perturbation, cell_line, "", timepoint, "", batch, screen, id_]) + f" {direction}"
                            else:
                                term = body + f" {direction}"
                            out.write(f"{term}\t{rest}")
                            n += 1
        print(f"  {INTERMEDIATE.name}: {n} terms across {len(SUB_SCREENS)} sub-screens")
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
