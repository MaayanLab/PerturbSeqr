"""
Shared database utilities for PerturbSeek ingestion scripts.
"""

import os
import re
import json
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from .library_manifest import s3_location
from .library_registration import downloadable_artifacts, existing_manifests, register_artifacts

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
# INGEST_MANIFEST_DIR: path to manifests (default: project_root/libraries)
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
MANIFEST_DIR = Path(os.environ.get('INGEST_MANIFEST_DIR') or PROJECT_ROOT / 'libraries')

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

LEGACY_MANIFESTS = {m['slug']: m for m in existing_manifests(MANIFEST_DIR)}

# Drug lookup (optional - may not exist when build_drug_lookup.py runs first)
_drug_lookup = json.load(open(DRUG_LOOKUP_PATH)) if DRUG_LOOKUP_PATH.exists() else {}
_drug_lookup_lower = {k.lower(): v for k, v in _drug_lookup.items()}

# Helpers
get_lib_config = lambda name: LEGACY_MANIFESTS.get(name, {})
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
        library_id = str(cur.fetchone()[0])
        # Bootstrap legacy batch imports after the catalog migration. Manifest imports
        # stage their own revision and do not use this compatibility path.
        cur.execute("SELECT to_regclass('app_public.library_revision')")
        if cur.fetchone()[0]:
            config = get_lib_config(library_name)
            resource_key = config.get("resource", {}).get("key", library_name)
            cur.execute("""SELECT l.active_revision_id, r.version
                           FROM app_public.gene_set_library l
                           LEFT JOIN app_public.library_revision r ON r.id=l.active_revision_id
                           WHERE l.id=%s""", [library_id])
            active, version = cur.fetchone()
            if active is not None and version != "legacy":
                raise ValueError(f"Use library-setup to update manifest-managed library: {display_name}")
            if active is None:
                manifest = json.dumps({**config, "legacy": True, "slug": library_name, "displayName": display_name,
                                       "description": f"{display_name} gene set library", "category": config.get("category"),
                                       "resource": {"key": resource_key}})
                cur.execute("""INSERT INTO app_public.library_revision(id,library_id,version,checksum,manifest,status,published_at)
                            VALUES(%s,%s,'legacy',%s,%s::jsonb,'published',now())""",
                            [library_id, library_id, 'legacy-' + library_id, manifest])
                register_artifacts(cur, library_id, downloadable_artifacts(config))
                cur.execute("""UPDATE app_public.gene_set_library SET active_revision_id=%s,slug=%s,category=%s,
                            resource_key=%s WHERE id=%s""", [library_id, library_name, config.get("category"), resource_key, library_id])
        return library_id


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


def legacy_gmt_key(manifest):
    gmt = manifest['input']['gmt']
    return s3_location(gmt)[1] if gmt.startswith('s3://') else gmt


# Preserve legacy batch discovery for the local or configured object store.
GMT_FILE_MAPPING = {legacy_gmt_key(manifest): slug for slug, manifest in LEGACY_MANIFESTS.items()}


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
