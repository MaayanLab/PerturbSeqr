# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
LINCS L1000 chemical perturbations (CP) — pruned to top 250 by CD coefficient.

Source: https://maayanlab.cloud/sigcom-lincs/#/Download
Coverage: 156,926 signatures.

Like Ginkgo, the raw GMTs come from internal/manual placement — SigCom LINCS is
client-side gated. Drop the paired files at:
    _cache/lincs-l1000-cp-raw-up.gmt
    _cache/lincs-l1000-cp-raw-down.gmt
(direction is encoded in the filename per the Harmonizome-style convention; terms are bare).

BRD → drug name resolution (programmatic): many raw terms carry opaque Broad reagent codes
(BRD-K04923131, BRD-A00474148, ...) that SigCom's upstream lookup left unresolved. We apply
a second pass via LINCS's unified inventory `instinfo_beta.txt`, filtered to
pert_type == 'trt_cp' via `_lincs.load_pert_map()`. The BRD code is always preserved in both
the last canonical extra AND the description column so traceability is never lost.

Raw source line format (no direction suffix on the term; direction comes from filename):
  ABY001_A375_XH_A13_BRD-K04923131_10uM

Term transform:
  resolved:   "..._BRD-K04923131_10uM" (up file)  ->  "afatinib::A375::::XH::10uM::ABY001::A13::BRD-K04923131 up"     desc="BRD-K04923131"
  unresolved: "..._BRD-K04923131_10uM" (up file)  ->  "BRD-K04923131::A375::::XH::10uM::ABY001::A13::BRD-K04923131 up" desc="BRD-K04923131"
  pre-resolved (already a drug name): "..._afatinib_10uM" (up file)  ->  "afatinib::A375::::XH::10uM::ABY001::A13 up"  desc=""

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/drug_perturbation/lincs-l1000-cp.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/lincs_l1000_cp.py
"""
import gzip
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, CACHE_DIR, D, strip_direction, append_to_description, standardize_gmt
from _lincs import load_pert_map

INTERMEDIATE = DRUG_INTERMEDIATE / "lincs-l1000-cp.gmt.gz"
FINAL = DRUG_OUTPUT / "lincs-l1000-cp.gmt.gz"
# Raw GMTs under db/etl/inputs/drug_perturbation/ (not _cache/) — permanent manual
# placement, the SigCom LINCS download page is client-side gated.
_RAW_DIR = Path(__file__).parent / "drug_perturbation"
RAW_UP = _RAW_DIR / "lincs-l1000-cp-raw-up.gmt"
RAW_DOWN = _RAW_DIR / "lincs-l1000-cp-raw-down.gmt"


def make_transform(brd_map: dict[str, str]):
    def transform(term: str) -> tuple[str, str] | None:
        """Return (canonical_term, description_addition) or None to skip."""
        body, direction = strip_direction(term)
        parts = body.split("_")
        if len(parts) >= 6:
            batch, cell_line, timepoint, well, raw_pert = parts[:5]
            concentration = parts[5]
        elif len(parts) == 5:
            batch, cell_line, timepoint, well, raw_pert = parts
            concentration = ""
        else:
            return body + direction, ""

        if raw_pert.startswith("BRD-"):
            perturbation = brd_map.get(raw_pert, raw_pert)  # fall back to raw code if unresolved
            extras = [batch, well, raw_pert]
            desc = raw_pert
        else:  # pre-resolved drug name
            perturbation = raw_pert
            extras = [batch, well]
            desc = ""
        return D.join([perturbation, cell_line, "", timepoint, concentration, *extras]) + direction, desc
    return transform


def download(no_cache: bool = False) -> Path:
    """Canonicalize the paired LINCS CP up/down GMTs into OUTPUT, resolving BRD codes to names.

    Raw GMTs are internal/manual placement. BRD-map download happens automatically via
    `_lincs.load_pert_map('trt_cp')`.
    """
    if not (RAW_UP.exists() and RAW_DOWN.exists()):
        raise NotImplementedError(
            f"Raw LINCS L1000 CP GMTs are internal/manual placement. Drop the paired sources "
            f"at {RAW_UP} and {RAW_DOWN} and re-run. (SigCom LINCS download page is client-side "
            f"gated; no programmatic URL.)"
        )
    transform = make_transform(load_pert_map("trt_cp"))
    INTERMEDIATE.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with gzip.open(INTERMEDIATE, "wt") as f_out:
        for path, direction in [(RAW_UP, "up"), (RAW_DOWN, "down")]:
            with open(path) as f_in:
                for line in f_in:
                    if not line.strip():
                        continue
                    # Direction is in the filename, not the term — tag it manually.
                    tagged = line.replace("\t", f" {direction}\t", 1)
                    term, _, rest = tagged.partition("\t")
                    result = transform(term)
                    if result is None:
                        continue
                    new_term, desc_addition = result
                    old_desc, _, genes = rest.partition("\t")
                    f_out.write(f"{new_term}\t{append_to_description(old_desc, desc_addition)}\t{genes}")
                    n += 1
    print(f"  {INTERMEDIATE.name}: {n} terms (BRD- codes resolved via instinfo_beta.txt)")
    standardize_gmt(INTERMEDIATE, FINAL)
    return FINAL


if __name__ == "__main__":
    print(download())
