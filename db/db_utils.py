"""
Shared database utilities for PerturbSeek ingestion scripts.
"""

import os
import re
import json
from pathlib import Path

# Optional: only needed by scripts that connect to the database (not build_drug_lookup.py)
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

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
