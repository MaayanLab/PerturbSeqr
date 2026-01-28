"""
Shared term parsing utilities for extracting perturbation names from GMT terms.

Used by ingest.py and build_drug_lookup.py.
"""

import json
from pathlib import Path

# Load libraries config once at module level
LIBRARIES_JSON = Path(__file__).parent.parent / "src" / "config" / "libraries.json"
LIBRARIES_CONFIG = json.load(open(LIBRARIES_JSON)).get("libraries", {}) if LIBRARIES_JSON.exists() else {}

get_lib_config = lambda name: LIBRARIES_CONFIG.get(name, {})


def extract_perturbation(term: str, library_name: str = None, lib_config: dict = None) -> str | None:
    """
    Extract the perturbation name from a term using library config.

    Args:
        term: The full term string (e.g., "aspirin_10uM_MCF7 up")
        library_name: Library key to look up config (e.g., "tahoe-100m")
        lib_config: Direct library config dict (alternative to library_name)

    Returns:
        Extracted perturbation name or None
    """
    if lib_config is None:
        lib_config = get_lib_config(library_name) if library_name else {}

    term_format = lib_config.get("termFormat", {})
    if not term_format:
        return None

    fields = term_format.get("fields", [])
    if not fields or "perturbation" not in fields:
        return None

    delimiter = term_format.get("delimiter", "_")
    join_middle = term_format.get("joinMiddle", False)
    fields_from_end = term_format.get("fieldsFromEnd", 0)

    # Remove direction suffix
    base_term = term
    for suffix in [" up", " down", " dn"]:
        if base_term.lower().endswith(suffix):
            base_term = base_term[:-len(suffix)]
            break

    pert_index = fields.index("perturbation")
    parts = base_term.split(delimiter)

    if join_middle and fields_from_end > 0:
        if len(parts) <= fields_from_end + 1:
            return parts[pert_index] if pert_index < len(parts) else None
        if pert_index == 0:
            return parts[0]
        elif pert_index >= len(fields) - fields_from_end:
            end_offset = len(fields) - pert_index - 1
            return parts[-(end_offset + 1)] if end_offset < len(parts) else None
        else:
            middle_start = 1
            middle_end = len(parts) - fields_from_end
            return delimiter.join(parts[middle_start:middle_end])
    else:
        return parts[pert_index] if pert_index < len(parts) else None
