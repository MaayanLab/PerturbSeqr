"""
Ginkgo Bioworks.

Source line:    SC-514::A549::24::1000nM up   (pert::cell::tp_h::conc_nM, ::-delimited)
Canonical term: SC-514::A549::::24h::1uM up

If you need to regenerate this GMT, contact the Ginkgo collaboration lead and place the
raw GMT at RAW_GMT. download() will transform + PC-filter it into OUTPUT.

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/drug_perturbation/ginkgo-bioworks.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/ginkgo_bioworks.py
"""
from pathlib import Path
import gzip
import sys

from perturbseqr_etl.inputs._utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, TERM_DELIMITER, strip_direction, standardize_gmt

INTERMEDIATE = DRUG_INTERMEDIATE / "ginkgo-bioworks.gmt.gz"
FINAL = DRUG_OUTPUT / "ginkgo-bioworks.gmt.gz"
# Licensed/internal: no public download. Place new snapshots at this path manually.
# Lives under db/etl/inputs/drug_perturbation/ (not _cache/) because it's permanent input,
# not an auto-downloadable ephemeral cache.
RAW_GMT = Path(__file__).parent / "drug_perturbation" / "ginkgo-bioworks-raw.gmt.gz"
GINKGO_CELL_LINES = {"A549"}


def transform(term: str) -> str:
    """Source: SC-514::A549::24::1000nM up   (pert::cell::tp_h::conc_nM, ::-delimited)
    Canonical: SC-514::A549::::24h::1uM up"""
    body, direction = strip_direction(term)
    parts = body.split(TERM_DELIMITER)
    if len(parts) != 4:
        return term
    perturbation, cell_val, tp_raw, conc_raw = parts
    timepoint = tp_raw + "h"
    if conc_raw.endswith("nM"):
        conc_um = float(conc_raw[:-2]) / 1000
        concentration = f"{conc_um:g}uM"
    else:
        concentration = conc_raw
    cell_line, cell_type = (cell_val, "") if cell_val in GINKGO_CELL_LINES else ("", cell_val)
    return TERM_DELIMITER.join([perturbation, cell_line, cell_type, timepoint, concentration]) + direction


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
