#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["pubchempy"]
# ///
"""
Thin wrapper over `pubchempy`
Use Case: 
    - name->CID resolution 
    - CID->properties/synonyms lookups.

Quick test:  uv run etl/perturbseqr_etl/metadata_sources/pubchem/pubchem.py L-Tryptophan vorinostat
"""
import json
import sys
import time
from pathlib import Path

import pubchempy as pcp

HERE = Path(__file__).parent
CACHE_PATH = HERE / "intermediate" / "pubchem_name_cid_cache.json"
RATE_S = 0.2                                                  # ~5 req/s
PROPS = ["Title", "SMILES", "ConnectivitySMILES", "InChIKey"]   # current PUG property names

_last = [0.0]


def _throttle() -> None:
    wait = RATE_S - (time.monotonic() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.monotonic()


# on-disk name to CID cache
_CACHE: dict[str, int | None] = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}


def save_cache() -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(_CACHE))


def name_to_cid(name: str, *, save: bool = True) -> int | None:
    """Resolve a compound name to its top PubChem CID (e.g. 'L-Tryptophan' -> 6305); None if unresolved.
    Cached by lowercased name. Pass save=False inside a batch and call save_cache() once at the end."""
    key = (name or "").strip().lower()
    if not key:
        return None
    if key in _CACHE:
        return _CACHE[key]
    _throttle()
    try:
        cids = pcp.get_cids(name.strip(), "name")
    except Exception:
        cids = []
    _CACHE[key] = cid = (int(cids[0]) if cids else None)
    if save:
        save_cache()
    return cid


def names_to_cids(names) -> dict[str, int | None]:
    """Resolve many names → CID (one PUG REST lookup each; cached). Persists the cache once at the end."""
    out = {n: name_to_cid(n, save=False) for n in names}
    save_cache()
    return out


def inchikey_to_cid(inchikey: str, *, save: bool = True) -> int | None:
    """Resolve a full InChIKey to its top PubChem CID (e.g. 'GVJHHUAWPYXKBD-...' -> 2733526); None if
    unresolved. Cached by namespaced key so it shares the on-disk cache with name_to_cid."""
    ik = (inchikey or "").strip()
    if not ik:
        return None
    key = f"inchikey:{ik}"
    if key in _CACHE:
        return _CACHE[key]
    _throttle()
    try:
        cids = pcp.get_cids(ik, "inchikey")
    except Exception:
        cids = []
    _CACHE[key] = cid = (int(cids[0]) if cids else None)
    if save:
        save_cache()
    return cid


def inchikeys_to_cids(inchikeys) -> dict[str, int | None]:
    """Resolve many InChIKeys → CID (one PUG REST lookup each; cached). Persists the cache periodically
    so a long first run is resumable."""
    out: dict[str, int | None] = {}
    for i, ik in enumerate(inchikeys):
        out[ik] = inchikey_to_cid(ik, save=False)
        if i % 200 == 199:
            save_cache()
    save_cache()
    return out


def smiles_to_cid(smiles: str, *, save: bool = True) -> int | None:
    """Resolve a SMILES string to its top PubChem CID; None if unresolved. Cached by namespaced key.
    Fallback for compounds that carry a SMILES but no InChIKey."""
    smi = (smiles or "").strip()
    if not smi:
        return None
    key = f"smiles:{smi}"
    if key in _CACHE:
        return _CACHE[key]
    _throttle()
    try:
        cids = pcp.get_cids(smi, "smiles")
    except Exception:
        cids = []
    _CACHE[key] = cid = (int(cids[0]) if cids else None)
    if save:
        save_cache()
    return cid


def smiles_to_cids(smiles_list) -> dict[str, int | None]:
    """Resolve many SMILES → CID (one PUG REST lookup each; cached). Persists the cache periodically."""
    out: dict[str, int | None] = {}
    for i, smi in enumerate(smiles_list):
        out[smi] = smiles_to_cid(smi, save=False)
        if i % 200 == 199:
            save_cache()
    save_cache()
    return out


def cids_to_properties(cids, props: list[str] = PROPS) -> dict[int, dict]:
    """Batch CID → {Title, SMILES, ConnectivitySMILES, InChIKey}, 100 CIDs per request."""
    out: dict[int, dict] = {}
    cids = [int(c) for c in cids if c is not None and str(c).strip()]
    for i in range(0, len(cids), 100):
        _throttle()
        try:
            rows = pcp.get_properties(props, cids[i:i + 100], "cid")
        except Exception:
            rows = []
        for p in rows:
            if (c := p.get("CID")) is not None:
                out[int(c)] = {k: p.get(k, "") for k in props}
    return out


def cids_to_synonyms(cids, limit: int | None = None) -> dict[int, list[str]]:
    """Batch CID → list of synonyms (optionally capped to `limit` per CID), 100 CIDs per request."""
    out: dict[int, list[str]] = {}
    cids = [int(c) for c in cids if c is not None and str(c).strip()]
    for i in range(0, len(cids), 100):
        _throttle()
        try:
            rows = pcp.get_synonyms(cids[i:i + 100], "cid")
        except Exception:
            rows = []
        for info in rows:
            if (c := info.get("CID")) is not None:
                syns = info.get("Synonym", []) or []
                out[int(c)] = syns[:limit] if limit else syns
    return out


if __name__ == "__main__":
    queries = sys.argv[1:] or ["L-Tryptophan"]
    cids = names_to_cids(queries)
    print("name -> CID:", cids)
    valid = [c for c in cids.values() if c]
    if valid:
        print("\nCID -> properties:")
        print(json.dumps(cids_to_properties(valid), indent=1))
        print("\nCID -> synonyms (first 6):")
        print(json.dumps(cids_to_synonyms(valid, limit=6), indent=1))
