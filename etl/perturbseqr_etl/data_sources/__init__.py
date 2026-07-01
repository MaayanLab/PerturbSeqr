"""
data_sources. One module per connectivity-mapping resource, plus the shared path/term constants below.

Three-stage output convention:
  Stage A: raw upstream            → CACHE_DIR (data_sources/_cache/)
  Stage B: canonical ::-format     → <dataset>/intermediate/ (per-dataset)
  Stage C: PC-filtered + ortholog  → DRUG_OUTPUT / GENE_OUTPUT (top-level data/, what ingest reads)
"""
from pathlib import Path

from perturbseqr_ingest.db_utils import DATA_DIR as _DATA_DIR

DATA_SOURCES_DIR = Path(__file__).parent
CACHE_DIR = DATA_SOURCES_DIR / "_cache"
DRUG_OUTPUT = _DATA_DIR / "drug_perturbation"
GENE_OUTPUT = _DATA_DIR / "gene_perturbation"
METADATA_DIR = _DATA_DIR / "metadata"

TERM_DELIMITER = "::"
