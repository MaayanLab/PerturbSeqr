# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
# ]
# ///
"""
Tahoe-100M — standardize the post-DESeq2 canonical GMT.

Input: db/etl/intermediate/drug_perturbation/tahoe-100m.gmt.gz
       (already in canonical {drug}::{cell_line}::{cell_type}::24h::{conc} {direction} format,
        produced by db/etl/tahoe_deseq2_to_gmt.py from the HuggingFace pseudobulk DE table)
Output: db/data/drug_perturbation/tahoe-100m.gmt.gz (PC-filtered + alias-renamed)

Usage: uv run db/etl/inputs/tahoe_100m.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, standardize_gmt

INTERMEDIATE = DRUG_INTERMEDIATE / "tahoe-100m.gmt.gz"
FINAL = DRUG_OUTPUT / "tahoe-100m.gmt.gz"


def download(no_cache: bool = False) -> Path:
    """Stage C only: PC filter + alias rename. Stages A+B happen in tahoe_deseq2_to_gmt.py."""
    if not INTERMEDIATE.exists():
        raise NotImplementedError(
            f"Tahoe canonical intermediate missing: {INTERMEDIATE}\n"
            f"Either run db/etl/tahoe_deseq2_to_gmt.py first to produce it from the "
            f"HuggingFace pseudobulk DE table, or download the prebuilt one:\n"
            f"  curl -L https://s3.perturbseqr.k8s.dev.maayanlab.cloud/data/tahoe-100m.gmt.gz -o {INTERMEDIATE}"
        )
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
