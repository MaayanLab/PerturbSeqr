# /// script
# requires-python = ">=3.10"
# dependencies = ["psycopg2-binary", "python-dotenv", "requests"]
# ///
"""Update the background gene set after ingesting new data.

Usage: uv run db/update_background.py
Set ENRICH_URL env var to override default (http://127.0.0.1:8000)
"""

import os
import requests

from db_utils import get_conn, query

ENRICH_URL = os.environ.get('ENRICH_URL', 'http://127.0.0.1:8000')


def update_background(conn):
    """Create new background from gene table (faster than expanding all gene_sets)."""
    current_backgrounds = [r['id'] for r in query(conn, 'SELECT id FROM app_public.background')]

    # Create new background from gene table directly
    new_background = query(conn, '''
        INSERT INTO app_public.background (gene_ids, n_gene_ids)
        SELECT jsonb_object_agg(id::text, null), count(*)
        FROM app_public.gene
        RETURNING id, n_gene_ids;
    ''')[0]
    conn.commit()
    print(f"Created background {new_background['id']} ({new_background['n_gene_ids']} genes)")

    # Trigger index creation in enrich API
    assert requests.get(f"{ENRICH_URL}/{new_background['id']}").ok

    # Remove old backgrounds
    if current_backgrounds:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM app_public.background WHERE id = ANY(%s::uuid[])', [current_backgrounds])
        conn.commit()
        for bg_id in current_backgrounds:
            requests.delete(f"{ENRICH_URL}/{bg_id}")
        print(f"Removed {len(current_backgrounds)} old background(s)")


def main():
    conn = get_conn()
    try:
        update_background(conn)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
