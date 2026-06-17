"""
Shared term parsing utilities for extracting perturbation names from GMT terms.

Used by ingest.py and build_drug_lookup.py.

With canonical :: delimited format, perturbation is always position 0.
"""

from typing import Optional


def extract_perturbation(term: str, library_name: str = None, lib_config: dict = None) -> Optional[str]:
    """
    Extract the perturbation name from a canonical term.

    Canonical format: perturbation::cellLine::cellType::timepoint::concentration[::extras...] up|down

    Args:
        term: The full term string (e.g., "afatinib::A375::::XH::10uM::ABY001::A13 up")
        library_name: Unused, kept for API compatibility
        lib_config: Unused, kept for API compatibility

    Returns:
        Extracted perturbation name or None
    """
    # Remove direction suffix
    base_term = term
    for suffix in (" up", " down", " dn"):
        if base_term.lower().endswith(suffix):
            base_term = base_term[: -len(suffix)]
            break

    # Perturbation is always position 0 in canonical format
    return base_term.split("::")[0] or None
