# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Shared helpers for creeds_chem.py / creeds_gene.py.

Both CREEDS modules merge two upstream sources:
  1. CREEDS JSON + GMT — manually-curated drug/gene perturbation signatures
  2. Harmonizome GEO GMT — automatically-mined GEO signatures (geochemical / geogene slug)

Step 1 — set-difference merge:
    Merged = CREEDS ∪ { h ∈ Harmonizome : perturbations(h) ∉ perturbations(CREEDS) }

  where perturbations(X) is the set of perturbation names appearing in signature
  collection X (e.g. {"Foxo1", "Plin5", ...}).

Every term in Merged is then reformatted to the canonical underscore-separated layout
that format_verification.transform_creeds_{chem,gene} consumes.

Step 2 — humanize DEGs to human protein-coding symbols (via NCBI gene_orthologs):
    For each signature s ∈ Merged with DEG set genes(s) and organism org(s),
        humanize(s) = genes(s) ∩ HumanPC                    if org(s) = human
                      { mouseToHuman(g) : g ∈ genes(s) }    if org(s) = mouse
                      { ratToHuman(g)   : g ∈ genes(s) }    if org(s) = rat
        (mouse/rat mappings undefined for non-orthologous genes are dropped.)

    Output = { s ∈ Merged : humanize(s) ≠ ∅ }, with each s's DEGs replaced by humanize(s).

Pipeline: shared helpers, not directly runnable. Imported by per-dataset downloaders
(creeds_chem.py, creeds_gene.py) which run as ETL stage 0 (input acquisition).
"""
import gzip
import json
import re
from pathlib import Path

# Allowed species across CREEDS + Harmonizome (we drop everything else)
ORG_MAP = {"mouse": "mus musculus", "human": "homo sapiens", "rat": "rattus norvegicus"}
ALLOWED_ORGS = set(ORG_MAP.values()) | set(ORG_MAP.keys())


def normalize_org(org: str) -> str:
    """Map 'mouse' → 'mus musculus' etc.; unknown values pass through lowercased."""
    key = org.strip().lower()
    return ORG_MAP.get(key, key)


def clean_cell_type(ct: str) -> str:
    """Collapse whitespace (incl. tabs/newlines that would corrupt GMT columns) to single spaces."""
    return " ".join((ct or "").split())


def assert_unique(term: str, seen: set[str]) -> str:
    """Raise on duplicate term — the canonical format must already disambiguate. Returns term."""
    if term in seen:
        raise ValueError(
            f"Duplicate canonical term in CREEDS merge: {term!r}\n"
            f"  This means the term-construction logic is missing a disambiguator field."
        )
    seen.add(term)
    return term


def load_creeds_meta(path: Path, key: str = "id") -> dict[str, dict]:
    """Load CREEDS JSON list into {entry[key]: entry}."""
    with open(path) as f:
        return {e[key]: e for e in json.load(f)}


def write_gmt_gz(gmt: dict[str, list[str]], path: Path) -> int:
    """Write {term: [genes]} to a gzipped GMT. Inserts an empty description column."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt") as f:
        for term, genes in gmt.items():
            if genes:
                f.write(f"{term}\t\t" + "\t".join(genes) + "\n")
    return sum(1 for g in gmt.values() if g)


def split_direction(creeds_term: str) -> tuple[str, str]:
    """CREEDS first-column terms end with '-up' or '-dn'. Return (stem, direction).
    Direction is canonicalized to 'up'/'down' to match the rest of the pipeline."""
    if creeds_term.endswith("-up"):
        return creeds_term[:-3], "up"
    if creeds_term.endswith("-dn"):
        return creeds_term[:-3], "down"
    return creeds_term, "up"


def parse_creeds_key(key: str) -> tuple[str, str, str]:
    """A CREEDS GMT key is 'term-direction\\tcreeds_id' (e.g. 'Foxo1-up\\tgene:508').
    Returns (creeds_id, direction, stem)."""
    term, _, creeds_id = key.partition("\t")
    stem, direction = split_direction(term)
    return creeds_id, direction, stem


def perturbations_only_in_geo(
    geo_gmt: dict[str, list[str]],
    creeds_gmt: dict[str, list[str]],
    geo_pert_fn,
    creeds_pert_fn,
) -> set[str]:
    """Return the set of geo terms whose perturbation name is NOT in any CREEDS term."""
    creeds_perts = {creeds_pert_fn(t) for t in creeds_gmt}
    return {t for t in geo_gmt if geo_pert_fn(t) not in creeds_perts}


# Lazy GEOparse import — only creeds_chem needs it (gene terms encode tissue inline)
def lookup_cell_type_gse(acc: str, cache_path: Path) -> str:
    """Look up a coarse cell type / tissue label for a GSE/GDS accession via GEOparse.
    Cached to a JSON file so re-runs are instant. Returns 'unknown' on failure."""
    cache: dict[str, str] = {}
    if cache_path.exists():
        cache = json.loads(cache_path.read_text())
    if acc in cache:
        return cache[acc]

    import GEOparse  # noqa: PLC0415  (keep import lazy)
    try:
        geo = GEOparse.get_GEO(acc, silent=True, destdir="/tmp/geo_cache")
    except Exception:
        cache[acc] = "unknown"
        cache_path.write_text(json.dumps(cache))
        return "unknown"

    result = "unknown"
    if acc.startswith("GDS"):
        title = geo.metadata.get("title", [""])[0]
        for pattern in (r"effect on (\w[\w\s]+?) cell", r"effect on ([\w\s]+?)$",
                        r"in ([\w\s]+?) cell", r"(\w[\w\s]+?) tissue"):
            m = re.search(pattern, title, re.IGNORECASE)
            if m:
                result = clean_cell_type(m.group(1))
                break
    else:  # GSE — read first sample
        for gsm in geo.gsms.values():
            for c in gsm.metadata.get("characteristics_ch1", []):
                lc = c.lower()
                if "cell type:" in lc or "cell_type:" in lc or "tissue:" in lc:
                    result = clean_cell_type(c.split(":", 1)[1])
                    break
            if result == "unknown":
                src = gsm.metadata.get("source_name_ch1", [""])[0]
                if src:
                    result = clean_cell_type(src)
            break

    cache[acc] = result
    cache_path.write_text(json.dumps(cache))
    return result
