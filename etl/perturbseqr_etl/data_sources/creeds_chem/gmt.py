"""
CREEDS Chem (Wang et al. 2016) merged with Harmonizome GEO chemical signatures not already in CREEDS.
Canonical term: {drug} + blank cellLine/cellType/timepoint/concentration, then {organism}::{geoId}, up|down.
Sources: https://maayanlab.cloud/CREEDS/download/ + Harmonizome GEO chemical signatures.
"""
import re
import sys
from pathlib import Path

from perturbseqr_etl.data_sources import DRUG_OUTPUT, CACHE_DIR, TERM_DELIMITER
from perturbseqr_etl.dataloader import download_to
from perturbseqr_etl.gmt import HARMONIZOME_BASE, load_gmt_dict, standardize_gmt
from perturbseqr_etl.data_sources._creeds import (
    ALLOWED_ORGS, normalize_org, assert_unique,
    load_creeds_meta, write_gmt_gz,
    parse_creeds_key, perturbations_only_in_geo,
)

HERE = Path(__file__).parent
INTERMEDIATE = HERE / "intermediate" / "creeds-chem.gmt.gz"
FINAL = DRUG_OUTPUT / "creeds-chem.gmt.gz"
CREEDS_BASE = "https://maayanlab.cloud/CREEDS/download"
# CREEDS canonical: drug::cellLine::cellType::timepoint::conc::organism::geoId. Organism at ::-index 5
_parse_organism = lambda k: k.rsplit(" ", 1)[0].split(TERM_DELIMITER)[5] if TERM_DELIMITER in k else "human"
GEO_SLUG = "geochemical"
CREEDS_JSON_URL = f"{CREEDS_BASE}/single_drug_perturbations-v1.0.json"
CREEDS_GMT_URL = f"{CREEDS_BASE}/single_drug_perturbations-v1.0.gmt"

# Harmonizome term: drug_organism_platform[_condition]_dataset (condition disambiguates same drug+study).
_HARM_DRUG_RE = re.compile(
    r"^(.+?)_([\w\s]+?)_(gpl\w+)(?:_([^_]+))?_(g[ds][es]\w+)\s+(up|dn|down)$",
    re.IGNORECASE,
)


def _make_term(drug: str, organism: str, geo_id: str, direction: str,
               *, platform: str = "", condition: str = "") -> str:
    """Canonical: perturbation::cellLine::cellType::timepoint::concentration::organism::geoId[::platform[::condition]] direction"""
    extras = [normalize_org(organism), geo_id]
    if platform or condition:
        extras.append(platform)
    if condition:
        extras.append(condition)
    return TERM_DELIMITER.join([drug, "", "", "", ""] + extras) + " " + direction


def _reformat_creeds(creeds_gmt: dict, creeds_meta: dict, seen: set[str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for key, genes in creeds_gmt.items():
        creeds_id, direction, stem = parse_creeds_key(key)
        meta = creeds_meta.get(creeds_id)
        if meta:
            cid = creeds_id.split(":", 1)[1] if ":" in creeds_id else ""
            geo_id = f"{meta['geo_id']}.{cid}" if cid else meta["geo_id"]
            new_term = _make_term(meta["drug_name"], meta["organism"], geo_id, direction)
        else:
            new_term = _make_term(stem, "unknown", "unknown", direction)
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
            direction = "down" if direction.lower() == "dn" else direction.lower()
            new_term = _make_term(drug, org, geo_id, direction,
                                  platform=platform, condition=condition or "")
        out[assert_unique(new_term, seen)] = genes
    return out


def gmt(no_cache: bool = False) -> Path:
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

    # Keep only Harmonizome perturbations not already in CREEDS (keys are 'term\\tdesc').
    geo_pert = lambda k: k.split("\t", 1)[0].split("_")[0].strip().lower()
    creeds_pert = lambda k: k.split("\t", 1)[0].rsplit("-", 1)[0].strip().lower()
    keep_geo = perturbations_only_in_geo(geo_data, creeds_data, geo_pert, creeds_pert)
    keep_geo = {k for k in keep_geo if k.split("\t", 1)[0].split("_")[1].strip().lower() in ALLOWED_ORGS}
    print(f"  Harmonizome rows kept after dedup + species filter: {len(keep_geo)}")

    seen: set[str] = set()
    merged = _reformat_creeds(creeds_data, creeds_meta, seen)
    merged.update(_reformat_harmonizome(geo_data, keep_geo, seen))

    n = write_gmt_gz(merged, INTERMEDIATE)
    print(f"  {INTERMEDIATE.name}: {n} terms (canonical, pre-standardization)")
    standardize_gmt(INTERMEDIATE, FINAL, parse_organism=_parse_organism)
    return FINAL


if __name__ == "__main__":
    print(gmt(no_cache="--no-cache" in sys.argv))
