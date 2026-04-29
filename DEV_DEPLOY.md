# Dev Server Deployment

kube-compose and kubectl require an active sshkube session. Run `eval "$(sshkube init)"` before the other commands.

## Setup

```bash
cp .env.example .env
# edit .env:
#   - POSTGRES_PASSWORD: secure value
#   - MINIO_ROOT_PASSWORD: secure value
#   - S3_URL: http://minio:<MINIO_ROOT_PASSWORD>@perturbseqr-minio:9000/data
#   - PUBLIC_S3_URL: https://s3.perturbseqr.k8s.dev.maayanlab.cloud/data
#       (use http://localhost:9000/data if your .env doubles for local docker compose;
#       see "Secret with dev cluster URL" below)

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

After `kube-compose up`, create the secret holding env values, set up the MinIO bucket, upload GMT files, then run ingest.

```bash
# Create secret from .env (consumed by k8s Job manifests below)
kubectl create secret generic perturbseqr-env --from-env-file=.env -n johnkgardner
```

### Secret with dev cluster URL

If your local `.env` has `PUBLIC_S3_URL=http://localhost:9000/data` (because the same file is used for local docker compose), patch the secret to override that one key with the dev cluster URL:

```bash
kubectl -n johnkgardner patch secret perturbseqr-env --type=json \
  -p='[{"op":"replace","path":"/data/PUBLIC_S3_URL","value":"'$(printf 'https://s3.perturbseqr.k8s.dev.maayanlab.cloud/data' | base64)'"}]'
```

(Skip if your `.env` already has `PUBLIC_S3_URL=https://s3.perturbseqr.k8s.dev.maayanlab.cloud/data`.)

```bash
# Create data bucket and apply public-read policy (denies public access to enrich/*)
kubectl create -f k8s/minio-setup-job.yaml -n johnkgardner
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
# Run ingest (incremental — skips existing gene sets by hash)
kubectl create -f k8s/ingest-incremental-job.yaml -n johnkgardner

# Watch progress (Job names use generateName: ingest-incremental-<random>)
kubectl get jobs -n johnkgardner
kubectl logs -f job/<job-name> -n johnkgardner

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

## Clean re-ingest (preserves user_gene_set and MinIO)

Wipes library tables in postgres and re-ingests. Keeps user submissions, the sets-analyzed counter, MinIO bucket contents, and the enrich index lifecycle. Use this for routine library updates:

```bash
kubectl create -f k8s/ingest-clean-job.yaml -n johnkgardner
```

## Full rebuild

`-v` deletes the postgres and minio PVCs, so this requires new MinIO uploads and a fresh DB rebuild.

```bash
kube-compose -f docker-compose.dev.yaml down -v
kubectl delete secret perturbseqr-env -n johnkgardner
kube-compose -f docker-compose.dev.yaml up
```

Then redo MinIO + Ingest steps above.

## URLs

- App: https://perturbseqr.k8s.dev.maayanlab.cloud
- MinIO Console: https://console.s3.perturbseqr.k8s.dev.maayanlab.cloud
