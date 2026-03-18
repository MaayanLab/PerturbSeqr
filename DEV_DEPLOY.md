# Dev Server Deployment

## Setup

```bash
cp .env.example .env
# edit .env with real passwords

# Build and push images via GitHub Actions "Build All Images" workflow
eval "$(sshkube init)"
kube-compose up
```

## MinIO + Ingest

After `kube-compose up`, create the MinIO bucket, upload GMT files, then run ingest.

```bash
# Create gmts bucket
COMPOSE_PROFILES=jobs kube-compose run minio-setup
```

Upload `.gmt.gz` files to the `gmts` bucket via https://console.s3.perturbseqr.k8s.dev.maayanlab.cloud (login: `minio` / password from `.env`).

```bash
# Run ingest
COMPOSE_PROFILES=jobs kube-compose run ingest

# Restart app so PostGraphile picks up the new schema
kube-compose restart perturbseqr-app
```

## Updating

```bash
# Rebuild images via GitHub Actions "Build All Images", then:
kube-compose restart perturbseqr-app
```

## Clean rebuild

```bash
kube-compose down -v
kube-compose up
```

Then redo MinIO + Ingest steps above.

## URLs

- App: https://perturbseqr.k8s.dev.maayanlab.cloud
- MinIO Console: https://console.s3.perturbseqr.k8s.dev.maayanlab.cloud
