"""
Canonicalize ETL pipeline orchestrator. Runs all stages in order (pass --no-cache to force refresh):
  1. inputs. Per-dataset packages: download raw → canonical ::-GMT → PC-filter → data/{drug,gene}_perturbation/
  2. validate. format_verification: every emitted GMT is in canonical term format (halts on failure)
  3. metadata. build_metadata: per-dataset drug/cell_line/gene_target tables → <pkg>/intermediate/
  4. collate. collate_metadata: merge per-dataset tables → data/metadata/perturbseqr-<kind>_metadata
  5. lookup. build_lookup: frontend drug_lookup.json
"""
import importlib
import sys

from perturbseqr_etl import build_lookup, build_metadata, collate_metadata, format_verification
from perturbseqr_etl.data_sources.metadata_registry import DATASET_NAMES


def run_inputs(no_cache: bool = False) -> None:
    """Build every dataset's GMT by importing <ds>.gmt and calling gmt(no_cache). Tolerates
    NotImplementedError (manual-placement stubs like ginkgo, LINCS CP/XPR, Tahoe DESeq2)."""
    n_ok = n_skipped = n_failed = 0
    for name in DATASET_NAMES:
        print(f"\n  → {name}", flush=True)
        try:
            importlib.import_module(f"perturbseqr_etl.data_sources.{name}.gmt").gmt(no_cache=no_cache)
            n_ok += 1
        except NotImplementedError as e:
            print(f"    SKIP (not implemented or input missing): {e}")
            n_skipped += 1
        except Exception as e:
            print(f"    FAIL: {type(e).__name__}: {e}")
            n_failed += 1
    print(f"\nStage 1 summary: {n_ok} ok, {n_skipped} skipped, {n_failed} failed")


def _banner(msg: str) -> None:
    print("\n" + "=" * 60); print(msg); print("=" * 60, flush=True)


def main() -> None:
    no_cache = "--no-cache" in sys.argv

    _banner("Stage 1: inputs (download + canonicalize + PC-filter per dataset)")
    run_inputs(no_cache=no_cache)

    _banner("Stage 2: validate (canonical GMT format, halts on failure)")
    saved_argv, sys.argv = sys.argv, [sys.argv[0]]   # the validator has its own argparse
    try:
        format_verification.main()
    finally:
        sys.argv = saved_argv

    _banner("Stage 3: metadata (per-dataset drug/cell_line/gene_target tables)")
    build_metadata.run(no_cache=no_cache)

    _banner("Stage 4: collate (overall perturbseqr-<kind>_metadata)")
    collate_metadata.main()

    _banner("Stage 5: lookup (drug_lookup.json)")
    build_lookup.build_drug_lookup()


if __name__ == "__main__":
    main()
