# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Source: https://cm4ai.org
Data:   https://figshare.com/s/ee85bb1880921326249b   (private/embargoed Figshare link)
Reference: CM4AI preprint: https://www.biorxiv.org/content/10.1101/2024.11.03.621734v2

Embargoed. Write an empty GMT placeholder for now.

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/gene_perturbation/cm4ai.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/cm4ai.py
"""
import gzip
from _utils import GENE_INTERMEDIATE, GENE_OUTPUT

INTERMEDIATE = GENE_INTERMEDIATE / "cm4ai.gmt.gz"
FINAL = GENE_OUTPUT / "cm4ai.gmt.gz"


def download(no_cache: bool = False):
    # Embargoed: write empty placeholders to both layers so format_verification + visualize_etl
    for p in (INTERMEDIATE, FINAL):
        p.parent.mkdir(parents=True, exist_ok=True)
        gzip.open(p, "wt").close()
    return FINAL


if __name__ == "__main__":
    print(download())
