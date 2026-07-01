"""
CREEDS Gene. CREEDS signatures (Wang et al. 2016) merged with Harmonizome GEO-Gene rows not in CREEDS,
then humanized by standardize_gmt (mouse/rat → human ortholog); cellLine/cellType left blank.
Canonical: gene::::::::perturbation_type::::organism::geoId[::replicate] up|down  (organism at ::-index 7)
"""
import sys
from pathlib import Path

from perturbseqr_etl.data_sources import GENE_OUTPUT, CACHE_DIR, TERM_DELIMITER
from perturbseqr_etl.dataloader import download_to
from perturbseqr_etl.gmt import HARMONIZOME_BASE, load_gmt_dict, standardize_gmt
from perturbseqr_etl.data_sources._creeds import (
    ALLOWED_ORGS, normalize_org, assert_unique,
    load_creeds_meta, write_gmt_gz, normalize_perturbation_type,
    parse_creeds_key, perturbations_only_in_geo,
)

HERE = Path(__file__).parent
INTERMEDIATE = HERE / "intermediate" / "creeds-gene.gmt.gz"
FINAL = GENE_OUTPUT / "creeds-gene.gmt.gz"
CREEDS_BASE = "https://maayanlab.cloud/CREEDS/download"
# organism at ::-index 7 of the canonical CREEDS-gene term
_parse_organism = lambda k: k.rsplit(" ", 1)[0].split(TERM_DELIMITER)[7] if TERM_DELIMITER in k else "human"
GEO_SLUG = "geogene"
CREEDS_JSON_URL = f"{CREEDS_BASE}/single_gene_perturbations-v1.0.json"
CREEDS_GMT_URL = f"{CREEDS_BASE}/single_gene_perturbations-v1.0.gmt"


def _make_term(gene: str, pert_type: str, organism: str, geo_id: str,
               direction: str, *, replicate: str = "") -> str:
    extras = [normalize_perturbation_type(pert_type), "", normalize_org(organism), geo_id]
    if replicate:
        extras.append(replicate)
    return TERM_DELIMITER.join([gene, "", "", "", ""] + extras) + " " + direction


def _reformat_creeds(creeds_gmt: dict, creeds_meta: dict, seen: set[str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for key, genes in creeds_gmt.items():
        creeds_id, direction, stem = parse_creeds_key(key)
        meta = creeds_meta.get(creeds_id)
        if meta:
            gene_sym = (meta.get("hs_gene_symbol") if meta["organism"] == "human"
                        else meta.get("mm_gene_symbol") or meta.get("hs_gene_symbol")) or stem
            cid = creeds_id.split(":", 1)[1] if ":" in creeds_id else ""
            geo_id = f"{meta['geo_id']}.{cid}" if cid else meta["geo_id"]
            new_term = _make_term(gene_sym, meta["pert_type"], meta["organism"], geo_id, direction)
        else:
            new_term = _make_term(stem, "unknown", "unknown", "unknown", direction)
        out[assert_unique(new_term, seen)] = genes
    return out


def _reformat_harmonizome(geo_gmt: dict, keep_keys: set[str], seen: set[str]) -> dict[str, list[str]]:
    """Harmonizome GEO-Gene term format: gene_pertType_..._dataset_organism_tissue direction"""
    out: dict[str, list[str]] = {}
    for key, genes in geo_gmt.items():
        if key not in keep_keys:
            continue
        term = key.split("\t", 1)[0]
        body, _, direction = term.rpartition(" ")
        if direction.lower() in ("up", "down", "dn"):
            direction = "down" if direction.lower() == "dn" else direction.lower()
        else:
            body, direction = term, "up"
        fields = body.split("_")
        if len(fields) >= 6:
            gene_sym = fields[0]
            pert_type = "_".join(fields[1:-4]) if len(fields) > 6 else fields[1]
            dataset = fields[-4]
            replicate = fields[-3]      # numeric replicate id, distinguishes repeats within one GSE
            organism = fields[-2]
            geo_id = dataset.upper() if dataset.upper().startswith("G") else dataset
            new_term = _make_term(gene_sym, pert_type, organism, geo_id, direction, replicate=replicate)
        else:
            new_term = term
        out[assert_unique(new_term, seen)] = genes
    return out


def gmt(no_cache: bool = False) -> Path:
    creeds_json = CACHE_DIR / "creeds-gene.json"
    creeds_gmt = CACHE_DIR / "creeds-gene.gmt"
    geo_up = CACHE_DIR / f"{GEO_SLUG}_up_crisp.gmt.gz"
    geo_dn = CACHE_DIR / f"{GEO_SLUG}_dn_crisp.gmt.gz"
    download_to(CREEDS_JSON_URL, creeds_json, no_cache=no_cache)
    download_to(CREEDS_GMT_URL, creeds_gmt, no_cache=no_cache)
    download_to(f"{HARMONIZOME_BASE}/{GEO_SLUG}/gene_set_library_up_crisp.gmt.gz", geo_up, no_cache=no_cache)
    download_to(f"{HARMONIZOME_BASE}/{GEO_SLUG}/gene_set_library_dn_crisp.gmt.gz", geo_dn, no_cache=no_cache)

    creeds_meta = load_creeds_meta(creeds_json)
    creeds_data = load_gmt_dict(creeds_gmt)
    geo_data = {**load_gmt_dict(geo_up, direction="up"), **load_gmt_dict(geo_dn, direction="down")}
    print(f"  CREEDS: {len(creeds_data)} sigs / Harmonizome GEO-Gene: {len(geo_data)} sigs")

    # Set difference: which Harmonizome perturbations are NOT in CREEDS? (keys are 'term\\tdesc')
    geo_pert = lambda k: k.split("\t", 1)[0].split("_")[0].strip().upper()
    creeds_pert = lambda k: k.split("\t", 1)[0].rsplit("-", 1)[0].strip().upper()
    keep_geo = perturbations_only_in_geo(geo_data, creeds_data, geo_pert, creeds_pert)
    # Filter geo keys by allowed species (organism in field index 4 of the term)
    keep_geo = {k for k in keep_geo if k.split("\t", 1)[0].split("_")[4].strip().lower() in ALLOWED_ORGS}
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
