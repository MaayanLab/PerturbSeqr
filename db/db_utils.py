"""
Shared database utilities for PerturbSeek ingestion scripts.
"""

import os
import re
import json
import tempfile
from pathlib import Path

# Optional: only needed by scripts that connect to the database (not build_drug_lookup.py)
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

try:
    from minio import Minio
except ImportError:
    Minio = None

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Paths - can be overridden via environment variables for container deployment
# INGEST_CONFIG_DIR: path to config directory (default: project_root/src/config)
# INGEST_METADATA_DIR: path to metadata directory (default: project_root/public/metadata)
# INGEST_DATA_DIR: path to GMT data directory (default: db/data)
PROJECT_ROOT = Path(__file__).parent.parent
DB_DIR = Path(__file__).parent

# Support configurable paths for container deployment
if config_dir := os.environ.get('INGEST_CONFIG_DIR'):
    LIBRARY_CONFIG_PATH = Path(config_dir) / 'libraries.json'
else:
    LIBRARY_CONFIG_PATH = PROJECT_ROOT / 'src' / 'config' / 'libraries.json'

if metadata_dir := os.environ.get('INGEST_METADATA_DIR'):
    DRUG_LOOKUP_PATH = Path(metadata_dir) / 'drug_lookup.json'
else:
    DRUG_LOOKUP_PATH = PROJECT_ROOT / 'public' / 'metadata' / 'drug_lookup.json'

if data_dir := os.environ.get('INGEST_DATA_DIR'):
    DATA_DIR = Path(data_dir)
else:
    DATA_DIR = DB_DIR / 'data'

DRUG_DIR = DATA_DIR / 'drug_perturbation'
GENE_DIR = DATA_DIR / 'gene_perturbation'
METADATA_DIR = DATA_DIR / 'metadata'

# Load configs
assert LIBRARY_CONFIG_PATH.exists(), f"Missing {LIBRARY_CONFIG_PATH}"
LIBRARY_CONFIG = json.load(open(LIBRARY_CONFIG_PATH))

# Drug lookup (optional - may not exist when build_drug_lookup.py runs first)
_drug_lookup = json.load(open(DRUG_LOOKUP_PATH)) if DRUG_LOOKUP_PATH.exists() else {}
_drug_lookup_lower = {k.lower(): v for k, v in _drug_lookup.items()}

# Helpers
get_lib_config = lambda name: LIBRARY_CONFIG.get("libraries", {}).get(name, {})
get_display_name = lambda name: get_lib_config(name).get("displayName", name)
get_conn = lambda: psycopg2.connect(os.environ['DATABASE_URL'])
get_cid = lambda name: _drug_lookup_lower.get(name.lower(), {}).get("cid") if name else None


def query(conn, sql, params=None):
    """Execute query and return list of dicts."""
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(sql, params or [])
        return [dict(row) for row in cur.fetchall()]


def get_or_create_library(conn, library_name: str) -> str:
    """Get existing library_id or create new one."""
    display_name = get_display_name(library_name)
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO app_public.gene_set_library (name, description) VALUES (%s, %s) '
            'ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
            [display_name, f'{display_name} gene set library']
        )
        return str(cur.fetchone()[0])


def parse_gmt_filename(filepath: Path) -> str | None:
    """Parse GMT filename to extract library name.

    Checks MINIO_FILE_MAPPING first (handles standardized filenames),
    then falls back to stripping .gmt.gz extension.
    """
    if filepath.name in MINIO_FILE_MAPPING:
        return MINIO_FILE_MAPPING[filepath.name]

    # Fallback: strip .gmt.gz or .gmt extension
    name = filepath.name
    for suffix in ['.gmt.gz', '.gmt']:
        if name.endswith(suffix):
            return name[:-len(suffix)]
    return None


def discover_gmt_files(dirs: list[Path] = None) -> list[tuple[Path, str]]:
    """Discover all GMT files in data directories. Returns [(path, library), ...]."""
    dirs = dirs or [DRUG_DIR, GENE_DIR]
    return [(f, parsed) for d in dirs if d.exists()
            for f in sorted(d.glob('*.gmt*')) if (parsed := parse_gmt_filename(f))]


# MinIO file mapping: MinIO object name -> library_name
# This maps the standardized MinIO names back to library names used in the database
MINIO_FILE_MAPPING = {
    # Drug Perturbation
    "lincs-l1000-cp.gmt.gz": "lincs-l1000-cp",
    "tahoe-100m.gmt.gz": "tahoe-100m",
    "nibr-drug-seq.gmt.gz": "nibr-drug-seq",
    "microarrays-cmap.gmt.gz": "microarrays-cmap",
    "sciplex.gmt.gz": "sciplex",
    "deepcover-moa.gmt.gz": "deepcover-moa",
    "creeds-chem.gmt.gz": "creeds-chem",
    "rummageo-chem.gmt.gz": "rummageo-chem",
    "ginkgo-bioworks.gmt.gz": "ginkgo-bioworks",
    # Gene Perturbation
    "lincs-l1000-xpr.gmt.gz": "lincs-l1000-xpr",
    "perturb-atlas-human.gmt.gz": "perturb-atlas-human",
    "perturb-atlas-mouse.gmt.gz": "perturb-atlas-mouse",
    "replogle-perturb-seq.gmt.gz": "replogle-perturb-seq",
    "creeds-gene.gmt.gz": "creeds-gene",
    "rummageo-gene.gmt.gz": "rummageo-gene",
}


def get_minio_client() -> "Minio":
    """Create MinIO client from environment variables."""
    if Minio is None:
        raise ImportError("minio package not installed. Install with: uv pip install minio")

    endpoint = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
    access_key = os.environ.get("MINIO_ROOT_USER", "minio")
    secret_key = os.environ.get("MINIO_ROOT_PASSWORD", "")
    secure = os.environ.get("MINIO_SECURE", "false").lower() == "true"

    if not secret_key:
        raise ValueError("MINIO_ROOT_PASSWORD environment variable is required")

    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)


def discover_minio_gmt_files(bucket: str = "gmts") -> list[tuple[str, str]]:
    """Discover all GMT files in MinIO bucket. Returns [(object_name, library), ...]."""
    client = get_minio_client()

    files = []
    for obj in client.list_objects(bucket):
        if obj.object_name in MINIO_FILE_MAPPING:
            library = MINIO_FILE_MAPPING[obj.object_name]
            files.append((obj.object_name, library))

    return sorted(files, key=lambda x: x[0])


def download_minio_gmt_file(object_name: str, bucket: str = "gmts") -> Path:
    """Download a GMT file from MinIO to a temp directory. Returns the local path."""
    client = get_minio_client()

    # Create temp file with same extension
    suffix = "".join(Path(object_name).suffixes)  # e.g., ".gmt.gz"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_path = Path(temp_file.name)
    temp_file.close()

    client.fget_object(bucket, object_name, str(temp_path))
    return temp_path
