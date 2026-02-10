# PerturbSeek

## Quick Start

```bash
# Start services (postgres, minio, enrich, app)
docker compose up -d

# Create MinIO bucket
docker compose run --rm minio-setup

# Upload GMT files to MinIO (or use `mc` CLI)
docker compose cp db/data/gmts perturbseqr-minio:/data/

# Run migrations + ingest data
docker compose run --rm ingest
```

App: http://localhost:3000

## Development

```bash
docker compose up -d perturbseqr-postgres perturbseqr-minio perturbseqr-enrich
npm install && npm run dev
```

## Reset

```bash
docker compose down -v
docker compose up -d
docker compose run --rm minio-setup
docker compose cp db/data/gmts perturbseqr-minio:/data/
docker compose run --rm ingest
```

## Job Containers

### minio-setup

Creates the MinIO bucket and sets public read policy. To upload GMT files, either copy them directly into the MinIO container or use the [`mc` CLI](https://min.io/docs/minio/linux/reference/minio-mc.html).

### ingest

Reads GMT files from MinIO and loads them into Postgres. Also runs database migrations, FDA counts ingest, materialized view refresh, background creation, and gene info from NCBI. **Assumes MinIO is already populated with GMT files.**

```bash
docker compose run --rm ingest
```


