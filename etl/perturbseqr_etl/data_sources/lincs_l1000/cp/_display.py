"""Readable display names for LINCS L1000 CP perturbations whose siginfo cmap_name is just the BRD code."""
import sys
from pathlib import Path

import pandas as pd

from perturbseqr_etl.data_sources import CACHE_DIR
from perturbseqr_etl.data_sources.lincs_l1000._lincs import load_sig_map

COMPOUNDINFO = CACHE_DIR / "compoundinfo_beta.txt"
CACHE = CACHE_DIR / "lincs_cp_display_names.tsv"
UPSTREAM = Path(__file__).parent.parent / "upstream"
UPSTREAM_GMTS = [UPSTREAM / "lincs-l1000-cp-pruned-up.gmt", UPSTREAM / "lincs-l1000-cp-pruned-down.gmt"]


def _cp_pert_ids() -> set[str]:
    """The pert_ids the pruned CP GMT actually uses (each upstream structural key -> its siginfo pert_id)."""
    sig = load_sig_map("trt_cp")
    pids: set[str] = set()
    for path in UPSTREAM_GMTS:
        with open(path) as f:
            for line in f:
                p = line.split("\t", 1)[0].split("_")
                if len(p) >= 4 and (hit := sig.get((p[0], p[1], p[2], p[3]))):
                    pids.add(hit[0])
    return pids


def _build() -> dict[str, str]:
    from perturbseqr_etl.metadata_sources.pubchem import pubchem   # lazy: pubchempy is an optional source dep
    ci = pd.read_csv(COMPOUNDINFO, sep="\t", dtype=str, keep_default_na=False)
    unnamed = ci[(ci["cmap_name"] == ci["pert_id"]) & ci["pert_id"].isin(_cp_pert_ids())]   # BRD-coded AND in the CP GMT
    out: dict[str, str] = {}
    need: list[tuple[str, str, str]] = []                         # (pert_id, inchi_key, smiles) lacking an alias
    for r in unnamed.itertuples(index=False):
        if (alias := r.compound_aliases.strip()):
            out[r.pert_id] = alias
        elif r.inchi_key or r.canonical_smiles:
            need.append((r.pert_id, r.inchi_key, r.canonical_smiles))

    # fall back to the PubChem Title. Resolve a CID (cached) from the InChIKey, then SMILES, then fetch titles.
    ik2cid = pubchem.inchikeys_to_cids(sorted({ik for _, ik, _ in need if ik}))
    pid2cid: dict[str, int] = {}
    smi_need: list[tuple[str, str]] = []
    for pid, ik, smi in need:
        if ik and (cid := ik2cid.get(ik)):
            pid2cid[pid] = cid
        elif smi:
            smi_need.append((pid, smi))
    smi2cid = pubchem.smiles_to_cids(sorted({smi for _, smi in smi_need}))
    for pid, smi in smi_need:
        if (cid := smi2cid.get(smi)):
            pid2cid[pid] = cid

    titles = pubchem.cids_to_properties(sorted(set(pid2cid.values())))   # {cid: {"Title", ...}}, batched
    for pid, cid in pid2cid.items():
        if (title := titles.get(cid, {}).get("Title", "").strip()):
            out[pid] = title
    return out


def display_names(no_cache: bool = False) -> dict[str, str]:
    """{pert_id (BRD) → readable name} for CP compounds whose siginfo cmap_name is just the BRD code."""
    if CACHE.exists() and not no_cache:
        out: dict[str, str] = {}
        with open(CACHE) as f:
            for line in f:
                pid, _, name = line.rstrip("\n").partition("\t")
                if pid and name:
                    out[pid] = name
        return out
    out = _build()
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE, "w") as f:
        for pid, name in sorted(out.items()):
            f.write(f"{pid}\t{name}\n")
    return out


if __name__ == "__main__":
    print(f"{len(display_names(no_cache='--no-cache' in sys.argv))} BRD → readable-name mappings")
