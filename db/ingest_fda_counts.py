# /// script
# requires-python = ">=3.10"
# dependencies = ["psycopg2-binary", "python-dotenv", "tqdm"]
# ///
"""Populate fda_counts table from drug_lookup.json.

Usage: uv run db/ingest_fda_counts.py
"""

import json
import os
from pathlib import Path

from tqdm import tqdm

from db_utils import get_conn

# Support configurable path via INGEST_METADATA_DIR for container deployment
if metadata_dir := os.environ.get('INGEST_METADATA_DIR'):
    DRUG_LOOKUP_PATH = Path(metadata_dir) / "drug_lookup.json"
else:
    DRUG_LOOKUP_PATH = Path(__file__).parent.parent / "public" / "metadata" / "drug_lookup.json"


def ingest_fda_counts(conn, drug_lookup: dict):
    """Upsert drug_lookup entries into fda_counts table."""
    rows = [
        {"perturbation": name, "approved": info.get("fda_approved", False),
         "moa": info.get("moa") or None, "cid": info.get("cid") or None}
        for name, info in drug_lookup.items()
        if info.get("moa") or info.get("fda_approved") or info.get("cid")
    ]
    print(f"Upserting {len(rows)} entries into fda_counts...")

    with conn.cursor() as cur:
        sql = """
            INSERT INTO app_public.fda_counts (perturbation, approved, moa, cid)
            VALUES (%(perturbation)s, %(approved)s, %(moa)s, %(cid)s)
            ON CONFLICT (perturbation) DO UPDATE SET
                approved = EXCLUDED.approved, moa = EXCLUDED.moa, cid = EXCLUDED.cid
        """
        for row in tqdm(rows, desc="Inserting"):
            cur.execute(sql, row)
    conn.commit()
    print(f"Done! Upserted {len(rows)} entries")


def main():
    conn = get_conn()
    try:
        with open(DRUG_LOOKUP_PATH) as f:
            drug_lookup = json.load(f)
        print(f"Loaded {len(drug_lookup)} drugs from drug_lookup.json")
        ingest_fda_counts(conn, drug_lookup)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
