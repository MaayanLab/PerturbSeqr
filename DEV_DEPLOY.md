# Dev Server Deployment

## Setup

```bash
cp .env.example .env
# edit .env with real passwords

# Build and push images via GitHub Actions "Build All Images" workflow
eval "$(sshkube init)"
kube-compose -f docker-compose.dev.yaml up
```

## MinIO + Ingest

After `kube-compose up`, create the MinIO bucket, upload GMT files, then run ingest.

```bash
# Create data bucket
COMPOSE_PROFILES=jobs kube-compose -f docker-compose.dev.yaml run minio-setup
```

```bash
# Add rclone config
#[perturbseqr-dev]
#type = s3
#provider = Minio
#access_key_id = minio
#secret_access_key = MINIO_ROOT_PASSWORD from .env
#endpoint = https://s3.perturbseqr.k8s.dev.maayanlab.cloud

# upload .gmt.gz files to data bucket
rclone copyto --progress gmts perturbseqr-dev:data/
```

```bash
# Run ingest
COMPOSE_PROFILES=jobs kube-compose -f docker-compose.dev.yaml run ingest

# Restart app so PostGraphile picks up the new schema
kube-compose -f docker-compose.dev.yaml restart perturbseqr-app
```

## Updating

```bash
# Rebuild images via GitHub Actions "Build All Images", then:
kube-compose -f docker-compose.dev.yaml restart perturbseqr-app
```

## Clean rebuild

```bash
kube-compose -f docker-compose.dev.yaml down -v
kube-compose -f docker-compose.dev.yaml up
```

Then redo MinIO + Ingest steps above.

## URLs

- App: https://perturbseqr.k8s.dev.maayanlab.cloud
- MinIO Console: https://console.s3.perturbseqr.k8s.dev.maayanlab.cloud
