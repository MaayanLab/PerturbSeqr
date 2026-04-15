# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Shared LINCS instinfo_beta.txt parser used by lincs_l1000_cp.py and lincs_l1000_xpr.py.

Both modules resolve opaque reagent codes in their perturbation slot by looking up
`cmap_name` for a given `pert_id` in LINCS's unified inventory. They differ only in
which `pert_type` they filter on:

    pert_type == "trt_cp"   -> BRD-K / BRD-A / ... chemical codes  (lincs_l1000_cp)
    pert_type == "trt_xpr"  -> BRDN CRISPR reagent codes           (lincs_l1000_xpr)

The full instinfo file is ~1 GB; the filtered-per-pert_type subsets are ~150–250 KB.
We cache both the raw download and each filtered subset so re-runs are instant.

Pipeline: shared helper, not directly runnable. Imported by lincs_l1000_*.py.
"""
import csv
from pathlib import Path

from _utils import CACHE_DIR, download_to

INSTINFO_URL = "https://s3.amazonaws.com/macchiato.clue.io/builds/LINCS2020/instinfo_beta.txt"
INSTINFO_CACHE = CACHE_DIR / "instinfo_beta.txt"


def _filter_cache_path(pert_type: str) -> Path:
    return CACHE_DIR / f"lincs_{pert_type}_pert_map.tsv"


def _build_pert_map(pert_type: str) -> dict[str, str]:
    """Stream instinfo_beta.txt, keep rows matching pert_type, write 2-col TSV cache."""
    download_to(INSTINFO_URL, INSTINFO_CACHE)
    out: dict[str, str] = {}
    with open(INSTINFO_CACHE) as f:
        for row in csv.DictReader(f, delimiter="\t"):
            if row.get("pert_type") != pert_type:
                continue
            pert_id = (row.get("pert_id") or "").strip()
            cmap_name = (row.get("cmap_name") or "").strip()
            if pert_id and cmap_name and pert_id not in out:
                out[pert_id] = cmap_name

    cache = _filter_cache_path(pert_type)
    cache.parent.mkdir(parents=True, exist_ok=True)
    with open(cache, "w") as f:
        for pid, name in sorted(out.items()):
            f.write(f"{pid}\t{name}\n")
    return out


def load_pert_map(pert_type: str) -> dict[str, str]:
    """Return {pert_id → cmap_name} for the given LINCS pert_type (e.g. 'trt_cp', 'trt_xpr').

    Builds the filtered cache on first call; subsequent calls read the cached TSV directly.
    """
    cache = _filter_cache_path(pert_type)
    if not cache.exists():
        return _build_pert_map(pert_type)
    out: dict[str, str] = {}
    with open(cache) as f:
        for line in f:
            pid, _, name = line.rstrip("\n").partition("\t")
            if pid and name:
                out[pid] = name
    return out
