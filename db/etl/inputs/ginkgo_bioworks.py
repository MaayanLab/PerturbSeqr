# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Ginkgo Bioworks — internal dataset, no public source.

The Ginkgo data is licensed and used in PerturbSeqr at the app layer for licensing reasons.
There is no public download endpoint and the raw dash-delimited GMT was provided to us
directly. This module codifies the source→canonical transform AND applies the cross-dataset
protein-coding filter (all Ginkgo signatures are human A549, so organism is fixed).

Source line:    A549-SC_514-1000-24       (cell-pert-conc_nM-tp_h, dash-delimited)
Canonical term: SC_514::A549::::24h::1uM up

If you need to regenerate this GMT, contact the Ginkgo collaboration lead and place the
raw GMT at RAW_GMT. download() will transform + PC-filter it into OUTPUT.

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/drug_perturbation/ginkgo-bioworks.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/ginkgo_bioworks.py
"""
from pathlib import Path
import gzip
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, CACHE_DIR, D, strip_direction, standardize_gmt

INTERMEDIATE = DRUG_INTERMEDIATE / "ginkgo-bioworks.gmt.gz"
FINAL = DRUG_OUTPUT / "ginkgo-bioworks.gmt.gz"
# Licensed/internal: no public download. Place new snapshots at this path manually.
# Lives under db/etl/inputs/drug_perturbation/ (not _cache/) because it's permanent input,
# not an auto-downloadable ephemeral cache.
RAW_GMT = Path(__file__).parent / "drug_perturbation" / "ginkgo-bioworks-raw.gmt.gz"
GINKGO_CELL_LINES = {"A549"}


def transform(term: str) -> str:
    """Source: A549-SC_514-1000-24-up   (cell-pert-conc_nM-tp_h-direction; ALL hyphen-delimited)
    Canonical: SC_514::A549::::24h::1uM up"""
    # Direction is hyphen-delimited in this source (-up/-down/-dn), not space-delimited.
    for suf in ("-up", "-down", "-dn"):
        if term.endswith(suf):
            body, direction = term[:-len(suf)], " " + suf[1:]
            break
    else:
        body, direction = term, ""
    parts = body.split("-")
    if len(parts) < 4:
        return body + direction
    cell_val = parts[0]
    timepoint = parts[-1] + "h"
    conc_um = float(parts[-2]) / 1000  # raw values are nM
    concentration = f"{conc_um:g}uM"
    perturbation = "-".join(parts[1:-2])
    cell_line, cell_type = (cell_val, "") if cell_val in GINKGO_CELL_LINES else ("", cell_val)
    return D.join([perturbation, cell_line, cell_type, timepoint, concentration]) + direction


def _read_raw_gmt(path: Path) -> dict[str, list[str]]:
    """Read raw (dash-delimited) GMT, transform each term, return {canonical: [genes]}."""
    out: dict[str, list[str]] = {}
    with gzip.open(path, "rt") as f:
        for line in f:
            if not line.strip():
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            canonical = transform(parts[0])
            out[canonical] = [g for g in parts[2:] if g]
    return out


def download(no_cache: bool = False) -> Path:
    """Stage B: read raw Ginkgo GMT → canonical INTERMEDIATE. Stage C: standardize → FINAL."""
    if not RAW_GMT.exists():
        raise NotImplementedError(
            "Ginkgo Bioworks data is internal/licensed. No public download endpoint. "
            f"Place the raw GMT at {RAW_GMT} and rerun."
        )
    print(f"  Reading {RAW_GMT.name}...")
    gmt = _read_raw_gmt(RAW_GMT)
    INTERMEDIATE.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(INTERMEDIATE, "wt") as f:
        for term, genes in gmt.items():
            f.write(f"{term}\t\t" + "\t".join(genes) + "\n")
    print(f"  {INTERMEDIATE.name}: {len(gmt)} terms")
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
