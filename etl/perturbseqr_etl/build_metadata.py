"""
Run per-dataset metadata builders from the declarative registry (data_sources/metadata_registry.py). Each dataset
declares which kinds (drug/cell_line/gene_target) it produces and how; this dispatches to the shared
build_* helpers, lincs _cell_lines.build, or the dataset's own custom <kind>_metadata module.

Usage:
  uv run --project etl python -m perturbseqr_etl.build_metadata                         # all datasets/kinds
  uv run --project etl python -m perturbseqr_etl.build_metadata perturb_atlas.human     # one dataset
  uv run --project etl python -m perturbseqr_etl.build_metadata perturb_atlas.human gene_target  # one kind
"""
import argparse
import importlib
from pathlib import Path

from perturbseqr_etl.data_sources import CACHE_DIR, DATA_SOURCES_DIR, METADATA_DIR
from perturbseqr_etl.data_sources.metadata_registry import DATASETS
from perturbseqr_etl.metadata.cell_line import build_cell_line_metadata
from perturbseqr_etl.metadata.drug import build_drug_metadata
from perturbseqr_etl.metadata.gene import build_gene_target_metadata

KINDS = ("drug", "cell_line", "gene_target")
_BUILDERS = {"drug": build_drug_metadata, "cell_line": build_cell_line_metadata,
             "gene_target": build_gene_target_metadata}


def _run_one(ds_name: str, kind: str, build, no_cache: bool) -> Path:
    if build.custom:                                   # dataset's own module keeps the real logic
        mod = importlib.import_module(f"perturbseqr_etl.data_sources.{ds_name}.{kind}_metadata")
        return getattr(mod, f"{kind}_metadata")(no_cache=no_cache)

    gmt_mod = importlib.import_module(f"perturbseqr_etl.data_sources.{ds_name}.gmt")
    out_dir = Path(gmt_mod.__file__).parent / "intermediate"
    gmt_path = gmt_mod.FINAL if build.gmt == "final" else gmt_mod.INTERMEDIATE

    if build.lincs_cell_lines:                         # lincs cp/xpr: different signature, intermediate GMT
        from perturbseqr_etl.data_sources.lincs_l1000 import _cell_lines
        return _cell_lines.build(gmt_path, out_dir, gmt_path.name.removesuffix(".gmt.gz") + "-cell_line_metadata")

    kwargs = {"cache_dir": CACHE_DIR}
    if build.drug_col:
        kwargs["drug_col"] = build.drug_col
    if build.split_barred:
        kwargs["split_barred"] = True
    if build.resolver:                                 # perturb_atlas: catalog-aware Cellosaurus resolver
        from perturbseqr_etl.data_sources.perturb_atlas._perturbatlas import cell_line_resolver
        kwargs["resolve_fn"] = cell_line_resolver(CACHE_DIR)
    return _BUILDERS[kind](gmt_path, out_dir, **kwargs)


def _gather_metadata() -> int:
    """Move each dataset's metadata files out of its intermediate/ dir into the flat METADATA_DIR,
    next to the collated tables, so all metadata lives in one place for collation and upload."""
    METADATA_DIR.mkdir(parents=True, exist_ok=True)
    files = [*DATA_SOURCES_DIR.glob("**/intermediate/*_metadata.parquet"),
             *DATA_SOURCES_DIR.glob("**/intermediate/*_metadata.csv")]
    for f in files:
        f.replace(METADATA_DIR / f.name)
    return len(files)


def run(no_cache: bool = False, only: str | None = None, only_kind: str | None = None) -> int:
    """Build metadata for the registry datasets (optionally one `only` dataset / `only_kind`).
    SKIP when a dataset's GMT is missing. Returns the number of failures."""
    n_ok = n_skip = n_fail = 0
    for ds in DATASETS:
        if only and ds.name != only:
            continue
        for kind in KINDS:
            build = ds.tables.get(kind)
            if build is None or (only_kind and kind != only_kind):
                continue
            print(f"\n  → {ds.name}:{kind}", flush=True)
            try:
                _run_one(ds.name, kind, build, no_cache)
                n_ok += 1
            except FileNotFoundError as e:
                print(f"    SKIP (GMT not built): {e}")
                n_skip += 1
            except Exception as e:
                print(f"    FAIL: {type(e).__name__}: {e}")
                n_fail += 1
    n_moved = _gather_metadata()
    print(f"\nMetadata summary: {n_ok} ok, {n_skip} skipped, {n_fail} failed  ({n_moved} files → {METADATA_DIR})")
    return n_fail


def main() -> None:
    p = argparse.ArgumentParser(prog="build_metadata")
    p.add_argument("dataset", nargs="?", help="dotted dataset name, e.g. perturb_atlas.human")
    p.add_argument("kind", nargs="?", choices=KINDS, help="drug | cell_line | gene_target")
    p.add_argument("--no-cache", action="store_true")
    a = p.parse_args()
    raise SystemExit(1 if run(no_cache=a.no_cache, only=a.dataset, only_kind=a.kind) else 0)


if __name__ == "__main__":
    main()
