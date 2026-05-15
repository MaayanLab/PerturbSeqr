# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
#   "GEOparse",
# ]
# ///
"""
CREEDS Chem — drug perturbation signatures merged from two sources.

Sources:
    - https://maayanlab.cloud/CREEDS/download/single_drug_perturbations-v1.0.json
    - https://maayanlab.cloud/Harmonizome/dataset/GEO+Signatures+of+Differentially+Expressed+Genes+for+Small+Molecules
Reference: Wang et al. 2016. Combined with Harmonizome GEO microarray signatures not in CREEDS.

Step 1 — set-difference merge:
    Merged = CREEDS_drug ∪ { h ∈ GEO_chem : perturbations(h) ∉ perturbations(CREEDS_drug) }

  Per-term cell type for Harmonizome rows is looked up via GEOparse (results cached to
  _cache/geo_cell_type_cache.json; first run is slow, subsequent runs are instant).
  Each merged term is reformatted to canonical:
      {drug_name}::::{cell_type}::::::{organism}::{geo_id} up|down

Step 2 — humanize DEGs (mouse/rat → human ortholog, drop non-protein-coding):
    Output = { s ∈ Merged : humanize(s) ≠ ∅ }, with each s's DEGs replaced by humanize(s).

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/drug_perturbation/creeds-chem.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/creeds_chem.py
"""
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).parent))
from _utils import DRUG_INTERMEDIATE, DRUG_OUTPUT, CREEDS_BASE, HARMONIZOME_BASE, CACHE_DIR, TERM_DELIMITER, download_to, load_gmt_dict, standardize_gmt
from _creeds import (
    ALLOWED_ORGS, normalize_org, clean_cell_type, assert_unique,
    load_creeds_meta, write_gmt_gz,
    parse_creeds_key, perturbations_only_in_geo, lookup_cell_type_gse,
)

INTERMEDIATE = DRUG_INTERMEDIATE / "creeds-chem.gmt.gz"
FINAL = DRUG_OUTPUT / "creeds-chem.gmt.gz"
# CREEDS canonical: drug::cellLine::cellType::timepoint::conc::organism::geoId — organism at ::-index 5
_parse_organism = lambda k: k.rsplit(" ", 1)[0].split(TERM_DELIMITER)[5] if TERM_DELIMITER in k else "human"
GEO_SLUG = "geochemical"
CREEDS_JSON_URL = f"{CREEDS_BASE}/single_drug_perturbations-v1.0.json"
CREEDS_GMT_URL = f"{CREEDS_BASE}/single_drug_perturbations-v1.0.gmt"
GEOCACHE = CACHE_DIR / "geo_cell_type_cache.json"

# Harmonizome term format: drug_organism_platform[_condition]_dataset (4 or 5 fields).
# The optional condition (e.g., "pregnant"/"non-pregnant") is captured to disambiguate
# multiple Harmonizome experiments on the same drug+study.
_HARM_DRUG_RE = re.compile(
    r"^(.+?)_([\w\s]+?)_(gpl\w+)(?:_([^_]+))?_(g[ds][es]\w+)\s+(up|dn|down)$",
    re.IGNORECASE,
)


def _make_term(drug: str, organism: str, cell_type: str, geo_id: str, direction: str,
               *, platform: str = "", condition: str = "") -> str:
    """Canonical: perturbation::cellLine::cellType::timepoint::concentration::organism::geoId[::platform[::condition]] direction"""
    extras = [normalize_org(organism), geo_id]
    if platform or condition:
        extras.append(platform)
    if condition:
        extras.append(condition)
    return TERM_DELIMITER.join([drug, "", clean_cell_type(cell_type), "", ""] + extras) + " " + direction


def _reformat_creeds(creeds_gmt: dict, creeds_meta: dict, seen: set[str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for key, genes in creeds_gmt.items():
        creeds_id, direction, stem = parse_creeds_key(key)
        meta = creeds_meta.get(creeds_id)
        if meta:
            cid = creeds_id.split(":", 1)[1] if ":" in creeds_id else ""
            geo_id = f"{meta['geo_id']}.{cid}" if cid else meta["geo_id"]
            new_term = _make_term(meta["drug_name"], meta["organism"], meta["cell_type"], geo_id, direction)
        else:
            new_term = _make_term(stem, "unknown", "unknown", "unknown", direction)
        out[assert_unique(new_term, seen)] = genes
    return out


def _reformat_harmonizome(geo_gmt: dict, keep_keys: set[str], seen: set[str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for key, genes in geo_gmt.items():
        if key not in keep_keys:
            continue
        term = key.split("\t", 1)[0]
        m = _HARM_DRUG_RE.match(term)
        if not m:
            new_term = term
        else:
            drug, org, platform, condition, geo_id, direction = m.groups()
            geo_id = geo_id.upper()
            direction = "dn" if direction.lower() == "down" else direction.lower()
            cell_type = lookup_cell_type_gse(geo_id, GEOCACHE)
            new_term = _make_term(drug, org, cell_type, geo_id, direction,
                                  platform=platform, condition=condition or "")
        out[assert_unique(new_term, seen)] = genes
    return out


def download(no_cache: bool = False) -> Path:
    creeds_json = CACHE_DIR / "creeds-chem.json"
    creeds_gmt = CACHE_DIR / "creeds-chem.gmt"
    geo_up = CACHE_DIR / f"{GEO_SLUG}_up_crisp.gmt.gz"
    geo_dn = CACHE_DIR / f"{GEO_SLUG}_dn_crisp.gmt.gz"
    download_to(CREEDS_JSON_URL, creeds_json, no_cache=no_cache)
    download_to(CREEDS_GMT_URL, creeds_gmt, no_cache=no_cache)
    download_to(f"{HARMONIZOME_BASE}/{GEO_SLUG}/gene_set_library_up_crisp.gmt.gz", geo_up, no_cache=no_cache)
    download_to(f"{HARMONIZOME_BASE}/{GEO_SLUG}/gene_set_library_dn_crisp.gmt.gz", geo_dn, no_cache=no_cache)

    creeds_meta = load_creeds_meta(creeds_json)
    creeds_data = load_gmt_dict(creeds_gmt)
    geo_data = {**load_gmt_dict(geo_up, direction="up"), **load_gmt_dict(geo_dn, direction="down")}
    print(f"  CREEDS: {len(creeds_data)} sigs / Harmonizome GEO-Chem: {len(geo_data)} sigs")

    # Set difference: which Harmonizome perturbations are NOT in CREEDS?
    # (keys are 'term\\tdesc' — split off the term first)
    geo_pert = lambda k: k.split("\t", 1)[0].split("_")[0].strip().lower()
    creeds_pert = lambda k: k.split("\t", 1)[0].rsplit("-", 1)[0].strip().lower()
    keep_geo = perturbations_only_in_geo(geo_data, creeds_data, geo_pert, creeds_pert)

    # Filter geo keys by allowed species (organism in field index 1 of the term)
    keep_geo = {k for k in keep_geo if k.split("\t", 1)[0].split("_")[1].strip().lower() in ALLOWED_ORGS}
    print(f"  Harmonizome rows kept after dedup + species filter: {len(keep_geo)}")

    seen: set[str] = set()
    merged = _reformat_creeds(creeds_data, creeds_meta, seen)
    merged.update(_reformat_harmonizome(geo_data, keep_geo, seen))

    # Stage B: write canonical pre-standardization to intermediate
    n = write_gmt_gz(merged, INTERMEDIATE)
    print(f"  {INTERMEDIATE.name}: {n} terms (canonical, pre-standardization)")
    # Stage C: PC filter + alias resolve + mouse→human ortholog → final
    standardize_gmt(INTERMEDIATE, FINAL, parse_organism=_parse_organism)
    return FINAL


if __name__ == "__main__":
    print(download())
