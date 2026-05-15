# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "maayanlab-bioinformatics @ git+https://github.com/MaayanLab/maayanlab-bioinformatics.git@python3.14-compat",
# ]
# ///
"""
RummaGEO Gene — Harmonizome reprocessing of automatically-mined gene perturbations.

Source: https://rummageo.com
Harmonizome: https://maayanlab.cloud/Harmonizome/dataset/RummaGEO+Gene+Perturbation+Signatures
Reference: Marino et al. 2024 Patterns.

Harmonizome supplies the DEG gene-set lists; cell line / cell type are left blank and perturbation type is filled only when the RummaGEO processed-meta condition title maps cleanly to a common type.

Term transform:
  GSE100102_0_v_5_cgas_mouse up  ->  cgas::::::::::{perturbation_type}::::mouse::GSE100102::0::5 up
Fields 1-4 (cell line / type / timepoint / concentration) and field 6 (perturbation method)
are blank; field 5 (perturbation type) is set only on an unambiguous keyword match in the
condition title.

Pipeline: ETL stage 0 (input acquisition). Produces
db/data/gene_perturbation/rummageo-gene.gmt.gz, validated by format_verification (test).

Usage: uv run db/etl/inputs/rummageo_gene.py
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _utils import GENE_INTERMEDIATE, GENE_OUTPUT, CACHE_DIR, TERM_DELIMITER, strip_direction, download_to, harmonizome_paired_download, standardize_gmt

INTERMEDIATE = GENE_INTERMEDIATE / "rummageo-gene.gmt.gz"
FINAL = GENE_OUTPUT / "rummageo-gene.gmt.gz"
# RummaGEO condition-group titles (cleaned "common words" text), keyed {gse: {group_id: title}}.
PROCESSED_META = {o: f"https://minio.dev.maayanlab.cloud/rummageo/2.5/{o}-gse-processed-meta.json"
                  for o in ("human", "mouse")}
# Organism is at ::-index 7 (after the perturbation type/method fields).
_parse_organism = lambda key: key.rsplit(" ", 1)[0].split(TERM_DELIMITER)[7] if TERM_DELIMITER in key else "human"

# Perturbation-type extraction from the condition title
_PERTURBATION_TYPE_SUBSTRINGS = [
    ("knockout", "KO"), ("knock out", "KO"), ("knock-out", "KO"),
    ("knockdown", "KD"), ("knock down", "KD"), ("knock-down", "KD"),
    ("knockin", "KI"), ("knock in", "KI"), ("knock-in", "KI"),
    ("overexpression", "OE"), ("over expression", "OE"), ("over-expression", "OE"),
    ("overexpressing", "OE"), ("overexpressed", "OE"), ("overexpress", "OE"),
]
_PERTURBATION_TYPE_TOKENS = {"ko": "KO", "kd": "KD", "oe": "OE", "ki": "KI",
                             "mut": "Mut", "mutant": "Mut", "mutation": "Mut", "missense": "Mut"}
# Gene+type fused into one token ("mettl3kd", "tp53ko") — only "ko"/"kd" are safe.
_PERTURBATION_TYPE_FUSED = re.compile(r"(?<![a-z0-9])[a-z0-9]{2,}(ko|kd)(?![a-z0-9])")


def parse_perturbation_type(title: str) -> str:
    """A single unambiguous perturbation type (KO/KD/KI/OE/Mut) from the condition title,
    else ""."""
    t = title.lower()
    found = {pt for tok in re.split(r"[^a-z0-9]+", t) if (pt := _PERTURBATION_TYPE_TOKENS.get(tok))}
    for kw, pt in _PERTURBATION_TYPE_SUBSTRINGS:
        if re.search(rf"(?<![a-z0-9]){re.escape(kw)}(?![a-z0-9])", t):
            found.add(pt)
    for m in _PERTURBATION_TYPE_FUSED.finditer(t):
        found.add("KO" if m.group(1) == "ko" else "KD")
    return next(iter(found)) if len(found) == 1 else ""


def load_condition_titles(no_cache: bool = False) -> dict[str, dict[str, str]]:
    """{gse: {group_id: title}} merged across human + mouse RummaGEO processed-meta."""
    titles: dict[str, dict[str, str]] = {}
    for organism, url in PROCESSED_META.items():
        path = download_to(url, CACHE_DIR / f"{organism}-gse-processed-meta.json", no_cache=no_cache)
        for gse, data in json.loads(path.read_text()).items():
            titles[gse] = data.get("titles", {})
    return titles


def make_transform(condition_titles: dict):
    def transform(term: str) -> str:
        body, direction = strip_direction(term)
        parts = body.split("_")
        if len(parts) < 6:
            return body + direction
        gse, sample_a, _v, sample_b, organism = parts[0], parts[1], parts[2], parts[3], parts[-1]
        perturbation = "_".join(parts[4:-1])
        perturbation_type = parse_perturbation_type(condition_titles.get(gse, {}).get(sample_a, ""))
        return TERM_DELIMITER.join([perturbation, "", "", "", "", perturbation_type, "",
                       organism, gse, sample_a, sample_b]) + direction
    return transform


def download(no_cache: bool = False) -> Path:
    harmonizome_paired_download(
        "rummageogene", INTERMEDIATE,
        transform_fn=make_transform(load_condition_titles(no_cache=no_cache)),
        no_cache=no_cache,
    )
    standardize_gmt(INTERMEDIATE, FINAL, parse_organism=_parse_organism)
    return FINAL


if __name__ == "__main__":
    print(download())
