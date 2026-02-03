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

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DB_DIR = Path(__file__).parent
DATA_DIR = DB_DIR / 'data'
DRUG_DIR = DATA_DIR / 'drug_perturbation'
GENE_DIR = DATA_DIR / 'gene_perturbation'
METADATA_DIR = DATA_DIR / 'metadata'
LIBRARY_CONFIG_PATH = PROJECT_ROOT / 'src' / 'config' / 'libraries.json'
DRUG_LOOKUP_PATH = PROJECT_ROOT / 'public' / 'metadata' / 'drug_lookup.json'

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
    rows = query(conn, 'SELECT id FROM app_public.gene_set_library WHERE name = %s', [display_name])
    if rows:
        return str(rows[0]['id'])
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO app_public.gene_set_library (name, description) VALUES (%s, %s) RETURNING id',
            [display_name, f'{display_name} gene set library']
        )
        return str(cur.fetchone()[0])


def parse_gmt_filename(filepath: Path) -> tuple[str, str] | None:
    """Parse GMT filename to extract library name and direction (up/down)."""
    for pattern in [r'^(.+)-(up|dn)_.*\.gmt', r'^(.+)_(up|dn)\.gmt']:
        if match := re.match(pattern, filepath.name):
            return (match.group(1), 'up' if match.group(2) == 'up' else 'down')
    return None


def discover_gmt_files(dirs: list[Path] = None) -> list[tuple[Path, str, str]]:
    """Discover all GMT files in data directories. Returns [(path, library, direction), ...]."""
    dirs = dirs or [DRUG_DIR, GENE_DIR]
    return [(f, *parsed) for d in dirs if d.exists()
            for f in sorted(d.glob('*.gmt*')) if (parsed := parse_gmt_filename(f))]


# MinIO file mapping: MinIO object name -> (library_name, direction)
# This maps the standardized MinIO names back to library names used in the database
MINIO_FILE_MAPPING = {
    # Drug Perturbation
    "l1000-cp-up.gmt.gz": ("l1000-cp", "up"),
    "l1000-cp-down.gmt.gz": ("l1000-cp", "down"),
    "tahoe-100m-up.gmt.gz": ("tahoe-100m", "up"),
    "tahoe-100m-down.gmt.gz": ("tahoe-100m", "down"),
    "drugseqr-up.gmt.gz": ("drugseqr", "up"),
    "drugseqr-down.gmt.gz": ("drugseqr", "down"),
    "cmap-build02-up.gmt.gz": ("cmap-build02-meta", "up"),
    "cmap-build02-down.gmt.gz": ("cmap-build02-meta", "down"),
    "sciplex-up.gmt.gz": ("sciplex", "up"),
    "sciplex-down.gmt.gz": ("sciplex", "down"),
    "deepcovermoa-up.gmt.gz": ("deepcovermoa", "up"),
    "deepcovermoa-down.gmt.gz": ("deepcovermoa", "down"),
    "geo-chem-up.gmt.gz": ("geo-chem", "up"),
    "geo-chem-down.gmt.gz": ("geo-chem", "down"),
    # Gene Perturbation
    "l1000-xpr-up.gmt.gz": ("l1000-xpr", "up"),
    "l1000-xpr-down.gmt.gz": ("l1000-xpr", "down"),
    "perturbatlas-up.gmt.gz": ("perturbatlas", "up"),
    "perturbatlas-down.gmt.gz": ("perturbatlas", "down"),
    "perturbatlas-mouse-up.gmt.gz": ("perturbatlasmouse", "up"),
    "perturbatlas-mouse-down.gmt.gz": ("perturbatlasmouse", "down"),
    "replogle-k562-genomewide-up.gmt.gz": ("reploglek562genomewide", "up"),
    "replogle-k562-genomewide-down.gmt.gz": ("reploglek562genomewide", "down"),
    "replogle-rpe1-essential-up.gmt.gz": ("reploglerpe1essential", "up"),
    "replogle-rpe1-essential-down.gmt.gz": ("reploglerpe1essential", "down"),
    "replogle-k562-essential-up.gmt.gz": ("reploglek562essential", "up"),
    "replogle-k562-essential-down.gmt.gz": ("reploglek562essential", "down"),
    "geo-gene-up.gmt.gz": ("geogene", "up"),
    "geo-gene-down.gmt.gz": ("geogene", "down"),
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


def discover_minio_gmt_files(bucket: str = "gmts") -> list[tuple[str, str, str]]:
    """Discover all GMT files in MinIO bucket. Returns [(object_name, library, direction), ...]."""
    client = get_minio_client()

    files = []
    for obj in client.list_objects(bucket):
        if obj.object_name in MINIO_FILE_MAPPING:
            library, direction = MINIO_FILE_MAPPING[obj.object_name]
            files.append((obj.object_name, library, direction))

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
