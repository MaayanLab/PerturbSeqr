"""
format_verification.py validates that every dataset's canonical GMT in the unified term format:

    perturbation::cellLine::cellType::timepoint::concentration[::extra1::extra2::...] up|down

Positions:
    0: perturbation
    1: cellLine
    2: cellType
    3: timepoint
    4: concentration
    5+: dataset-specific extras

Gene perturbation GMTs additionally fix positions 5 and 6:
    5: perturbation_type   (KO/KD/KI/OE/Mut, or blank when unknown; '|'-joined + aligned to field 0 for combos)
    6: perturbation_method (CRISPRi/Cas9/..., or blank when unknown)
"""
import argparse
import gzip
import sys
from pathlib import Path

from perturbseqr_etl.data_sources import TERM_DELIMITER, DRUG_OUTPUT, GENE_OUTPUT
from perturbseqr_etl.data_sources._pert_type import (
    GENE_PERTURBATION_TYPES as CANONICAL_GENE_PERTURBATION_TYPES,
    GENE_PERTURBATION_METHODS as CANONICAL_GENE_PERTURBATION_METHODS,
)

DRUG_DIR = DRUG_OUTPUT
GENE_DIR = GENE_OUTPUT
DATA_DIR = DRUG_OUTPUT.parent   # top-level data/

DIRECTIONS = (" up", " down")
MIN_FIELDS = 5  # perturbation, cellLine, cellType, timepoint, concentration


def validate_term(term: str, *, is_gene: bool = False) -> str | None:
    """Return None if the term is canonical, else a human-readable reason it's not.
    Direction must be exactly ' up' or ' down'. ' dn' / ' DN' / 'UP' etc. are non-canonical."""
    if term.endswith(" dn"):
        return "direction ' dn' is non-canonical; use ' down'"
    if not any(term.endswith(d) for d in DIRECTIONS):
        return "missing direction suffix (' up' / ' down')"
    body = term.rsplit(" ", 1)[0]
    fields = body.split(TERM_DELIMITER)
    if len(fields) < MIN_FIELDS:
        return f"only {len(fields)} ::-delimited fields, need at least {MIN_FIELDS}"
    if not fields[0]:
        return "perturbation slot (field 0) is empty"
    if is_gene:
        if len(fields) < 7:
            return f"gene term needs perturbation_type + perturbation_method at fields 5-6, only {len(fields)} fields"
        perturbation_type, perturbation_method = fields[5], fields[6]
        # perturbation_type / perturbation_method are blank when unknown. combination permutations are `|` joined
        if perturbation_type:
            type_parts = perturbation_type.split("|")
            bad = [p for p in type_parts if p and p not in CANONICAL_GENE_PERTURBATION_TYPES]
            if bad:
                return f"field 5 perturbation_type has non-canonical value(s) {bad}: {perturbation_type!r}"
            gene_parts = fields[0].split("|")
            if len(type_parts) > 1 and len(type_parts) != len(gene_parts):
                return (f"field 5 perturbation_type pipe-count {len(type_parts)} != "
                        f"field 0 gene pipe-count {len(gene_parts)}")
        if perturbation_method and perturbation_method not in CANONICAL_GENE_PERTURBATION_METHODS:
            return f"field 6 perturbation_method {perturbation_method!r} not in {sorted(CANONICAL_GENE_PERTURBATION_METHODS)}"
    return None


def validate_gmt(path: Path, max_warn: int = 5, *, is_gene: bool = False) -> tuple[int, int, list[str]]:
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
            problem = validate_term(term, is_gene=is_gene)
            if problem:
                n_bad += 1
                if len(messages) < max_warn:
                    messages.append(f"  {problem}: {term[:120]}")
    return n_terms, n_bad, messages


def main():
    parser = argparse.ArgumentParser(description="Validate canonical GMTs in data/")
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
        is_gene = subdir == GENE_DIR
        for gmt in sorted(subdir.glob("*.gmt.gz")):
            total_files += 1
            n_terms, n_bad, messages = validate_gmt(gmt, max_warn=args.max_warn, is_gene=is_gene)
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
        print("\nFix the offending data_sources/<dataset>/gmt.py so they emit canonical format.")
        sys.exit(1)
    print("All GMTs are canonical ✓")


if __name__ == "__main__":
    main()
