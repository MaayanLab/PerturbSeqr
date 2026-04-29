# Prod Server Deployment

## Setup

```bash
cp .env.example .env
# edit .env with real passwords

# Build and push images via GitHub Actions "Build All Images" workflow
kube-compose up
```

## MinIO + Ingest

After `kube-compose up`, create the MinIO bucket, upload GMT files, then run ingest.

```bash
# Create data bucket
COMPOSE_PROFILES=jobs kube-compose run minio-setup
```

```bash
# Add rclone config
#[perturbseqr]
#type = s3
#provider = Minio
#access_key_id = minio
#secret_access_key = MINIO_ROOT_PASSWORD from .env
#endpoint = https://s3.perturbseqr.maayanlab.cloud

# upload .gmt.gz files to gmts bucket
rclone copyto --progress gmts perturbseqr:data/
```

```bash
# Run ingest (incremental — skips existing gene sets by hash)
COMPOSE_PROFILES=jobs kube-compose run ingest

# Restart app so PostGraphile picks up the new schema
kube-compose restart perturbseqr-app
```

## Updating

```bash
# Rebuild images via GitHub Actions "Build All Images", then:
kube-compose restart perturbseqr-app
```

## Clean re-ingest (preserves user_gene_set and MinIO)

Wipes library tables in postgres and re-ingests. Keeps user submissions, the sets-analyzed counter, MinIO bucket contents, and the enrich index lifecycle. Use this for routine library updates:

```bash
INGEST_CLEAN=true COMPOSE_PROFILES=jobs kube-compose run ingest
```

## Full rebuild

`-v` deletes the postgres and minio PVCs, so this requires new MinIO uploads and a fresh DB rebuild.

```bash
kube-compose down -v
kube-compose up
```

Then redo MinIO + Ingest steps above.

## URLs

- App: https://perturbseqr.maayanlab.cloud
- MinIO Console: https://console.s3.perturbseqr.maayanlab.cloud
