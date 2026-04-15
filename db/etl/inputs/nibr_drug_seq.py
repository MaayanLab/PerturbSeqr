# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
#   "requests",
#   "tqdm",
#   "polars",
# ]
# ///
"""
NIBR DRUG-seq U2OS MoA Box — Harmonizome reprocessing.

Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/NIBR+DRUG-seq+U2OS+MoA+Box+Gene+Expression+Profiles
Reference: Li et al. 2022.

We use Harmonizome rather than the raw NIBR DRUG-seqr distribution (the latter would
add a per-batch slot + chem-identifier description column, but isn't a public source).
Harmonizome's reprocessing collapses across batches and discards descriptions; we accept
that loss in exchange for a stable public source.

Filtering note: Harmonizome reprocesses with padj<0.01, protein-coding genes only.
~14% of compounds are Novartis-internal (NSN code only, no public name).

Term transform (NSN→drug-name resolved via db/data/metadata/drugseqr.tsv; NSN format is
XX-NN-XXNN with dashes only, so the trailing _ separates concentration cleanly). The NSN
always goes into both the last canonical extra AND the description column, prefixed with
"NSN:" so the namespace is self-describing wherever the code appears (parallel to how
Broad's BRD-K / BRDN codes already announce themselves):

  resolved:   "AA-01-JO26_0.01uM up"  ->  "Rolipram::U2OS::::24h::0.01uM::NSN:AA-01-JO26 up"        desc="NSN:AA-01-JO26"
  unresolved: "AF-80-QK39_1uM up"     ->  "NSN:AF-80-QK39::U2OS::::24h::1uM::NSN:AF-80-QK39 up"     desc="NSN:AF-80-QK39"

Pipeline: ETL stage 0 (input acquisition).
Usage: uv run db/etl/inputs/nibr_drug_seq.py
"""
from pathlib import Path
import csv
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, METADATA_DIR, D, strip_direction, harmonizome_paired_download, standardize_gmt

INTERMEDIATE = DRUG_INTERMEDIATE / "nibr-drug-seq.gmt.gz"
FINAL = DRUG_OUTPUT / "nibr-drug-seq.gmt.gz"


def _load_nsn_map() -> dict[str, str]:
    """Load NSN → drug name from db/data/metadata/drugseqr.tsv."""
    path = METADATA_DIR / "drugseqr.tsv"
    if not path.exists():
        print(f"  WARNING: NIBR NSN metadata not found: {path}")
        return {}
    out: dict[str, str] = {}
    with open(path) as f:
        for row in csv.DictReader(f, delimiter="\t"):
            code = (row.get("code") or "").strip()
            name = (row.get("name") or "").strip()
            if code and name:
                out[code] = name
    return out


NSN_PREFIX = "NSN:"


def make_transform(nsn_map: dict[str, str]):
    def transform(term: str) -> tuple[str, str]:
        """Return (canonical_term, description). The NSN — prefixed with 'NSN:' — always goes
        into both the last canonical extra and the description, so the reagent code is
        self-describing and recoverable regardless of whether we resolved it to a drug name."""
        body, direction = strip_direction(term)
        parts = body.rsplit("_", 1)
        if len(parts) != 2:
            return body + direction, ""
        nsn, concentration = parts
        nsn_tag = NSN_PREFIX + nsn
        # nsn_map keys are the raw NSN (no prefix); fall back to NSN:<code> in perturbation slot when unresolved
        perturbation = nsn_map.get(nsn, nsn_tag)
        return D.join([perturbation, "U2OS", "", "24h", concentration, nsn_tag]) + direction, nsn_tag
    return transform


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download(
        "nibrdrugseq", INTERMEDIATE, transform_fn=make_transform(_load_nsn_map()), no_cache=no_cache
    )
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
