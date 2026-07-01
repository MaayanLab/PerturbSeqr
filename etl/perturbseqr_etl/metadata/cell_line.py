"""
Cell-line annotation. Resolve a free-text cell-line name to a Cellosaurus accession (CVCL_*), a
DepMap ModelID (ACH-*), each registry's own display name, and Organ, combining Cellosaurus + DepMap
"""
from functools import lru_cache
from pathlib import Path

import pandas as pd

from perturbseqr_etl.metadata import warn_unmatched
from perturbseqr_etl.metadata_sources.cellosaurus import cellosaurus as cello
from perturbseqr_etl.metadata_sources.depmap import depmap as depmap_src

@lru_cache(maxsize=1)
def _id_maps(cache_dir: Path) -> dict:
    """Build the shared Cellosaurus + DepMap cross-reference maps (cached on cache_dir)."""
    names, sublines, _catalogs = cello.load(cache_dir)
    dep = depmap_src.load(cache_dir)
    cvcl_to_model = {r.RRID: r.ModelID for r in dep.itertuples(index=False) if r.RRID}
    model_to_cvcl = {r.ModelID: r.RRID for r in dep.itertuples(index=False) if r.RRID}
    model_to_name = dict(zip(dep.ModelID, dep.StrippedCellLineName))
    model_to_organ = dict(zip(dep.ModelID, dep.OncotreeLineage))
    name_to_model: dict[str, str] = {}
    for r in dep.itertuples(index=False):
        if r.StrippedCellLineName:
            name_to_model.setdefault(cello.normalize(r.StrippedCellLineName), r.ModelID)
    cvcl_to_primary: dict[str, str] = {}                         # CVCL → Cellosaurus recommended name
    for rec in (*names.values(), *sublines.values()):
        cvcl_to_primary.setdefault(rec["cvcl"], rec["primary"])
    return {"names": names, "sublines": sublines, "cvcl_to_model": cvcl_to_model,
            "model_to_cvcl": model_to_cvcl, "model_to_name": model_to_name,
            "model_to_organ": model_to_organ, "name_to_model": name_to_model,
            "cvcl_to_primary": cvcl_to_primary}


@lru_cache(maxsize=1)
def _resolver(cache_dir: Path):
    """Build the combined Cellosaurus + DepMap resolve() closure (cached on cache_dir)."""
    m = _id_maps(cache_dir)
    names, sublines, cvcl_to_model, model_to_cvcl = m["names"], m["sublines"], m["cvcl_to_model"], m["model_to_cvcl"]
    model_to_name, model_to_organ, name_to_model, cvcl_to_primary = (
        m["model_to_name"], m["model_to_organ"], m["name_to_model"], m["cvcl_to_primary"])

    def _result(cvcl: str, model: str, organ: str) -> dict:
        return {"cvcl": cvcl, "model": model, "organ": organ,
                "cellosaurus_name": cvcl_to_primary.get(cvcl, ""),
                "depmap_name": model_to_name.get(model, "")}

    def _lookup(cell_string: str) -> dict | None:
        key = cello.normalize(cell_string)
        rec = names.get(key)
        if rec:
            cvcl = rec["cvcl"]
            model = cvcl_to_model.get(cvcl, "") or rec["depmap"] or name_to_model.get(key, "")
            if model and not cvcl:
                cvcl = model_to_cvcl.get(model, "")
            if cvcl or model:
                return _result(cvcl, model, model_to_organ.get(model, ""))
        if key in name_to_model:                                 # DepMap-direct (e.g. 2-char "H4", off the Cellosaurus index)
            model = name_to_model[key]
            return _result(model_to_cvcl.get(model, ""), model, model_to_organ.get(model, ""))
        if key in sublines:                                      # engineered knockout subline: specific CVCL, no DepMap
            sub = sublines[key]
            organ = model_to_organ.get(cvcl_to_model.get(sub["parent_cvcl"], ""), "")  # inherit parent Organ
            return _result(sub["cvcl"], "", organ)
        return None

    return _lookup


def resolve(cell_string: str, *, cache_dir: Path) -> dict | None:
    """Resolve one name → {'cvcl', 'model', 'organ', 'cellosaurus_name', 'depmap_name'} or None."""
    return _resolver(cache_dir)(cell_string)


def enrich_ids(cvcl: str, model: str = "", *, cache_dir: Path) -> dict:
    """Given a CVCL and/or DepMap ModelID obtained elsewhere (e.g. a dataset's own registry), cross-
    reference the missing id and attach both registries' display names + Organ. Same shape as resolve()."""
    m = _id_maps(cache_dir)
    cvcl = cvcl or m["model_to_cvcl"].get(model, "")
    model = model or m["cvcl_to_model"].get(cvcl, "")
    return {"cvcl": cvcl, "model": model,
            "cellosaurus_name": m["cvcl_to_primary"].get(cvcl, ""),
            "depmap_name": m["model_to_name"].get(model, ""),
            "organ": m["model_to_organ"].get(model, "")}


def annotate(df: pd.DataFrame, *, cache_dir: Path, name_col: str = "cell_name", resolve_fn=None) -> pd.DataFrame:
    """Add Cell_ID_Cellosaur (CVCL_*) + cellosaurus_name, Cell_ID_DepMap (ACH-*) + depmap_name, and
    Organ for each name in `name_col` (exact normalized lookup). The source name in `name_col` is left
    intact; unresolved rows get ''. Coverage reported. A dataset may pass its own `resolve_fn` to extend
    the default Cellosaurus+DepMap lookup (e.g. PerturbAtlas's catalog-number fallback)."""
    resolve_fn = resolve_fn or _resolver(cache_dir)
    cols: dict[str, list] = {"Cell_ID_Cellosaur": [], "cellosaurus_name": [],
                             "Cell_ID_DepMap": [], "depmap_name": [], "Organ": []}
    unmatched = []
    for v in df[name_col]:
        hit = resolve_fn(str(v)) or {}
        cols["Cell_ID_Cellosaur"].append(hit.get("cvcl", ""))
        cols["cellosaurus_name"].append(hit.get("cellosaurus_name", ""))
        cols["Cell_ID_DepMap"].append(hit.get("model", ""))
        cols["depmap_name"].append(hit.get("depmap_name", ""))
        cols["Organ"].append(hit.get("organ", ""))
        if not hit:
            unmatched.append(v)
    warn_unmatched(unmatched, len(df), entity="cell line")
    return df.assign(**{k: pd.Series(v, index=df.index) for k, v in cols.items()})


def with_role(df: pd.DataFrame) -> pd.DataFrame:
    """Insert a `role` column right after cell_name: 'cell_line' when the row resolved to a canonical
    Cellosaurus/DepMap id, else 'cell_type' (messy/free-text names that don't map exactly are kept but
    flagged, so a merged table can count canonical cell lines)."""
    role = ["cell_line" if (c or m) else "cell_type"
            for c, m in zip(df["Cell_ID_Cellosaur"], df["Cell_ID_DepMap"])]
    out = df.copy()
    out.insert(out.columns.get_loc("cell_name") + 1, "role", role)
    return out


def build_cell_line_metadata(gmt_path, out_dir, *, cache_dir: Path, out_name: str | None = None, resolve_fn=None):
    from perturbseqr_etl.gmt import distinct_term_field
    from perturbseqr_etl.metadata import write_table
    gmt_path = Path(gmt_path)
    if not gmt_path.exists():
        raise FileNotFoundError(f"GMT not found: {gmt_path}\n  Run the dataset's gmt.py first.")
    out_name = out_name or gmt_path.name.removesuffix(".gmt.gz") + "-cell_line_metadata"
    cl = pd.DataFrame({"cell_name": sorted(distinct_term_field(gmt_path, 1))})
    cl = with_role(annotate(cl, cache_dir=cache_dir, name_col="cell_name", resolve_fn=resolve_fn))
    return write_table(cl, out_dir, out_name, label="cell lines")
