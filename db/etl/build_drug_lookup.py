# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "requests",
#   "tqdm",
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
# ]
# ///
"""
Build drug_lookup.json with CID and MOA data from multiple sources.

Uses IDMapper from maayanlab-bioinformatics for entity resolution:
- Unifies entities via shared synonyms (names, InChI keys)
- Tracks conflicts when same synonym maps to different chemical entities
- Propagates CIDs across sources via entity linking

Usage:
  uv run db/build_drug_lookup.py
  uv run db/build_drug_lookup.py --download  # Re-download Drug Repurposing Hub
"""

import csv, json, time, argparse, sys
from pathlib import Path
from collections import Counter
from uuid import UUID

# Add db/ (parent dir) to path for shared modules
sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
from tqdm import tqdm
from maayanlab_bioinformatics.harmonization import IDMapper
from gmt_parser import read_gmt
from perturbation_parser import extract_perturbation
from db_utils import DATA_DIR, METADATA_DIR, DRUG_DIR, DRUG_LOOKUP_PATH, get_lib_config

# Latest public version (2024 requires auth): https://repo-hub.broadinstitute.org/repurposing
HUB_BASE = "https://s3.amazonaws.com/data.clue.io/repurposing/downloads/repurposing_{}_20200324.txt"

# Namespaces for IDMapper
NS_PUBCHEM_CID = "pubchem_cid"
NS_INCHI_KEY = "inchi_key"
NS_LINCS_BRD = "lincs_brd"
NS_DRUGSEQR_NSN = "drugseqr_nsn"
NS_TAHOE_CODE = "tahoe_code"
NS_DRUG_NAME = "drug_name"
NS_HUB_NAME = "hub_name"

# Map file names to display names for source attribution
SOURCE_DISPLAY_NAMES = {
    "drugseqr": "NIBR DRUG-seq",
    "tahoe": "tahoe",
    "lincs": "lincs",
}

LIBS_NEEDING_GMT_SCAN = {"microarrays-cmap", "sciplex", "deepcover-moa", "creeds-chem", "ginkgo-bioworks", "rummageo-chem"}


class DrugEntityStore:
    """Combines IDMapper with metadata storage for drug entities."""

    def __init__(self):
        self.mapper = IDMapper()
        self.metadata = {}  # {uuid: {moa, target, fda_approved, sources, primary_name}}

    def _get_or_create_metadata(self, entity_id: UUID) -> dict:
        """Get or create metadata dict for an entity."""
        if entity_id not in self.metadata:
            self.metadata[entity_id] = {
                "moa": "", "target": "", "fda_approved": False,
                "sources": [], "moa_source": "", "primary_name": ""
            }
        return self.metadata[entity_id]

    def _merge_metadata(self, entity_id: UUID, info: dict, source: str):
        """Merge metadata from a source into entity."""
        meta = self._get_or_create_metadata(entity_id)

        # Track sources
        if source and source not in meta["sources"]:
            meta["sources"].append(source)

        # MOA: prefer Hub, then first non-empty
        if info.get("moa") and not meta["moa"]:
            meta["moa"] = info["moa"]
            meta["moa_source"] = source

        # Target: merge if new
        if info.get("target") and not meta["target"]:
            meta["target"] = info["target"]

        # FDA: any True wins
        if info.get("fda_approved"):
            meta["fda_approved"] = True

        # Primary name: prefer actual drug names over codes
        name = info.get("name", "")
        if name and not meta["primary_name"]:
            meta["primary_name"] = name
        elif name and not name.startswith("BRD-") and meta["primary_name"].startswith("BRD-"):
            meta["primary_name"] = name

    def add_hub_entry(self, name: str, info: dict):
        """Add entry from Drug Repurposing Hub."""
        synonyms = {name.lower()}

        # Add InChI key as synonym (links to LINCS entries)
        if inchi := info.get("inchi_key"):
            synonyms.add(inchi)

        # Add entry with hub_name namespace
        self.mapper.update({name.lower(): synonyms}, namespace=NS_HUB_NAME)

        # Also register CID in its own namespace if present
        if cid := info.get("pubchem_cid"):
            cid = clean_cid(cid)
            if cid:
                # CID links to the same entity via the name synonym
                self.mapper.update({cid: {name.lower()}}, namespace=NS_PUBCHEM_CID)

        # Store metadata
        entity_id = self.mapper._reverse.get(name.lower())
        if entity_id:
            self._merge_metadata(entity_id, {**info, "name": name}, "drug_repurposing_hub")

    def add_metadata_entry(self, source: str, code: str, name: str, info: dict):
        """Add entry from metadata source (tahoe, drugseqr, lincs)."""
        # Build synonym set
        synonyms = set()
        if name:
            synonyms.add(name.lower())
        if inchi := info.get("inchi_key"):
            synonyms.add(inchi)

        # Determine namespace based on source
        ns_map = {
            "tahoe": NS_TAHOE_CODE,
            "drugseqr": NS_DRUGSEQR_NSN,
            "lincs": NS_LINCS_BRD,
        }
        namespace = ns_map.get(source, source)

        # Add to mapper - code is the primary ID
        key = code.lower() if code else name.lower()
        self.mapper.update({key: synonyms}, namespace=namespace)

        # Also add CID to its namespace if present
        if cid := clean_cid(info.get("cid", "")):
            # Link CID to entity via the key
            self.mapper.update({cid: {key}}, namespace=NS_PUBCHEM_CID)

        # Store metadata
        entity_id = self.mapper._reverse.get(key)
        if entity_id:
            display_source = SOURCE_DISPLAY_NAMES.get(source, source)
            self._merge_metadata(entity_id, {**info, "name": name or code}, display_source)

    def add_gmt_perturbation(self, pert: str, hub_info: dict = None):
        """Add perturbation found in GMT file."""
        # Only add if not already known
        if pert.lower() in self.mapper._reverse:
            return

        synonyms = {pert.lower()}
        self.mapper.update({pert.lower(): synonyms}, namespace=NS_DRUG_NAME)

        entity_id = self.mapper._reverse.get(pert.lower())
        if entity_id and hub_info:
            self._merge_metadata(entity_id, hub_info, "drug_repurposing_hub")

    def resolve_inchi_to_cid(self, skip_pubchem: bool = False):
        """Resolve InChI keys to CIDs for entities missing them."""
        if skip_pubchem:
            return

        # Find entities with InChI but no CID
        entities_needing_cid = []
        for entity_id in self.mapper._forward.keys():
            refs = self.mapper._namespaces.get(entity_id, {})
            if NS_PUBCHEM_CID in refs:
                continue  # Already has CID

            # Check if any synonym is an InChI key
            for synonym in self.mapper._forward[entity_id].keys():
                if is_inchi_key(synonym):
                    entities_needing_cid.append((entity_id, synonym))
                    break

        if not entities_needing_cid:
            return

        print(f"  Resolving {len(entities_needing_cid)} InChI keys to CIDs...")

        # Batch resolve
        inchi_keys = list({inchi for _, inchi in entities_needing_cid})
        inchi_to_cid = fetch_cids_from_pubchem(inchi_keys=inchi_keys)

        # Update mapper with resolved CIDs
        resolved = 0
        for entity_id, inchi in entities_needing_cid:
            if cid := inchi_to_cid.get(inchi):
                # Add CID to entity via the InChI synonym
                self.mapper.update({cid: {inchi}}, namespace=NS_PUBCHEM_CID)
                resolved += 1

        print(f"  Resolved {resolved} CIDs from InChI keys")

    def resolve_names_to_cid(self, cid_cache: dict, skip_pubchem: bool = False):
        """Resolve remaining names to CIDs via PubChem."""
        if skip_pubchem:
            return

        # Find entities without CID that have a drug name
        names_to_resolve = []
        for entity_id in self.mapper._forward.keys():
            refs = self.mapper._namespaces.get(entity_id, {})
            if NS_PUBCHEM_CID in refs:
                continue

            # Get the primary name for this entity
            meta = self.metadata.get(entity_id, {})
            name = meta.get("primary_name", "")
            if name and name.lower() not in cid_cache:
                names_to_resolve.append((entity_id, name.lower()))

        # Apply cached CIDs first
        applied_from_cache = 0
        for entity_id in list(self.mapper._forward.keys()):
            # Entity may have been merged away by previous update
            if entity_id not in self.mapper._forward:
                continue
            refs = self.mapper._namespaces.get(entity_id, {})
            if NS_PUBCHEM_CID in refs:
                continue

            # Check if any synonym has a cached CID
            for synonym in list(self.mapper._forward[entity_id].keys()):
                if cached_cid := cid_cache.get(synonym):
                    self.mapper.update({cached_cid: {synonym}}, namespace=NS_PUBCHEM_CID)
                    applied_from_cache += 1
                    break

        print(f"  Applied {applied_from_cache} CIDs from cache")

        if not names_to_resolve:
            return

        # Query all names not yet in cache (InChI resolution may have failed for some)
        names_to_query = [(eid, name) for eid, name in names_to_resolve if name not in cid_cache]

        if not names_to_query:
            return

        print(f"  Querying PubChem for {len(names_to_query)} names...")
        new_cids = fetch_cids_from_pubchem(names=[n for _, n in names_to_query], cache=cid_cache)

        # Update mapper with resolved CIDs
        resolved = 0
        for entity_id, name in names_to_query:
            if cid := new_cids.get(name):
                self.mapper.update({cid: {name}}, namespace=NS_PUBCHEM_CID)
                resolved += 1

        print(f"  Resolved {resolved} CIDs from name search")

    def export_lookup(self) -> dict:
        """Export to backward-compatible drug_lookup.json format."""
        lookup = {}

        for entity_id in self.mapper._forward.keys():
            refs = self.mapper._namespaces.get(entity_id, {})
            meta = self.metadata.get(entity_id, {})
            synonyms = self.mapper._forward[entity_id]

            # Get CID from namespace refs (None if missing)
            cid = refs.get(NS_PUBCHEM_CID) or None

            # Determine primary source
            sources = meta.get("sources", [])
            primary_source = sources[0] if sources else None

            # Base entry (use None for missing values, not empty string)
            entry = {
                "cid": cid,
                "moa": meta.get("moa") or None,
                "target": meta.get("target") or None,
                "fda_approved": meta.get("fda_approved", False),
                "source": primary_source,
            }
            if meta.get("moa_source"):
                entry["moa_source"] = meta["moa_source"]

            # Get primary name for resolved_name field
            primary_name = meta.get("primary_name", "")

            # Add entry for each lookup key
            for synonym in synonyms.keys():
                syn_lower = str(synonym).lower()

                # Skip InChI keys and CIDs as lookup keys
                if is_inchi_key(syn_lower) or syn_lower == cid:
                    continue

                # Determine if this is a code that needs resolved_name
                is_code = (
                    syn_lower.startswith("brd-") or
                    syn_lower.startswith("if-") or
                    (len(syn_lower) > 5 and syn_lower[:2].isalpha() and "-" in syn_lower)
                )

                if is_code and primary_name and primary_name.lower() != syn_lower:
                    lookup[syn_lower] = {**entry, "resolved_name": primary_name}
                else:
                    lookup[syn_lower] = entry.copy()

        return lookup

    def export_conflicts(self) -> dict:
        """Export conflict report for debugging."""
        return {
            "summary": dict(self.mapper.conflicts_summary()),
            "top_conflicts": [
                {"synonym": str(syn), "namespace": ns, "count": count}
                for (ns, syn), count in self.mapper.top_conflicts().most_common(100)
            ],
            "details": {
                ns: {
                    str(syn): {str(k): str(v) for k, v in cases.items()}
                    for syn, cases in conflicts.items()
                }
                for ns, conflicts in self.mapper._conflicts.items()
            }
        }

    def export_coverage(self) -> dict:
        """Export coverage statistics."""
        total = len(self.mapper._forward)

        # Count entities per namespace
        ns_counts = Counter()
        for refs in self.mapper._namespaces.values():
            for ns in refs.keys():
                ns_counts[ns] += 1

        # Count entities with metadata
        with_moa = sum(1 for m in self.metadata.values() if m.get("moa"))
        with_target = sum(1 for m in self.metadata.values() if m.get("target"))
        fda_approved = sum(1 for m in self.metadata.values() if m.get("fda_approved"))

        return {
            "total_entities": total,
            "with_cid": ns_counts.get(NS_PUBCHEM_CID, 0),
            "with_moa": with_moa,
            "with_target": with_target,
            "fda_approved": fda_approved,
            "namespace_coverage": dict(ns_counts),
            "namespace_overlap": {"+".join(sorted(k)): v for k, v in self.mapper.summary().items()},
        }


# Helpers
load_tsv = lambda p: csv.DictReader(open(p), delimiter='\t')
clean_cid = lambda v: "" if (v := str(v).replace(".0", "").strip()) in ("", "nan", "None") else v
is_inchi_key = lambda s: isinstance(s, str) and len(s) == 27 and s.count("-") == 2 and s[14] == "-" and s[25] == "-"

CID_CACHE_PATH = DATA_DIR / 'cache' / 'pubchem_cid_cache.json'
load_cid_cache = lambda: json.load(open(CID_CACHE_PATH)) if CID_CACHE_PATH.exists() else {}
save_cid_cache = lambda c: CID_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True) or json.dump(c, open(CID_CACHE_PATH, 'w'))


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


def load_drug_repurposing_hub() -> dict[str, dict]:
    """Load Drug Repurposing Hub → dict by name."""
    path = METADATA_DIR / "drug_master.json"
    assert path.exists(), f"Missing {path}"
    return json.load(open(path))


def load_metadata(source: str) -> list[tuple[str, str, dict]]:
    """Load normalized metadata file, return list of (code, name, info) tuples."""
    path = METADATA_DIR / f"{source}.tsv"
    assert path.exists(), f"Missing {path}"

    result = []
    for row in load_tsv(path):
        name, code = row.get("name", "").strip(), row.get("code", "").strip()
        info = {
            "cid": row.get("cid", "").strip(),
            "moa": row.get("moa", "").strip(),
            "target": row.get("target", "").strip(),
            "fda_approved": row.get("fda_approved", "").lower() == "true",
            "inchi_key": row.get("inchi_key", "").strip(),
        }
        result.append((code, name, info))
    return result


def build_drug_store(skip_pubchem: bool = False) -> DrugEntityStore:
    """Build unified drug store using IDMapper for entity resolution."""
    store = DrugEntityStore()
    cid_cache = load_cid_cache()
    print(f"Loaded CID cache: {len(cid_cache)} entries ({sum(1 for v in cid_cache.values() if v)} with CIDs)")

    # 1. Load Drug Repurposing Hub first (best CID coverage, establishes canonical entities)
    print("\n[1/5] Loading Drug Repurposing Hub...")
    hub = load_drug_repurposing_hub()
    for name, info in tqdm(hub.items(), desc="Hub"):
        store.add_hub_entry(name, info)
    print(f"  Loaded {len(hub)} Hub entries")

    # 2. Load metadata sources (will merge with Hub via shared synonyms)
    print("\n[2/5] Loading metadata libraries...")
    for source in ["tahoe", "drugseqr", "lincs"]:
        entries = load_metadata(source)
        for code, name, info in tqdm(entries, desc=source):
            store.add_metadata_entry(source, code, name, info)
        print(f"  {source}: {len(entries)} entries")

    # 3. Scan GMT files for additional perturbations
    print("\n[3/5] Scanning GMT files...")
    hub_by_name = {n.lower(): info for n, info in hub.items()}
    is_valid_pert = lambda p: p and len(p) > 2 and not p.replace('.', '').replace('-', '').isdigit()
    gmt_count = 0

    for lib_key in LIBS_NEEDING_GMT_SCAN:
        config = get_lib_config(lib_key)
        for gmt_file in DRUG_DIR.glob(f"{lib_key}*.gmt*"):
            print(f"  Scanning {gmt_file.name}...")
            for (term, _), _ in read_gmt(gmt_file):
                if (pert := extract_perturbation(term, lib_config=config)) and is_valid_pert(pert := pert.strip()):
                    hub_info = hub_by_name.get(pert.lower(), {})
                    store.add_gmt_perturbation(pert, hub_info)
                    gmt_count += 1
    print(f"  Processed {gmt_count} GMT perturbations")

    # 4. Resolve InChI keys to CIDs
    print("\n[4/5] Resolving InChI keys to CIDs...")
    store.resolve_inchi_to_cid(skip_pubchem)

    # 5. Resolve remaining names to CIDs
    print("\n[5/5] PubChem name resolution...")
    store.resolve_names_to_cid(cid_cache, skip_pubchem)
    save_cid_cache(cid_cache)

    return store


def main():
    parser = argparse.ArgumentParser(description="Build unified drug lookup JSON using IDMapper")
    parser.add_argument("--skip-pubchem", action="store_true", help="Skip PubChem API calls")
    parser.add_argument("--download", action="store_true", help="Re-download Drug Repurposing Hub")
    parser.add_argument("--output", "-o", type=str, default=str(DRUG_LOOKUP_PATH))
    args = parser.parse_args()

    if args.download or not (METADATA_DIR / "drug_master.json").exists():
        download_hub()

    print("Building drug lookup using IDMapper...")
    store = build_drug_store(skip_pubchem=args.skip_pubchem)

    # Export coverage stats
    coverage = store.export_coverage()
    print("\nCoverage:")
    print(f"  Total entities: {coverage['total_entities']}")
    print(f"  With CID: {coverage['with_cid']} ({100*coverage['with_cid']/coverage['total_entities']:.1f}%)")
    print(f"  With MOA: {coverage['with_moa']} ({100*coverage['with_moa']/coverage['total_entities']:.1f}%)")
    print(f"  FDA approved: {coverage['fda_approved']}")
    print(f"  Namespaces: {coverage['namespace_coverage']}")

    # Export conflicts
    conflicts = store.export_conflicts()
    if conflicts["summary"]:
        print(f"\nConflicts detected: {conflicts['summary']}")

    # Export lookup
    lookup = store.export_lookup()
    print(f"\nLookup entries: {len(lookup)}")

    # Stats on lookup
    with_cid = sum(1 for e in lookup.values() if e.get("cid"))
    with_moa = sum(1 for e in lookup.values() if e.get("moa"))
    print(f"  With CID: {with_cid} ({100*with_cid/len(lookup):.1f}%)")
    print(f"  With MOA: {with_moa} ({100*with_moa/len(lookup):.1f}%)")

    # Save outputs
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(lookup, f)
    print(f"\nSaved lookup to {output_path}")

    # Save conflicts report
    conflicts_path = output_path.parent / "drug_id_conflicts.json"
    with open(conflicts_path, 'w') as f:
        json.dump(conflicts, f, indent=2, default=str)
    print(f"Saved conflicts to {conflicts_path}")

    # Save coverage report
    coverage_path = output_path.parent / "drug_id_coverage.json"
    with open(coverage_path, 'w') as f:
        json.dump(coverage, f, indent=2, default=str)
    print(f"Saved coverage to {coverage_path}")


if __name__ == "__main__":
    main()
