"""Ingest gene descriptions and summaries from NCBI into the database.

Note: L2S2 fetches summaries via the NCBI API, but that is rate-limited.
This uses a bulk FTP download instead.

Usage: uv run db/ingest_gene_info.py
"""

import gzip
import urllib.request
from pathlib import Path

import polars as pl
import psycopg2.extras

from .db_utils import get_conn, query


def load_gene_summary(path: Path) -> dict[int, str]:
    """Load gene_summary.gz manually since it has malformed CSV (embedded newlines/quotes)."""
    summaries = {}
    with gzip.open(path, 'rt', encoding='utf-8', errors='replace') as f:
        for line in f:
            if line.startswith('#'):
                continue
            parts = line.rstrip('\n').split('\t', 2)  # Split into at most 3 parts
            if len(parts) >= 3:
                try:
                    gene_id = int(parts[1])
                    summaries[gene_id] = parts[2] if parts[2] != '-' else None
                except ValueError:
                    continue
    return summaries


DATA_DIR = Path(__file__).parent / 'data'


def ensure_gene_info() -> Path:
    path = DATA_DIR / 'Homo_sapiens.gene_info.gz'
    if not path.exists():
        DATA_DIR.mkdir(exist_ok=True)
        urllib.request.urlretrieve(
            'https://ftp.ncbi.nlm.nih.gov/gene/DATA/GENE_INFO/Mammalia/Homo_sapiens.gene_info.gz', path)
    return path

def ensure_gene_summary() -> Path:
    path = DATA_DIR / 'gene_summary.gz'
    if not path.exists():
        DATA_DIR.mkdir(exist_ok=True)
        urllib.request.urlretrieve('https://ftp.ncbi.nlm.nih.gov/gene/DATA/gene_summary.gz', path)
    return path


def load_gene_data(gene_info_path: Path, summary_path: Path) -> dict[str, dict]:
    """Load and merge gene_info and gene_summary. Returns genes dict keyed by symbol and synonyms."""
    df_info = pl.read_csv(gene_info_path, separator='\t', null_values='-')
    summaries = load_gene_summary(summary_path)

    # Index by both symbol and synonyms since NCBI only has primary symbols as rows
    # (e.g. P53 only appears as a synonym attribute in TP53's row, not its own row)
    genes = {}
    for row in df_info.iter_rows(named=True):
        gene_id = row['GeneID']
        info = {'description': row['description'], 'ncbi_gene_id': gene_id, 'summary': summaries.get(gene_id)}
        genes[row['Symbol'].upper()] = info
        if row['Synonyms']:
            for syn in row['Synonyms'].split('|'):
                if syn and syn.upper() not in genes:
                    genes[syn.upper()] = info
    return genes


def update_genes(genes: dict[str, dict]):
    conn = get_conn()

    try:
        genes_without_info = query(conn, """
            SELECT id, symbol FROM app_public.gene
            WHERE description IS NULL OR summary IS NULL
        """)
        print(f"Found {len(genes_without_info)} genes needing info")

        updates = []
        for row in genes_without_info:
            info = genes.get(row['symbol'].upper())
            if info:
                updates.append((info['description'], info['ncbi_gene_id'], info.get('summary'), row['id']))

        print(f"Matched {len(updates)} genes to NCBI data")

        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(
                cur,
                "UPDATE app_public.gene SET description = %s, ncbi_gene_id = %s, summary = %s WHERE id = %s",
                updates
            )
            conn.commit()

        print(f"Done! Updated {len(updates)} genes")

    finally:
        conn.close()


def main():
    genes = load_gene_data(ensure_gene_info(), ensure_gene_summary())
    update_genes(genes)


if __name__ == '__main__':
    main()
