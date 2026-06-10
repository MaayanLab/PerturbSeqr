# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Shared LINCS instinfo_beta.txt parser used by lincs_l1000_{cp,xpr}.py to resolve
reagent codes (BRD-K / BRD-A for trt_cp, BRDN for trt_xpr) to cmap_name.
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
    """{pert_id → cmap_name} for the given LINCS pert_type. Builds the filtered cache on first call."""
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
