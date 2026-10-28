"""
Shared database utilities for PerturbSeek ingestion scripts.
"""

import os
import re
import json
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

# Optional: only needed by scripts that connect to the database (not build_drug_lookup.py)
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

try:
    import boto3
    from botocore.config import Config
except ImportError:
    boto3 = None
    Config = None

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Paths - can be overridden via environment variables for container deployment
# INGEST_CONFIG_DIR: path to config directory (default: project_root/src/config)
# INGEST_METADATA_DIR: path to metadata directory (default: project_root/public/metadata)
# INGEST_DATA_DIR: path to GMT data directory (default: db/data)
def _find_repo_root(start: Path) -> Path:
    """Walk up to the repo root (dir with package.json/.git); fall back to start."""
    for p in (start, *start.parents):
        if (p / 'package.json').exists() or (p / '.git').exists():
            return p
    return start

DB_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = _find_repo_root(DB_DIR)

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
    DATA_DIR = PROJECT_ROOT / 'data'

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

    Checks GMT_FILE_MAPPING first (handles standardized filenames),
    then falls back to stripping .gmt.gz extension.
    """
    if filepath.name in GMT_FILE_MAPPING:
        return GMT_FILE_MAPPING[filepath.name]

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


# Standardized GMT filename -> library name used in the database.
GMT_FILE_MAPPING = {
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
    "cm4ai.gmt.gz": "cm4ai",
}


def get_minio_client():
    """Create an S3 client using the legacy MinIO environment variables."""
    if boto3 is None:
        raise ImportError("boto3 package not installed. Install with: uv pip install boto3")

    endpoint = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
    access_key = os.environ.get("MINIO_ROOT_USER", "minio")
    secret_key = os.environ.get("MINIO_ROOT_PASSWORD", "")
    secure = os.environ.get("MINIO_SECURE", "false").lower() == "true"

    if not secret_key:
        raise ValueError("MINIO_ROOT_PASSWORD environment variable is required")

    return boto3.client(
        "s3",
        endpoint_url=f"{'https' if secure else 'http'}://{endpoint}",
        region_name="us-east-1",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(s3={"addressing_style": "path"}),
    )


def get_s3_bucket() -> str:
    """Use the configured S3 bucket, or the legacy MinIO bucket."""
    return os.environ["INGEST_S3_BUCKET"] if os.environ.get("INGEST_S3_ENDPOINT") else "data"


def get_s3_client():
    """Create an S3 client without changing unconfigured local/dev MinIO behavior."""
    endpoint = os.environ.get("INGEST_S3_ENDPOINT")
    if not endpoint:
        return get_minio_client()
    if boto3 is None:
        raise ImportError("boto3 package not installed. Install with: uv pip install boto3")

    url = urlsplit(endpoint)
    if url.scheme not in ("http", "https") or not url.netloc or url.path not in ("", "/"):
        raise ValueError("INGEST_S3_ENDPOINT must be an HTTP(S) service URL without a bucket path")
    region = os.environ.get("AWS_REGION") or "us-east-1"
    return boto3.client("s3", endpoint_url=endpoint, region_name=region)


def discover_s3_gmt_files(bucket: str | None = None) -> list[tuple[str, str]]:
    """Discover supported GMT objects. Returns [(object_name, library), ...]."""
    bucket = get_s3_bucket() if bucket is None else bucket
    client = get_s3_client()

    files = []
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket, Delimiter="/"):
        for obj in page.get("Contents", []):
            if obj["Key"] in GMT_FILE_MAPPING:
                library = GMT_FILE_MAPPING[obj["Key"]]
                files.append((obj["Key"], library))

    return sorted(files, key=lambda x: x[0])


def download_s3_gmt_file(object_name: str, bucket: str | None = None) -> Path:
    """Download a GMT object to a temporary file and return its local path."""
    bucket = get_s3_bucket() if bucket is None else bucket
    client = get_s3_client()

    # Create temp file with same extension
    suffix = "".join(Path(object_name).suffixes)  # e.g., ".gmt.gz"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_path = Path(temp_file.name)
    temp_file.close()

    client.download_file(bucket, object_name, str(temp_path))
    return temp_path


def discover_minio_gmt_files(bucket: str | None = None) -> list[tuple[str, str]]:
    """Compatibility alias for callers using the previous MinIO-specific name."""
    return discover_s3_gmt_files(bucket)


def download_minio_gmt_file(object_name: str, bucket: str | None = None) -> Path:
    """Compatibility alias for callers using the previous MinIO-specific name."""
    return download_s3_gmt_file(object_name, bucket)
