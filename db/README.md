# db/

## Scripts

- `ingest.py`: Ingest GMT files from `data/` into database
- `ingest_fda_counts.py`: Populate FDA approval status and signature counts
- `ingest_gene_info.py`: Fetch gene descriptions from NCBI
- `update_background.py`: Update background gene sets for enrichment
- `build_drug_lookup.py`: Build `public/metadata/drug_lookup.json` with CIDs/MOAs

## Modules

- `db_utils.py`: Database connection and query helpers
- `gmt_parser.py`: GMT file parsing
- `perturbation_parser.py`: Extract perturbation names from gene set terms

## Data Directory (`data/`, gitignored)

- `drug_perturbation/`: Drug perturbation GMT files
- `gene_perturbation/`: Gene perturbation GMT files
- `metadata/`: Normalized metadata TSVs
- `metadata/original/`: Original metadata files
- `cache/`: PubChem CID lookup cache

## Migrations

- `init`: Base schema
- `add_perturbation_column`: Parsed perturbation on gene_set
- `add_cid_column`: PubChem CID for compound normalization
- `fix_moas_passthrough`: MOA consensus data passthrough
