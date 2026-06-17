#!/usr/bin/env python3
"""
Canonicalize ETL pipeline orchestrator.

Three stages:
  1. inputs/<dataset>.py — each module runs its own pipeline:
       Stage A: download raw → db/etl/inputs/_cache/
       Stage B: canonical ::-format → db/etl/intermediate/{drug,gene}_perturbation/
       Stage C: PC filter + alias rename + ortholog map → db/data/{drug,gene}_perturbation/
     Stage C output is what ingest reads and what gets rcloned to MinIO.
  2. format_verification — validate every emitted GMT is in canonical format.
  3. build_{drug,gene}_lookup — produce lookup JSONs consumed by the frontend.
"""
import argparse
import importlib
import sys
from pathlib import Path


# Per-dataset modules in db/etl/inputs/. Each exposes download(no_cache=False) -> Path.
DATASET_MODULES = [
    # Drug
    "deepcover_moa", "ginkgo_bioworks", "lincs_l1000_cp", "microarrays_cmap",
    "nibr_drug_seq", "rummageo_chem", "sciplex", "tahoe_100m", "creeds_chem",
    # Gene
    "lincs_l1000_xpr", "perturb_atlas_human", "perturb_atlas_mouse",
    "replogle_perturb_seq", "rummageo_gene", "creeds_gene", "cm4ai",
]


def run_inputs(no_cache: bool = False) -> int:
    """Stage 1: invoke download() on every dataset module. Tolerates NotImplementedError
    (manual-placement stubs like ginkgo, LINCS CP/XPR, Tahoe DESeq2)."""
    n_ok = n_skipped = n_failed = 0
    for name in DATASET_MODULES:
        print(f"\n  → {name}", flush=True)
        try:
            importlib.import_module(f"perturbseqr_etl.inputs.{name}").download(no_cache=no_cache)
            n_ok += 1
        except NotImplementedError as e:
            print(f"    SKIP (not implemented or input missing): {e}")
            n_skipped += 1
        except Exception as e:
            print(f"    FAIL: {type(e).__name__}: {e}")
            n_failed += 1
    print(f"\nStage 1 summary: {n_ok} ok, {n_skipped} skipped, {n_failed} failed")
    return n_failed


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--no-cache", action="store_true", help="Force re-download in stage 1")
    parser.add_argument("--skip-inputs", action="store_true", help="Skip stage 1 (per-dataset pipelines)")
    parser.add_argument("--skip-validate", action="store_true", help="Skip stage 2 (canonical-format validation)")
    parser.add_argument("--skip-lookup", action="store_true", help="Skip stage 3 (lookup builders)")
    args = parser.parse_args()

    def banner(msg):
        print("\n" + "=" * 60); print(msg); print("=" * 60, flush=True)

    banner("Stage 1: inputs (download + canonical + standardize per dataset)")
    if args.skip_inputs:
        print("  SKIPPED")
    else:
        run_inputs(no_cache=args.no_cache)

    banner("Stage 2: format_verification (validator)")
    if args.skip_validate:
        print("  SKIPPED")
    else:
        from perturbseqr_etl import format_verification
        # Stash argv so the validator's argparse doesn't see our --skip-* flags.
        saved_argv = sys.argv[:]
        sys.argv = [sys.argv[0]]
        try:
            format_verification.main()
        except SystemExit as e:
            if e.code:
                print("  ⚠ Validation failed — fix offending datasets before continuing.")
                sys.exit(e.code)
        finally:
            sys.argv = saved_argv

    banner("Stage 3: build_drug_lookup")
    if args.skip_lookup:
        print("  SKIPPED")
    else:
        # TODO: wire build_drug_lookup.run() once it exposes run().
        print("  NOT YET WIRED — invoke directly for now:")
        print("    uv run --project etl python -m perturbseqr_etl.build_drug_lookup")


if __name__ == "__main__":
    main()
