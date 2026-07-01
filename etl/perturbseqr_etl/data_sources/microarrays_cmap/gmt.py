"""
Microarrays CMAP Build 02 (Lamb et al. 2006). Harmonizome crisp GMTs + Bioconductor per-instance
metadata (cell line / concentration / timepoint / batch).
https://maayanlab.cloud/static/hdfs/harmonizome/data/cmap  +  signatureSearchData cmap_instances_02.txt
"""
import sys
from pathlib import Path

import pandas as pd

from perturbseqr_etl.data_sources import DRUG_OUTPUT, CACHE_DIR, TERM_DELIMITER
from perturbseqr_etl.dataloader import download_to
from perturbseqr_etl.gmt import harmonizome_paired_download, standardize_gmt, strip_direction

HERE = Path(__file__).parent
INTERMEDIATE = HERE / "intermediate" / "microarrays-cmap.gmt.gz"
FINAL = DRUG_OUTPUT / "microarrays-cmap.gmt.gz"
INSTANCES_PATH = CACHE_DIR / "cmap_instances_02.txt"
INSTANCES_URL = "https://raw.githubusercontent.com/bioc/signatureSearchData/master/inst/extdata/cmap_instances_02.txt"


def _format_concentration(conc_molar: float) -> str:
    """Molar → {value}{unit} (nM/uM/mM, trailing-zero trim)."""
    conc_um = conc_molar * 1e6
    if conc_um >= 1000:
        val, unit = conc_um / 1000, "mM"
    elif conc_um >= 1:
        val, unit = conc_um, "uM"
    elif conc_um >= 0.001:
        val, unit = conc_um * 1000, "nM"
    else:
        val, unit = conc_um, "uM"
    val = round(val, 4)   # 1e-7 M * 1e6 * 1000 = 100.00000000000001 → would render "1e+02nM"
    return f"{int(val)}{unit}" if val == int(val) else f"{val:g}{unit}"


def _load_instance_lookup() -> dict[str, str]:
    """{instance_id: canonical term body (no direction)} from Bioconductor's metadata."""
    download_to(INSTANCES_URL, INSTANCES_PATH)
    df = pd.read_csv(INSTANCES_PATH, sep="\t")
    out: dict[str, str] = {}
    for _, row in df.iterrows():
        out[str(row["instance_id"])] = TERM_DELIMITER.join([
            str(row["cmap_name"]),
            str(row["cell2"]),
            "",
            f"{int(row['duration (h)'])}h",
            _format_concentration(row["concentration (M)"]),
            f"batch{row['batch_id']}",
        ])
    return out


def make_transform(instance_lookup: dict[str, str]):
    def transform(term: str) -> str | None:
        """metformin-1 up  ->  metformin::MCF7::::6h::10uM::batch1 up   (drop ids absent from metadata)"""
        body, direction = strip_direction(term)
        _drug, _, inst_id = body.rpartition("-")
        if not inst_id.isdigit() or inst_id not in instance_lookup:
            return None
        return instance_lookup[inst_id] + direction
    return transform


def gmt(no_cache: bool = False) -> Path:
    lookup = _load_instance_lookup()
    print(f"  {len(lookup):,} Bioconductor instance records")
    harmonizome_paired_download("cmap", INTERMEDIATE, transform_fn=make_transform(lookup), no_cache=no_cache)
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
