# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
#   "pandas>=2.0",
# ]
# ///
"""
Microarrays CMap (Build 02) — Harmonizome crisp GMTs joined with Bioconductor
per-instance metadata to recover cell line / concentration / timepoint / batch.

Sources:
  - Harmonizome crisp GMTs (up + dn), already thresholded per-signature:
    https://maayanlab.cloud/static/hdfs/harmonizome/data/cmap/gene_set_library_{up,dn}_crisp.gmt.gz
    Terms: {drug}-{instance_id} (e.g. metformin-1)
  - Bioconductor signatureSearchData cmap_instances_02.txt — per-instance metadata:
    https://raw.githubusercontent.com/bioc/signatureSearchData/master/inst/extdata/cmap_instances_02.txt

Reference: Lamb et al. 2006.

Term transform:
  "metformin-1 up"  ->  "metformin::MCF7::::6h::10uM::batch1 up"

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/drug_perturbation/microarrays-cmap.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/microarrays_cmap.py
"""
from pathlib import Path
import sys

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from _utils import (
    DRUG_INTERMEDIATE, DRUG_OUTPUT, CACHE_DIR, DELIMITER,
    strip_direction, download_to, harmonizome_paired_download, standardize_gmt,
)

INTERMEDIATE = DRUG_INTERMEDIATE / "microarrays-cmap.gmt.gz"
FINAL = DRUG_OUTPUT / "microarrays-cmap.gmt.gz"
INSTANCES_PATH = CACHE_DIR / "cmap_instances_02.txt"

INSTANCES_URL = "https://raw.githubusercontent.com/bioc/signatureSearchData/master/inst/extdata/cmap_instances_02.txt"


def _format_concentration(conc_molar: float) -> str:
    """Molar → human-readable {value}{unit}: nM / uM / mM with trailing-zero trim."""
    conc_um = conc_molar * 1e6
    if conc_um >= 1000:
        val, unit = conc_um / 1000, "mM"
    elif conc_um >= 1:
        val, unit = conc_um, "uM"
    elif conc_um >= 0.001:
        val, unit = conc_um * 1000, "nM"
    else:
        val, unit = conc_um, "uM"
    return f"{int(val)}{unit}" if val == int(val) else f"{val:.2g}{unit}"


def _load_instance_lookup() -> dict[str, str]:
    """{instance_id: canonical-term-body-without-direction} from Bioconductor's metadata."""
    download_to(INSTANCES_URL, INSTANCES_PATH)
    df = pd.read_csv(INSTANCES_PATH, sep="\t")
    out: dict[str, str] = {}
    for _, row in df.iterrows():
        out[str(row["instance_id"])] = DELIMITER.join([
            str(row["cmap_name"]),
            str(row["cell2"]),
            "",
            f"{int(row['duration (h)'])}h",
            _format_concentration(row["concentration (M)"]),
            f"batch{row['batch_id']}",
        ])
    return out


def make_transform(instance_lookup: dict[str, str]):
    """Rewrite `{drug}-{instance_id} {direction}` to canonical, dropping rows whose
    instance_id isn't in the Bioconductor metadata."""
    def transform(term: str) -> str | None:
        body, direction = strip_direction(term)
        _drug, _, inst_id = body.rpartition("-")
        if not inst_id.isdigit() or inst_id not in instance_lookup:
            return None
        return instance_lookup[inst_id] + direction
    return transform


def download(no_cache: bool = False) -> Path:
    instance_lookup = _load_instance_lookup()
    print(f"  {len(instance_lookup):,} Bioconductor instance records")

    harmonizome_paired_download(
        "cmap", INTERMEDIATE,
        transform_fn=make_transform(instance_lookup),
        no_cache=no_cache,
    )
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
