"""NIBR DRUG-seq NSN code → display name."""
import csv
from functools import lru_cache

from perturbseqr_etl.data_sources import CACHE_DIR
from perturbseqr_etl.dataloader import download_to

MOABOX_URL = ("https://raw.githubusercontent.com/Novartis/DRUG-seq/main/data/"
              "Novartis_drugseq_U2OS_MoABox/MoABox_compounds_metadata.txt")
DRUGSEQR_URL = "https://minio.dev.maayanlab.cloud/drugseq/DRUGseqr_metadata.tsv"


@lru_cache(maxsize=1)
def load_moabox() -> dict[str, dict]:
    """NSN code → {inchi_key, smiles, cas_number, moa} from the Novartis MoABox compound table."""
    path = download_to(MOABOX_URL, CACHE_DIR / "moabox_compounds_metadata.txt")
    out: dict[str, dict] = {}
    with open(path) as f:
        for r in csv.DictReader(f, delimiter="\t"):
            if code := (r.get("cmpd_sample_id") or "").strip():
                out[code] = {k: (r.get(k) or "").strip() for k in ("inchi_key", "smiles", "cas_number", "moa")}
    return out


@lru_cache(maxsize=1)
def load_drugseqr() -> dict[str, dict]:
    """NSN code → {title, name, cid, inchi_key, moa, target} from the curated DRUGseqr metadata."""
    path = download_to(DRUGSEQR_URL, CACHE_DIR / "drugseqr_metadata.tsv")
    out: dict[str, dict] = {}
    with open(path) as f:
        rd = csv.DictReader(f, delimiter="\t")
        code_field = rd.fieldnames[0]   # first column header is blank; it holds the NSN code
        for r in rd:
            if code := (r.get(code_field) or "").strip():
                out[code] = {k: (r.get(k) or "").strip() for k in ("title", "name", "cid", "inchi_key", "moa", "target")}
    return out


@lru_cache(maxsize=1)
def resolve_nsn() -> dict[str, dict]:
    """NSN code → {name, cid}: drugseqr title/name+cid, then PubChem Title via InChIKey, then SMILES."""
    out: dict[str, dict] = {}
    for code, r in load_drugseqr().items():
        if name := (r["title"] or r["name"]):
            out[code] = {"name": name, "cid": r["cid"]}

    need = {code: m for code, m in load_moabox().items()           # MoABox-only codes with a structure to resolve
            if code not in out and (m["inchi_key"] or m["smiles"])}
    if need:
        from perturbseqr_etl.metadata_sources.pubchem import pubchem   # lazy: pubchempy is an optional source dep
        from perturbseqr_etl.metadata_sources.pubchem.helpers import resolve_cids
        code2cid = resolve_cids((code, m["inchi_key"], m["smiles"]) for code, m in need.items())
        props = pubchem.cids_to_properties(sorted(set(code2cid.values())))
        for code, cid in code2cid.items():
            if (title := props.get(cid, {}).get("Title", "").strip()):
                out[code] = {"name": title, "cid": str(cid)}
    return out


def nsn_name_map() -> dict[str, str]:
    return {code: r["name"] for code, r in resolve_nsn().items()}
