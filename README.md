# PerturbSeek

## Quick Start

```bash
# Start services
docker compose up -d

# Upload GMT files to MinIO
docker compose run upload-gmts

# Run migrations + ingest data
docker compose run ingest
```

App: http://localhost:3000

## Adding New Data

```bash
# Add GMT file to db/data/drug_perturbation/ or gene_perturbation/
docker compose run upload-gmts
docker compose run ingest
```

## Development

```bash
docker compose up -d perturbseqr-postgres perturbseqr-minio perturbseqr-enrich
npm install && npm run dev
```

## Reset

```bash
docker compose down -v
docker compose up -d
docker compose run upload-gmts
docker compose run ingest
```

## Job Containers

### upload-gmts

Uploads GMT files from `db/data/` to MinIO. Idempotent - skips files that already exist.

```bash
docker compose run upload-gmts              # Upload missing files only
docker compose run upload-gmts --force      # Re-upload all files
docker compose run upload-gmts --file l1000-cp-up.gmt.gz  # Upload specific file
```

Source files in `db/data/drug_perturbation/` and `db/data/gene_perturbation/` are mapped to standardized names in MinIO (e.g., `l1000-cp_up.gmt.gz` → `l1000-cp-up.gmt.gz`).

### ingest

Loads data from MinIO into Postgres. Runs:

1. Database migrations (dbmate)
2. Gene set ingest from MinIO (incremental - skips existing)
3. FDA counts ingest
4. Materialized view refresh
5. Background creation + enrich index trigger
6. Gene info from NCBI

```bash
docker compose run ingest
```

Requires ~8GB+ memory for large libraries (l1000-cp has 500K+ gene sets).

## Building Images

The ingest image is NOT built via GitHub Actions because GMT data files are gitignored (too large for git). Build it locally:

```bash
./scripts/build_ingest_image.sh 0.0.1 --push
```
