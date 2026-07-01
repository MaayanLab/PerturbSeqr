"""
Ginkgo Bioworks (GDPx1 + GDPx2). GMT from Lily D. Taub's precomputed differential-expression sets.

Upstream:  ginkgo_bioworks/upstream/ginkgo-bioworks-{up,down}.gmt.gz  (paired up/dn files; manual
           placement, gitignored; licensed).
Sources:   https://huggingface.co/datasets/ginkgo-datapoints/GDPx1   (A549)
           https://huggingface.co/datasets/ginkgo-datapoints/GDPx2   (4 primary human cell types)
"""
import gzip
import sys
from pathlib import Path

from perturbseqr_etl.data_sources import DRUG_OUTPUT, TERM_DELIMITER
from perturbseqr_etl.gmt import standardize_gmt, strip_direction

HERE = Path(__file__).parent
# Manual placement, gitignored; direction is in each term, so the up/dn split is just file organization.
UPSTREAM_UP = HERE / "upstream" / "ginkgo-bioworks-up.gmt.gz"
UPSTREAM_DOWN = HERE / "upstream" / "ginkgo-bioworks-down.gmt.gz"
INTERMEDIATE = HERE / "intermediate" / "ginkgo-bioworks.gmt.gz"
FINAL = DRUG_OUTPUT / "ginkgo-bioworks.gmt.gz"

# A549 (GDPx1) → cell line; the four GDPx2 primary cultures → cell type (token, underscores → spaces).
GINKGO_CELL_LINES = {"A549"}


def transform(term: str) -> str:
    """Upstream: SC-514::A549::24::1000nM up to SC-514::A549::::24h::1uM up"""
    body, direction = strip_direction(term)
    parts = body.split(TERM_DELIMITER)
    if len(parts) != 4:
        return term
    perturbation, cell_val, tp_raw, conc_raw = parts
    timepoint = tp_raw + "h"
    if conc_raw.endswith("nM"):
        concentration = f"{float(conc_raw[:-2]) / 1000:g}uM"
    else:
        concentration = conc_raw
    if cell_val in GINKGO_CELL_LINES:
        cell_line, cell_type = cell_val, ""
    else:
        cell_line, cell_type = "", cell_val.replace("_", " ")
    return TERM_DELIMITER.join([perturbation, cell_line, cell_type, timepoint, concentration]) + direction


def _read_upstream_gmt(paths: list[Path]) -> dict[str, list[str]]:
    """Read the paired upstream GMTs, rewrite each term to ::-format"""
    out: dict[str, list[str]] = {}
    for path in paths:
        with gzip.open(path, "rt") as f:
            for line in f:
                if not line.strip():
                    continue
                term, _desc, *genes = line.rstrip("\n").split("\t")
                if not genes:
                    continue
                out[transform(term)] = [g for g in genes if g]
    return out


def gmt(no_cache: bool = False) -> Path:
    if missing := [p for p in (UPSTREAM_UP, UPSTREAM_DOWN) if not p.exists()]:
        raise NotImplementedError(
            "Ginkgo Bioworks data is internal/licensed, no public download endpoint. Place the "
            f"paired upstream GMTs at {UPSTREAM_UP} and {UPSTREAM_DOWN} and rerun (missing: "
            f"{', '.join(p.name for p in missing)})."
        )
    print(f"  Reading {UPSTREAM_UP.name} + {UPSTREAM_DOWN.name}...")
    canonical = _read_upstream_gmt([UPSTREAM_UP, UPSTREAM_DOWN])
    INTERMEDIATE.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(INTERMEDIATE, "wt") as f:
        for term, genes in canonical.items():
            f.write(f"{term}\t\t" + "\t".join(genes) + "\n")
    print(f"  {INTERMEDIATE.name}: {len(canonical)} terms")
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
