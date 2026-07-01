"""
Shared LINCS helpers for lincs_l1000/{cp,xpr}/gmt.py + cell-line metadata:
  - load_pert_map: reagent code (BRD-K/BRD-A trt_cp, BRDN trt_xpr) -> cmap_name (instinfo_beta.txt)
  - load_sig_map:  (plate, cell, time, well) -> (pert_id, cmap_name) via siginfo_beta.txt distil_ids
  - strip_cell_suffix: drop the meaningless ".311"/".311B" cell-name suffix
"""
import csv
import re
from pathlib import Path

from perturbseqr_etl.data_sources import CACHE_DIR
from perturbseqr_etl.dataloader import download_to

INSTINFO_URL = "https://s3.amazonaws.com/macchiato.clue.io/builds/LINCS2020/instinfo_beta.txt"
INSTINFO_CACHE = CACHE_DIR / "instinfo_beta.txt"
SIGINFO_URL = "https://s3.amazonaws.com/macchiato.clue.io/builds/LINCS2020/siginfo_beta.txt"
SIGINFO_CACHE = CACHE_DIR / "siginfo_beta.txt"

_CELL_SUFFIX_RE = re.compile(r"\.311[A-Za-z]?$")


def strip_cell_suffix(cell_line: str) -> str:
    """Drop the meaningless LINCS '.311'/'.311B' cell-name suffix; leave engineered variants intact."""
    return _CELL_SUFFIX_RE.sub("", cell_line)


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


SigKey = tuple[str, str, str, str]


def _sig_map_cache_path(pert_type: str) -> Path:
    return CACHE_DIR / f"lincs_{pert_type}_sig_map.tsv"


def _build_sig_map(pert_type: str) -> dict[SigKey, tuple[str, str]]:
    """Stream siginfo_beta.txt; map each pert_type signature's (plate, cell, time, well), parsed from
    its distil_ids (e.g. 'MOAR005_A375_24H_X1_B34:D18'), to (pert_id, cmap_name). Write a 6-col TSV."""
    download_to(SIGINFO_URL, SIGINFO_CACHE)
    out: dict[SigKey, tuple[str, str]] = {}
    with open(SIGINFO_CACHE) as f:
        for row in csv.DictReader(f, delimiter="\t"):
            if row.get("pert_type") != pert_type:
                continue
            value = ((row.get("pert_id") or "").strip(), (row.get("cmap_name") or "").strip())
            for distil in (row.get("distil_ids") or "").split("|"):
                left, _, well = distil.partition(":")            # <plate>_<cell>_<time>_X<rep>_B<bead> : <well>
                fields = left.split("_")
                if len(fields) < 3 or not well:
                    continue
                out.setdefault((fields[0], fields[1], fields[2], well), value)

    cache = _sig_map_cache_path(pert_type)
    cache.parent.mkdir(parents=True, exist_ok=True)
    with open(cache, "w") as f:
        for (plate, cell, time, well), (pid, name) in sorted(out.items()):
            f.write(f"{plate}\t{cell}\t{time}\t{well}\t{pid}\t{name}\n")
    return out


def load_sig_map(pert_type: str) -> dict[SigKey, tuple[str, str]]:
    """{(plate, cell, time, well) → (pert_id, cmap_name)} keyed as a GMT term's structural prefix.
    Builds the filtered cache on first call."""
    cache = _sig_map_cache_path(pert_type)
    if not cache.exists():
        return _build_sig_map(pert_type)
    out: dict[SigKey, tuple[str, str]] = {}
    with open(cache) as f:
        for line in f:
            cols = line.rstrip("\n").split("\t")
            if len(cols) == 6:
                out[(cols[0], cols[1], cols[2], cols[3])] = (cols[4], cols[5])
    return out
