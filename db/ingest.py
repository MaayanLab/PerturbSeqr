# /// script
# requires-python = ">=3.14"
# dependencies = [
#   "psycopg2-binary",
#   "tqdm",
#   "polars",
# ]
# ///
"""
Ingest GMT files into PerturbSeek database.

Usage:
  uv run db/ingest.py --batch              # Ingest all GMT files from data directories
  uv run db/ingest.py --batch --dry-run    # Preview without ingesting
  uv run db/ingest.py -i FILE -l LIB -d up # Single file mode
"""

import json
import uuid
import argparse
from io import StringIO
from pathlib import Path
from pathlib import Path

import polars as pl
from tqdm import tqdm
from gmt_parser import read_gmt
from perturbation_parser import extract_perturbation
from db_utils import get_conn, get_cid, get_or_create_library, query, discover_gmt_files

# Helper lambdas
extract_fallback_id = lambda term, lib: term.rsplit(" ", 1)[0].split("_")[1] if lib == "drugseqr" else None
lookup_cid = lambda pert, fallback=None: (get_cid(fallback) or get_cid(pert)) if fallback else get_cid(pert)
compute_hash = lambda genes: str(uuid.uuid5(uuid.UUID(int=0), '\t'.join(sorted(set(genes)))))
genes_to_json = lambda genes, gmap: json.dumps({gmap[g]: i for i, g in enumerate(genes) if g in gmap})

GENE_SET_COLUMNS = ['term', 'description', 'hash', 'gene_ids', 'n_gene_ids', 'library_id', 'perturbation', 'cid']


# Main Ingestion
# Note: Large files (e.g., l1000-cp with 718K gene sets) require ~4GB RAM.
# If memory becomes an issue, add chunked processing to handle GMT in batches.
def ingest_gmt(conn, gmt_path: Path, library_name: str, direction: str):
    """Ingest a GMT file into the database using polars for vectorized operations."""
    library_id = get_or_create_library(conn, library_name)
    print(f"Library: {library_name} ({library_id}), direction: {direction}")

    # Read GMT file into lists
    terms, descriptions, gene_lists, all_genes = [], [], [], set()
    for (term, desc), genes in tqdm(read_gmt(gmt_path), desc='Reading GMT'):
        genes = [g.upper() for g in genes]
        terms.append(f"{term} {direction}")
        descriptions.append(desc)
        gene_lists.append(genes)
        all_genes.update(genes)
    print(f"Loaded {len(terms)} gene sets with {len(all_genes)} unique genes")

    # Build gene map from database
    gene_map = query(conn, "SELECT coalesce(jsonb_object_agg(g.gene, g.gene_id), '{}') as gene_map FROM app_public.gene_map(%s) as g", [list(all_genes)])[0]['gene_map']

    # Insert new genes if needed
    if new_genes := all_genes - gene_map.keys():
        print(f"Inserting {len(new_genes)} new genes...")
        new_gene_df = pl.DataFrame({'id': [str(uuid.uuid4()) for _ in new_genes], 'symbol': list(new_genes)})
        buffer = StringIO()
        new_gene_df.write_csv(buffer, separator='\t')
        buffer.seek(0)
        with conn.cursor() as cur:
            cur.copy_expert("COPY app_public.gene (id, symbol) FROM STDIN WITH CSV HEADER DELIMITER E'\\t'", buffer)
        gene_map.update(dict(zip(new_gene_df['symbol'], new_gene_df['id'])))

    # Build DataFrame and compute hashes
    df = pl.DataFrame({'term': terms, 'description': descriptions, 'genes': gene_lists, 'library_id': [library_id] * len(terms)})
    df = df.with_columns([
        pl.col('genes').map_elements(compute_hash, return_dtype=pl.String).alias('hash'),
        pl.col('genes').map_elements(len, return_dtype=pl.Int64).alias('n_gene_ids'),
    ])

    # Filter to new gene sets only (hash-based dedup is faster than full row comparison)
    existing_hashes = {r['hash'] for r in query(conn, 'SELECT DISTINCT hash FROM app_public.gene_set')}
    df = df.filter(~pl.col('hash').is_in(existing_hashes))
    n_new, n_skipped = len(df), len(terms) - len(df)

    if n_new == 0:
        return print(f"No new gene sets to insert (skipped {n_skipped} existing)")

    print(f"Processing {n_new} new gene sets (skipping {n_skipped} existing)...")
    terms_list, genes_list = df['term'].to_list(), df['genes'].to_list()
    perts = [extract_perturbation(t, library_name) for t in tqdm(terms_list, desc='Extracting perturbations')]
    cids = [lookup_cid(p, extract_fallback_id(t, library_name)) for t, p in zip(terms_list, perts)]
    gene_ids = [genes_to_json(g, gene_map) for g in tqdm(genes_list, desc='Building gene_ids')]

    df = df.with_columns([pl.Series('perturbation', perts), pl.Series('cid', cids), pl.Series('gene_ids', gene_ids)])

    # Write to DB via COPY
    print(f"Inserting {n_new} gene sets...")
    buffer = StringIO()
    df.select(GENE_SET_COLUMNS).write_csv(buffer, separator='\t')
    buffer.seek(0)
    with conn.cursor() as cur:
        cur.copy_expert(f"COPY app_public.gene_set ({','.join(GENE_SET_COLUMNS)}) FROM STDIN WITH CSV HEADER DELIMITER E'\\t'", buffer)
    print(f"Inserted {n_new} new gene sets (skipped {n_skipped} existing)")


def main():
    parser = argparse.ArgumentParser(description='Ingest GMT files into PerturbSeek')
    parser.add_argument('--batch', action='store_true', help='Ingest all GMT files from data directories')
    parser.add_argument('--dry-run', action='store_true', help='Preview what would be ingested')
    parser.add_argument('-i', '--input', type=Path, help='GMT file to ingest')
    parser.add_argument('-l', '--library', type=str, help='Library/dataset name')
    parser.add_argument('-d', '--direction', type=str, choices=['up', 'down'], help='Direction suffix')
    args = parser.parse_args()

    if args.batch:
        if args.input or args.library or args.direction:
            parser.error('--batch cannot be used with -i, -l, or -d')
        files = discover_gmt_files()
        if not files:
            return print("No GMT files found in data directories")
        print(f"Found {len(files)} GMT files to ingest:\n")
        for f, lib, d in files:
            print(f"  {f.name:<50} -> library={lib}, direction={d}")
    else:
        if not all([args.input, args.library, args.direction]):
            parser.error('-i, -l, and -d are required when not using --batch')
        files = [(args.input, args.library, args.direction)]

    if args.dry_run:
        return print("\n[DRY RUN] No changes made")

    conn = get_conn()
    try:
        for i, (filepath, library, direction) in enumerate(files, 1):
            if args.batch:
                print(f"\n[{i}/{len(files)}] Processing {filepath.name}\n" + "=" * 60)
            ingest_gmt(conn, filepath, library, direction)
        conn.commit()
        print(f"\nDone! Ingested {len(files)} file(s).")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
