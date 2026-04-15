# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
format_verification.py — validates that every dataset's canonical GMT in the unified term format:

    perturbation::cellLine::cellType::timepoint::concentration[::extra1::extra2::...] up|down

Positions:
    0: perturbation
    1: cellLine
    2: cellType
    3: timepoint
    4: concentration
    5+: dataset-specific extras
"""
import argparse
import gzip
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
DRUG_DIR = DATA_DIR / "drug_perturbation"
GENE_DIR = DATA_DIR / "gene_perturbation"

D = "::"
DIRECTIONS = (" up", " down", " dn")
MIN_FIELDS = 5  # perturbation, cellLine, cellType, timepoint, concentration


def validate_term(term: str) -> str | None:
    """Return None if the term is canonical, else a human-readable reason it's not."""
    if not any(term.endswith(d) for d in DIRECTIONS):
        return "missing direction suffix (' up' / ' down' / ' dn')"
    body = term.rsplit(" ", 1)[0]
    fields = body.split(D)
    if len(fields) < MIN_FIELDS:
        return f"only {len(fields)} ::-delimited fields, need at least {MIN_FIELDS}"
    if not fields[0]:
        return "perturbation slot (field 0) is empty"
    return None


def validate_gmt(path: Path, max_warn: int = 5) -> tuple[int, int, list[str]]:
    """Validate every term in a GMT. Returns (n_terms, n_bad, sample_messages)."""
    n_terms = 0
    n_bad = 0
    messages: list[str] = []
    with gzip.open(path, "rt") as f:
        for line in f:
            if not line.strip():
                continue
            n_terms += 1
            term = line.split("\t", 1)[0]
            problem = validate_term(term)
            if problem:
                n_bad += 1
                if len(messages) < max_warn:
                    messages.append(f"  {problem}: {term[:120]}")
    return n_terms, n_bad, messages


def main():
    parser = argparse.ArgumentParser(description="Validate canonical GMTs in db/data/")
    parser.add_argument("--max-warn", type=int, default=5, help="Max bad-term examples per file (default 5)")
    args = parser.parse_args()

    total_files = 0
    total_terms = 0
    total_bad = 0
    files_with_errors: list[str] = []

    for subdir in (DRUG_DIR, GENE_DIR):
        if not subdir.exists():
            continue
        print(f"\n=== {subdir.relative_to(DATA_DIR.parent)} ===")
        for gmt in sorted(subdir.glob("*.gmt.gz")):
            total_files += 1
            n_terms, n_bad, messages = validate_gmt(gmt, max_warn=args.max_warn)
            total_terms += n_terms
            total_bad += n_bad
            status = "OK" if n_bad == 0 else f"FAIL ({n_bad} of {n_terms})"
            print(f"  {gmt.name:40s} {n_terms:>7,} terms  {status}")
            for msg in messages:
                print(msg)
            if n_bad:
                files_with_errors.append(gmt.name)

    print(f"\n=== Summary ===")
    print(f"Files: {total_files} | Terms: {total_terms:,} | Non-canonical: {total_bad:,}")

    if total_bad:
        print(f"\nFAIL: {len(files_with_errors)} file(s) contain non-canonical terms:")
        for name in files_with_errors:
            print(f"  - {name}")
        print("\nFix the offending dataset.py modules in db/etl/inputs/ so they emit canonical format.")
        sys.exit(1)
    print("All GMTs are canonical ✓")


if __name__ == "__main__":
    main()
