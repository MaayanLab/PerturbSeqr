"""Shared helpers for creeds_chem.py / creeds_gene.py."""
import gzip
import json
from pathlib import Path

# Allowed species across CREEDS + Harmonizome (we drop everything else)
ORG_MAP = {"mouse": "mus musculus", "human": "homo sapiens", "rat": "rattus norvegicus"}
ALLOWED_ORGS = set(ORG_MAP.values()) | set(ORG_MAP.keys())


def normalize_org(org: str) -> str:
    """Map 'mouse' → 'mus musculus' etc.; unknown values pass through lowercased."""
    key = org.strip().lower()
    return ORG_MAP.get(key, key)


_PERT_TYPE_SYNONYMS = {
    "ko": "KO", "knockout": "KO", "deficiency": "KO", "deletion": "KO",
    "null mutation": "KO", "null allele": "KO",
    "kd": "KD", "knockdown": "KD", "depletion": "KD",
    "ki": "KI", "knock in": "KI", "knockin": "KI",
    "oe": "OE", "overexpression": "OE", "activation": "OE",
    "mut": "Mut", "mutant": "Mut", "active mutant": "Mut", "activemutant": "Mut",
    "point mutation": "Mut", "missense": "Mut",
}
_PERT_TYPE_KEYWORDS = [
    ("knock in", "KI"), ("knockin", "KI"),
    ("knockout", "KO"), ("knock out", "KO"), ("deficiency", "KO"),
    ("deletion", "KO"), ("null", "KO"),
    ("knockdown", "KD"), ("knock down", "KD"), ("depletion", "KD"),
    ("deplet", "KD"), ("down expression", "KD"), ("repression", "KD"), ("silenc", "KD"),
    ("overexpression", "OE"), ("over expression", "OE"), ("overexpress", "OE"),
    ("induction", "OE"), ("induced expression", "OE"), ("activation", "OE"),
    ("mutation", "Mut"), ("mutant", "Mut"), ("missense", "Mut"),
]
_PERT_TYPE_AMBIGUOUS = {"inhibition", "druginhibition", "unknown", ""}


def normalize_perturbation_type(raw: str | None) -> str:
    """Map a raw CREEDS perturbation-type string to a canonical KO/KD/KI/OE/Mut value, or "" if it
    doesn't map cleanly ('|'-joined values are normalized part-by-part)."""
    if raw is None:
        return ""
    raw = raw.strip()
    if "|" in raw:
        return "|".join(normalize_perturbation_type(part) for part in raw.split("|"))
    key = raw.lower().replace("-", " ").replace("_", " ").strip()
    if key in _PERT_TYPE_SYNONYMS:
        return _PERT_TYPE_SYNONYMS[key]
    for kw, pert_type in _PERT_TYPE_KEYWORDS:
        if kw in key:
            return pert_type
    if key not in _PERT_TYPE_AMBIGUOUS:
        print(f"  WARN normalize_perturbation_type: unrecognized value {raw!r} → blank")
    return ""


def assert_unique(term: str, seen: set[str]) -> str:
    """Raise on duplicate term. The canonical format must already disambiguate. Returns term."""
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
