# /// script
# requires-python = ">=3.14"
# dependencies = [
#   "psycopg2-binary",
#   "tqdm",
#   "polars",
#   "minio",
# ]
# ///
"""
Ingest GMT files into PerturbSeek database.

Usage:
  uv run db/ingest.py --batch              # Ingest all GMT files from data directories
  uv run db/ingest.py --batch --minio      # Ingest all GMT files from MinIO
  uv run db/ingest.py --batch --dry-run    # Preview without ingesting
  uv run db/ingest.py -i FILE -l LIB -d up # Single file mode

Environment variables for MinIO mode:
  MINIO_ENDPOINT: MinIO server endpoint (default: localhost:9000)
  MINIO_ROOT_USER: MinIO access key (default: minio)
  MINIO_ROOT_PASSWORD: MinIO secret key (required)
  MINIO_SECURE: Use HTTPS (default: false)
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
from db_utils import get_conn, get_cid, get_or_create_library, query, discover_gmt_files, discover_minio_gmt_files, download_minio_gmt_file

# Helper lambdas
extract_fallback_id = lambda term, lib: term.rsplit(" ", 1)[0].split("_")[1] if lib == "Novartis DRUG-seq" else None
lookup_cid = lambda pert, fallback=None: (get_cid(fallback) or get_cid(pert)) if fallback else get_cid(pert)
compute_hash = lambda genes: str(uuid.uuid5(uuid.UUID(int=0), '\t'.join(sorted(set(genes)))))
genes_to_json = lambda genes, gmap: json.dumps({gmap[g]: i for i, g in enumerate(genes) if g in gmap})

GENE_SET_COLUMNS = ['term', 'description', 'hash', 'gene_ids', 'n_gene_ids', 'library_id', 'perturbation', 'cid']


# Main Ingestion - Chunked for memory efficiency
import gc
CHUNK_SIZE = 5000  # Process 5K gene sets at a time

def _process_chunk(conn, chunk_data, all_genes, library_id, library_name, direction):
    """Process a single chunk of gene sets. Returns (inserted, skipped) counts."""
    if not chunk_data:
        return 0, 0

    terms = [f"{t} {direction}" for t, _, _ in chunk_data]
    descriptions = [d for _, d, _ in chunk_data]
    gene_lists = [g for _, _, g in chunk_data]

    # Build gene map for this chunk
    gene_map = query(conn, "SELECT coalesce(jsonb_object_agg(g.gene, g.gene_id), '{}') as gene_map FROM app_public.gene_map(%s) as g", [list(all_genes)])[0]['gene_map']

    # Insert new genes if needed
    if new_genes := all_genes - gene_map.keys():
        new_gene_df = pl.DataFrame({'id': [str(uuid.uuid4()) for _ in new_genes], 'symbol': list(new_genes)})
        buffer = StringIO()
        new_gene_df.write_csv(buffer, separator='\t')
        buffer.seek(0)
        with conn.cursor() as cur:
            cur.copy_expert("COPY app_public.gene (id, symbol) FROM STDIN WITH CSV HEADER DELIMITER E'\\t'", buffer)
        gene_map.update(dict(zip(new_gene_df['symbol'], new_gene_df['id'])))
        del new_gene_df, buffer

    # Compute hashes first to check against DB
    hashes = [compute_hash(g) for g in gene_lists]

    # Check which hashes already exist in DB (query per chunk, not cached)
    existing = {str(r['hash']) for r in query(conn, 'SELECT hash FROM app_public.gene_set WHERE hash = ANY(%s::uuid[])', [hashes])}

    # Filter to new gene sets only
    new_indices = [i for i, h in enumerate(hashes) if h not in existing]
    n_skipped = len(hashes) - len(new_indices)

    if not new_indices:
        del terms, descriptions, gene_lists, hashes, existing, gene_map
        gc.collect()
        return 0, n_skipped

    # Build DataFrame with only new gene sets
    df = pl.DataFrame({
        'term': [terms[i] for i in new_indices],
        'description': [descriptions[i] for i in new_indices],
        'genes': [gene_lists[i] for i in new_indices],
        'hash': [hashes[i] for i in new_indices],
        'library_id': [library_id] * len(new_indices),
    })
    del terms, descriptions, hashes, existing, new_indices

    df = df.with_columns([
        pl.col('genes').map_elements(len, return_dtype=pl.Int64).alias('n_gene_ids'),
    ])

    # Process perturbations and CIDs
    terms_list, genes_list = df['term'].to_list(), df['genes'].to_list()
    perts = [extract_perturbation(t, library_name) for t in terms_list]
    cids = [lookup_cid(p, extract_fallback_id(t, library_name)) for t, p in zip(terms_list, perts)]
    gene_ids = [genes_to_json(g, gene_map) for g in genes_list]
    del gene_map, gene_lists

    df = df.drop('genes').with_columns([
        pl.Series('perturbation', perts),
        pl.Series('cid', cids),
        pl.Series('gene_ids', gene_ids)
    ])
    del perts, cids, gene_ids, terms_list, genes_list

    # Write to DB via COPY
    n_new = len(df)
    buffer = StringIO()
    df.select(GENE_SET_COLUMNS).write_csv(buffer, separator='\t')
    del df
    buffer.seek(0)
    with conn.cursor() as cur:
        cur.copy_expert(f"COPY app_public.gene_set ({','.join(GENE_SET_COLUMNS)}) FROM STDIN WITH CSV HEADER DELIMITER E'\\t'", buffer)
    del buffer

    gc.collect()
    return n_new, n_skipped


def ingest_gmt(conn, gmt_path: Path, library_name: str, direction: str):
    """Ingest a GMT file into the database using chunked processing for memory efficiency."""
    library_id = get_or_create_library(conn, library_name)
    print(f"Library: {library_name} ({library_id}), direction: {direction}")

    # Process GMT in chunks
    chunk, all_genes_chunk = [], set()
    total_inserted, total_skipped = 0, 0
    chunk_num = 0

    for (term, desc), genes in tqdm(read_gmt(gmt_path), desc='Reading GMT'):
        genes = [g.upper() for g in genes]
        chunk.append((term, desc, genes))
        all_genes_chunk.update(genes)

        if len(chunk) >= CHUNK_SIZE:
            chunk_num += 1
            tqdm.write(f"  Processing chunk {chunk_num} ({len(chunk)} gene sets)...")
            inserted, skipped = _process_chunk(conn, chunk, all_genes_chunk, library_id, library_name, direction)
            total_inserted += inserted
            total_skipped += skipped
            conn.commit()
            chunk, all_genes_chunk = [], set()
            gc.collect()

    # Process final chunk
    if chunk:
        chunk_num += 1
        tqdm.write(f"  Processing final chunk {chunk_num} ({len(chunk)} gene sets)...")
        inserted, skipped = _process_chunk(conn, chunk, all_genes_chunk, library_id, library_name, direction)
        total_inserted += inserted
        total_skipped += skipped
        conn.commit()
        gc.collect()

    print(f"Inserted {total_inserted} new gene sets (skipped {total_skipped} existing)")


def main():
    parser = argparse.ArgumentParser(description='Ingest GMT files into PerturbSeek')
    parser.add_argument('--batch', action='store_true', help='Ingest all GMT files from data directories')
    parser.add_argument('--minio', action='store_true', help='Use MinIO instead of local files (requires --batch)')
    parser.add_argument('--dry-run', action='store_true', help='Preview what would be ingested')
    parser.add_argument('-i', '--input', type=Path, help='GMT file to ingest')
    parser.add_argument('-l', '--library', type=str, help='Library/dataset name')
    parser.add_argument('-d', '--direction', type=str, choices=['up', 'down'], help='Direction suffix')
    args = parser.parse_args()

    use_minio = args.minio

    if args.batch:
        if args.input or args.library or args.direction:
            parser.error('--batch cannot be used with -i, -l, or -d')

        if use_minio:
            print("Discovering GMT files from MinIO...")
            minio_files = discover_minio_gmt_files()
            if not minio_files:
                return print("No GMT files found in MinIO bucket 'gmts'")
            print(f"Found {len(minio_files)} GMT files in MinIO:\n")
            for obj_name, lib, d in minio_files:
                print(f"  {obj_name:<45} -> library={lib}, direction={d}")
            files = minio_files  # [(object_name, library, direction), ...]
        else:
            files = discover_gmt_files()
            if not files:
                return print("No GMT files found in data directories")
            print(f"Found {len(files)} GMT files to ingest:\n")
            for f, lib, d in files:
                print(f"  {f.name:<50} -> library={lib}, direction={d}")
    else:
        if args.minio:
            parser.error('--minio requires --batch')
        if not all([args.input, args.library, args.direction]):
            parser.error('-i, -l, and -d are required when not using --batch')
        files = [(args.input, args.library, args.direction)]

    if args.dry_run:
        return print("\n[DRY RUN] No changes made")

    conn = get_conn()
    try:
        for i, (file_ref, library, direction) in enumerate(files, 1):
            if use_minio:
                object_name = file_ref
                print(f"\n[{i}/{len(files)}] Downloading {object_name} from MinIO...")
                filepath = download_minio_gmt_file(object_name)
                print(f"  Downloaded to {filepath}")
            else:
                filepath = file_ref
                if args.batch:
                    print(f"\n[{i}/{len(files)}] Processing {filepath.name}\n" + "=" * 60)

            try:
                ingest_gmt(conn, filepath, library, direction)
            finally:
                # Clean up temp file if downloaded from MinIO
                if use_minio:
                    filepath.unlink(missing_ok=True)

        conn.commit()
        print(f"\nDone! Ingested {len(files)} file(s).")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
