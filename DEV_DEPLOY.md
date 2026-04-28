# Dev Server Deployment

kube-compose requires active sshkube session. Run `eval "$(sshkube init)"` before the other commands.

## Setup

```bash
cp .env.example .env
# edit .env with real passwords

# Build and push images via GitHub Actions "Build All Images" workflow
eval "$(sshkube init)"
kube-compose -f docker-compose.dev.yaml up
```

If sshkube errors out, see [sshkube connection issues](https://docs.k8s.dev.maayanlab.cloud/00-user/70-common-issues/index.html#sshkube-connection-issues):

```bash
sshkube kill-server
eval "$(sshkube init)"
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

# upload canonical GMTs to data bucket
rclone copy --progress db/data/drug_perturbation/ perturbseqr-dev:data/
rclone copy --progress db/data/gene_perturbation/ perturbseqr-dev:data/

# upload full-signature files (Harmonizome matrices, CREEDS JSON, .h5ad, etc.) for the download page
rclone copy --progress db/data/full-signatures/ perturbseqr-dev:data/
```

```bash
# Run ingest
COMPOSE_PROFILES=jobs kube-compose -f docker-compose.dev.yaml run ingest

# Restart app so PostGraphile picks up the new schema
kube-compose -f docker-compose.dev.yaml restart perturbseqr-app
```

## Updating

```bash
# Bump version, build, push, deploy
kube-compose -f docker-compose.dev.yaml version perturbseqr-app patch
docker compose -f docker-compose.dev.yaml build perturbseqr-app
docker compose -f docker-compose.dev.yaml push perturbseqr-app
kube-compose -f docker-compose.dev.yaml diff
kube-compose -f docker-compose.dev.yaml up
```

Or trigger a CI rebuild via GitHub Actions "Build All Images", then bump tags in `docker-compose.dev.yaml` and run `kube-compose up`.

## Clean rebuild

```bash
kube-compose -f docker-compose.dev.yaml down -v
kube-compose -f docker-compose.dev.yaml up
```

Then redo MinIO + Ingest steps above.

## URLs

- App: https://perturbseqr.k8s.dev.maayanlab.cloud
- MinIO Console: https://console.s3.perturbseqr.k8s.dev.maayanlab.cloud
