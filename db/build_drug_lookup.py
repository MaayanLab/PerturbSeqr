# /// script
# requires-python = ">=3.14"
# dependencies = [
#   "requests",
#   "tqdm",
# ]
# ///
"""
Build drug_lookup.json with CID and MOA data from multiple sources.

Usage:
  uv run db/build_drug_lookup.py
  uv run db/build_drug_lookup.py --download  # Re-download Drug Repurposing Hub
"""

import csv, json, time, argparse
from pathlib import Path
from collections import Counter

import requests
from tqdm import tqdm
from gmt_parser import read_gmt
from perturbation_parser import extract_perturbation
from db_utils import DATA_DIR, METADATA_DIR, DRUG_DIR, DRUG_LOOKUP_PATH, get_lib_config

# Latest public version (2024 requires auth): https://repo-hub.broadinstitute.org/repurposing
HUB_BASE = "https://s3.amazonaws.com/data.clue.io/repurposing/downloads/repurposing_{}_20200324.txt"


def download_hub():
    """Download Drug Repurposing Hub → drug_master.json."""
    print("Downloading Drug Repurposing Hub...")
    skip_header = lambda url: (l for l in requests.get(url, timeout=60).text.splitlines() if not l.startswith("!"))
    drugs = {r["pert_iname"]: {"moa": r.get("moa", ""), "target": r.get("target", ""),
             "fda_approved": r.get("clinical_phase") == "Launched"}
             for r in csv.DictReader(skip_header(HUB_BASE.format("drugs")), delimiter="\t") if r.get("pert_iname")}
    for r in csv.DictReader(skip_header(HUB_BASE.format("samples")), delimiter="\t"):
        if (n := r.get("pert_iname")) and n in drugs and "pubchem_cid" not in drugs[n]:
            drugs[n].update({"pubchem_cid": r.get("pubchem_cid", ""), "inchi_key": r.get("InChIKey", "")})
    json.dump(drugs, open(METADATA_DIR / "drug_master.json", "w"))
    print(f"  Saved {len(drugs)} drugs")

CID_CACHE_PATH = DATA_DIR / 'cache' / 'pubchem_cid_cache.json'

LIBS_NEEDING_GMT_SCAN = {"cmap-build02", "sciplex", "deepcovermoa", "geo-chem", "ginkgo"}

# Helpers
load_tsv = lambda p: csv.DictReader(open(p), delimiter='\t')


clean_cid = lambda v: "" if (v := str(v).replace(".0", "").strip()) in ("", "nan", "None") else v


def add_keyed_entries(result: dict, code: str, name: str, entry: dict):
    """Add lookup entries for both code (e.g. BRD-xxx) and name."""
    if code:
        result[code.lower()] = {**entry, "resolved_name": name if name and name != code else ""}
    if name and (not code or name.lower() != code.lower()):
        result[name.lower()] = entry


def add_to_lookup(lookup: dict, entries: dict, source: str, cid_fn=None) -> int:
    """Add entries to lookup, return count with CIDs."""
    count = 0
    for name, info in entries.items():
        if name not in lookup:
            cid = (cid_fn(name) if cid_fn else info.get("cid")) or ""
            lookup[name] = {"cid": cid, "moa": "", "target": info.get("target", ""),
                           "fda_approved": info.get("fda_approved", False), "source": source,
                           "_dataset_moa": info.get("moa", "")}
            if info.get("resolved_name"): lookup[name]["resolved_name"] = info["resolved_name"]
            if cid: count += 1
    return count


def apply_hub_info(info: dict, hub_info: dict):
    """Apply Hub MOA/target/FDA to entry."""
    info["moa"] = hub_info["moa"]
    info["fda_approved"] = hub_info.get("fda_approved", False)
    if hub_info.get("target") and not info.get("target"): info["target"] = hub_info["target"]


def load_drug_repurposing_hub() -> tuple[dict[str, dict], dict[str, dict]]:
    """Load Drug Repurposing Hub → (by_name, by_cid) dicts."""
    path = METADATA_DIR / "drug_master.json"
    assert path.exists(), f"Missing {path}"

    data = json.load(open(path))
    by_name = {
        name.lower(): {"cid": clean_cid(info.get("pubchem_cid", "")), "moa": info.get("moa") or "",
                       "target": info.get("target") or "", "fda_approved": info.get("fda_approved", False),
                       "source": "drug_repurposing_hub"}
        for name, info in data.items()
    }
    by_cid = {e["cid"]: e for e in by_name.values() if e["cid"] and e["moa"]}
    print(f"Loaded Hub: {len(by_name)} drugs, {len(by_cid)} with CID+MOA")
    return by_name, by_cid


def load_metadata(source: str) -> dict[str, dict]:
    """Load normalized metadata file (tahoe.tsv, drugseqr.tsv, or lincs.tsv)."""
    path = METADATA_DIR / f"{source}.tsv"
    assert path.exists(), f"Missing {path}"

    result = {}
    for row in load_tsv(path):
        name, code = row.get("name", "").strip(), row.get("code", "").strip()
        entry = {
            "cid": row.get("cid", "").strip(),
            "moa": row.get("moa", "").strip(),
            "target": row.get("target", "").strip(),
            "fda_approved": row.get("fda_approved", "").lower() == "true",
            "inchi_key": row.get("inchi_key", "").strip(),
        }
        add_keyed_entries(result, code, name, entry)
    print(f"Loaded {source}: {len(result)} entries")
    return result


load_cid_cache = lambda: json.load(open(CID_CACHE_PATH)) if CID_CACHE_PATH.exists() else {}
save_cid_cache = lambda c: CID_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True) or json.dump(c, open(CID_CACHE_PATH, 'w'))


def fetch_cids_from_pubchem(names: list[str] = None, inchi_keys: list[str] = None, cache: dict = None) -> dict[str, str]:
    """Fetch CIDs from PubChem via name or InChI key."""
    if inchi_keys:
        items, bs, results = list({k for k in inchi_keys if k}), 100, {}
    elif names and cache is not None:
        results = {k: cache[k] for n in names if (k := n.lower().strip()) in cache and cache[k]}
        items, bs = [n for n in names if n.lower().strip() not in cache], 1
    else:
        return {}
    if not items: return results

    for batch in tqdm([items[i:i+bs] for i in range(0, len(items), bs)], desc=f"PubChem ({len(items)})"):
        try:
            url = f'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/{"inchikey/"+",".join(batch)+"/property/InChIKey" if inchi_keys else "name/"+requests.utils.quote(batch[0])+"/cids"}/JSON'
            data = requests.get(url, timeout=30).json()
            if inchi_keys:
                results.update({p['InChIKey']: str(p['CID']) for p in data.get('PropertyTable', {}).get('Properties', []) if p.get('CID') and p.get('InChIKey')})
            else:
                cache[k := batch[0].lower().strip()] = cid = str(c[0]) if (c := data.get("IdentifierList", {}).get("CID", [])) else None
                if cid: results[k] = cid
        except:
            if names: cache[batch[0].lower().strip()] = None
        time.sleep(0.2)
    return results


def build_unified_lookup(skip_pubchem: bool = False) -> dict[str, dict]:
    """
    Build unified drug lookup with CID normalization.

    Strategy:
    1. Libraries with metadata (Tahoe, DRUGseqr, LINCS): Use metadata directly for CID
    2. Libraries without metadata: Scan GMTs, match Hub, then PubChem fallback
    3. MOA: Always try Hub first, then dataset fallback, then "Unknown"
    """

    # Load all data sources
    hub_by_name, hub_by_cid = load_drug_repurposing_hub()
    cid_cache = load_cid_cache()
    print(f"Loaded CID cache: {len(cid_cache)} entries ({sum(1 for v in cid_cache.values() if v)} with CIDs)")

    print("\n[1/4] Loading metadata libraries...")
    lookup = {}
    for source in ["tahoe", "drugseqr", "lincs"]:
        meta = load_metadata(source)

        # LINCS needs InChI → CID resolution
        cid_fn = None
        if source == "lincs" and not skip_pubchem:
            inchi_to_name = {info["inchi_key"]: name for name, info in meta.items() if info.get("inchi_key")}
            if inchi_to_name:
                inchi_to_cid = fetch_cids_from_pubchem(inchi_keys=list(inchi_to_name.keys()))
                lincs_cids = {inchi_to_name[k]: v for k, v in inchi_to_cid.items() if k in inchi_to_name}
                print(f"  LINCS InChI resolution: {len(lincs_cids)} CIDs")
                cid_fn = lincs_cids.get

        print(f"  {source}: {len(meta)} entries, {add_to_lookup(lookup, meta, source, cid_fn)} with CID")

    print("\n[2/4] Scanning GMT files for libraries without metadata...")
    is_valid_pert = lambda p: p and len(p) > 2 and not p.replace('.', '').replace('-', '').isdigit()
    gmt_perturbations = set()
    for lib_key in LIBS_NEEDING_GMT_SCAN:
        config = get_lib_config(lib_key)
        for gmt_file in DRUG_DIR.glob(f"{lib_key}*.gmt*"):
            print(f"  Scanning {gmt_file.name}...")
            for (term, _), _ in read_gmt(gmt_file):
                if (pert := extract_perturbation(term, lib_config=config)) and is_valid_pert(pert := pert.strip().lower()):
                    gmt_perturbations.add(pert)
    print(f"  Found {len(gmt_perturbations)} unique perturbations")

    # For each GMT perturbation not already in lookup, create entry from Hub or empty
    new_perts = {p: hub_by_name.get(p, {}) for p in gmt_perturbations if p not in lookup}
    for p, info in new_perts.items():
        lookup[p] = {"cid": info.get("cid", ""), "moa": "", "target": info.get("target", ""),
                     "fda_approved": info.get("fda_approved", False),
                     "source": "drug_repurposing_hub" if info else ""}
    hub_matches = sum(1 for info in new_perts.values() if info)
    print(f"  New from GMT: {len(new_perts)}, Hub matches: {hub_matches}")

    if not skip_pubchem:
        print("\n[3/4] PubChem fallback...")
        # Apply cached CIDs, then lookup remaining
        for name, info in lookup.items():
            if not info.get("cid") and (cached := cid_cache.get(name)):
                info["cid"], info["source"] = cached, info["source"] or "pubchem"

        names_needing = [n for n, i in lookup.items() if not i.get("cid") and n not in cid_cache
                        and i.get("source") not in ("tahoe", "drugseqr", "lincs")]
        new_cids = fetch_cids_from_pubchem(names=names_needing, cache=cid_cache) if names_needing else {}
        for name, cid in new_cids.items():
            if name in lookup:
                lookup[name]["cid"], lookup[name]["source"] = cid, lookup[name]["source"] or "pubchem"
        save_cid_cache(cid_cache)
        print(f"  Resolved {len(new_cids)} CIDs, cache has {len(cid_cache)} entries")

    print("\n[4/4] Resolving MOA...")
    stats = {"hub_name": 0, "hub_cid": 0, "dataset_fallback": 0, "unknown": 0}

    for name, info in tqdm(lookup.items(), desc="Resolving MOA"):
        cid, dataset_moa = info.get("cid", ""), info.pop("_dataset_moa", "")
        if (hub := hub_by_name.get(name)) and hub.get("moa"):
            apply_hub_info(info, hub); stats["hub_name"] += 1
        elif cid and (hub := hub_by_cid.get(cid)) and hub.get("moa"):
            apply_hub_info(info, hub); stats["hub_cid"] += 1
        elif dataset_moa and info.get("source") in ("tahoe", "drugseqr", "lincs"):
            info["moa"] = dataset_moa; stats["dataset_fallback"] += 1
        else:
            stats["unknown"] += 1

    print(f"  MOA: {stats['hub_name']} hub(name), {stats['hub_cid']} hub(cid), {stats['dataset_fallback']} fallback, {stats['unknown']} unknown")

    return lookup


def main():
    parser = argparse.ArgumentParser(description="Build unified drug lookup JSON")
    parser.add_argument("--skip-pubchem", action="store_true", help="Skip PubChem API calls")
    parser.add_argument("--download", action="store_true", help="Re-download Drug Repurposing Hub")
    parser.add_argument("--output", "-o", type=str, default=str(DRUG_LOOKUP_PATH))
    args = parser.parse_args()

    if args.download or not (METADATA_DIR / "drug_master.json").exists():
        download_hub()

    print("Building drug_lookup.json...")
    lookup = build_unified_lookup(skip_pubchem=args.skip_pubchem)

    print("\nResults:")
    total = len(lookup)
    pct = lambda n: f"{n} ({100*n/total:.1f}%)"
    print(f"Total: {total}, CID: {pct(sum(1 for d in lookup.values() if d.get('cid')))}, "
          f"MOA: {pct(sum(1 for d in lookup.values() if d.get('moa')))}, "
          f"Target: {pct(sum(1 for d in lookup.values() if d.get('target')))}, "
          f"FDA: {sum(1 for d in lookup.values() if d.get('fda_approved'))}")
    print("By source:", {src: pct(n) for src, n in Counter(d.get("source") or "unknown" for d in lookup.values()).most_common()})

    # Save
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(lookup, f)

    print(f"\nSaved to {output_path}")
    print(f"File size: {output_path.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
