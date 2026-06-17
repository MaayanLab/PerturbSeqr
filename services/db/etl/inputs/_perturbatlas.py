# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Shared PerturbAtlas helpers with metadata from PerturbAtlas

Harmonizome strips the per-gene perturbation-type suffixes (`-+*@`) from the `target`
field, so we re-source per-gene perturbation_type from PerturbAtlas's own `meta.csv.gz`.

Source: PerturbAtlas Google Drive folder 1KPKn_4zCsNRhEmBiQjuSY67vR5kautiA, file meta.csv.gz.
"""
import csv
import gzip
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _utils import CACHE_DIR, TERM_DELIMITER, download_to, normalize_perturbation_type, strip_direction

_META_FILE_ID = "19X1naDzsfhtFUs7OWm5Dev7ayjBOcw7Q"
_META_URL = f"https://drive.google.com/uc?export=download&id={_META_FILE_ID}"
META_CACHE = CACHE_DIR / "perturbatlas_meta.csv.gz"


def download_meta(no_cache: bool = False) -> Path:
    """Fetch PerturbAtlas meta.csv.gz into the input cache."""
    return download_to(_META_URL, META_CACHE, no_cache=no_cache)


def load_meta(organism: str, no_cache: bool = False) -> dict[str, dict]:
    """Return {perturb_id -> row} for one organism (matched on the `scientific_name` column)."""
    path = download_meta(no_cache=no_cache)
    out: dict[str, dict] = {}
    with gzip.open(path, "rt") as f:
        for row in csv.DictReader(f):
            if row.get("scientific_name") == organism:
                out[row["perturb_id"]] = row
    return out


# PerturbAtlas `target` field encodes genes with a trailing suffix symbol and an
# optional (MUTATION) parenthetical. Suffix symbols are weak perturbation-type signals
# (`*` is mostly KO but also KD/KI/Mut), so we take the perturbation type from the
# authoritative `condition` column and use `target` only to extract gene identity + order.
_PA_GENE_SUFFIX = re.compile(r"[-+*@]+$")
_PA_PAREN = re.compile(r"\([^)]*\)")


def _pa_strip_gene(token: str) -> str:
    """Strip a PerturbAtlas target token down to the bare gene symbol."""
    token = _PA_PAREN.sub("", token)
    token = _PA_GENE_SUFFIX.sub("", token)
    return token.strip()


def decode_perturbatlas_target(target: str, condition: str) -> tuple[str, str]:
    """Decode (target, condition) into '|'-aligned (gene_field, perturbation_type_field).
    In `target`, '|' separates perturbation groups (each gets one type from the aligned
    `condition`) and '/' separates genes sharing a group's type. `condition` is either
    one value per group or one shared value. Genes are flattened with types repeated."""
    groups = target.split("|")
    conds = condition.split("|")
    if len(conds) == 1:
        conds = conds * len(groups)
    elif len(conds) != len(groups):
        print(f"  WARN decode_perturbatlas_target: {target!r} / {condition!r} — "
              f"{len(groups)} groups vs {len(conds)} conditions; leaving perturbation type blank")
        conds = [""] * len(groups)

    genes_out: list[str] = []
    types_out: list[str] = []
    for grp, cond in zip(groups, conds):
        pert_type = normalize_perturbation_type(cond)
        for token in grp.split("/"):
            gene = _pa_strip_gene(token)
            if not gene:
                continue
            genes_out.append(gene)
            types_out.append(pert_type)
    return "|".join(genes_out), "|".join(types_out)


def make_transform(meta: dict):
    """Build a per-term transform closure given a {perturb_id -> meta_row} lookup
    (from load_meta()). Used by both perturb_atlas_human and perturb_atlas_mouse."""
    def transform(term: str) -> str:
        body, direction = strip_direction(term)
        parts = body.split("_")
        if len(parts) < 5:
            return body + direction
        prefix, id_, _old_pert_type, old_perturbation, parsed_dataset = parts[:5]
        row = meta.get(f"{prefix}_{id_}")
        if row is None:
            print(f"  WARN perturb_atlas: {prefix}_{id_} not in meta.csv.gz — perturbation_type blank")
            gene_field, perturbation_type_field = old_perturbation, ""
            cell_line, cell_type, dataset = "", "", parsed_dataset
        else:
            gene_field, perturbation_type_field = decode_perturbatlas_target(row["target"], row["condition"])
            tissue_name = (row.get("tissue_name") or "").strip()
            # Only literal tissue_type=="cell line" routes tissue_name to cellLine; else cellType.
            is_cell_line = (row.get("tissue_type") or "").strip().lower() == "cell line"
            cell_line = tissue_name if is_cell_line else ""
            cell_type = "" if is_cell_line else tissue_name
            dataset = (row.get("study_accession") or parsed_dataset).strip()
        return TERM_DELIMITER.join([gene_field, cell_line, cell_type, "", "", perturbation_type_field, "",
                       dataset, id_]) + direction
    return transform
