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

eval "$(sshkube init)"
kube-compose -f docker-compose.dev.yaml up
```

If sshkube errors out, see [sshkube connection issues](https://docs.k8s.dev.maayanlab.cloud/00-user/70-common-issues/index.html#sshkube-connection-issues):

```bash
sshkube kill-server
eval "$(sshkube init)"
```

## MinIO + Ingest

Create a secret holding env values and then set up the MinIO bucket, upload GMT and files for download, run ingest.

```bash
# Create secret from .env
kubectl create secret generic perturbseqr-env --from-env-file=.env -n johnkgardner

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

rclone copy --progress db/data/drug_perturbation/ perturbseqr-dev:data/
rclone copy --progress db/data/gene_perturbation/ perturbseqr-dev:data/
rclone copy --progress db/data/full-signatures/ perturbseqr-dev:data/
```

```bash
# Run ingest
kubectl create -f k8s/ingest-incremental-job.yaml -n johnkgardner

# Logs
kubectl get jobs -n johnkgardner
kubectl logs -f job/<job-name> -n johnkgardner

# Restart app so PostGraphile picks up the new schema
kube-compose -f docker-compose.dev.yaml restart perturbseqr-app
```

## Updating

```bash
kube-compose -f docker-compose.dev.yaml version perturbseqr-app patch
docker compose -f docker-compose.dev.yaml build perturbseqr-app
docker compose -f docker-compose.dev.yaml push perturbseqr-app
kube-compose -f docker-compose.dev.yaml diff
kube-compose -f docker-compose.dev.yaml up
```

Or bump tags in `docker-compose.dev.yaml`, rebuild, and run `kube-compose up`.

## Clean re-ingest (preserves user_gene_set)

```bash
kubectl create -f k8s/ingest-clean-job.yaml -n johnkgardner
```

## Full rebuild

`-v` deletes the postgres and minio PVCs requiring new MinIO uploads and a DB rebuild.

```bash
kube-compose -f docker-compose.dev.yaml down -v
kubectl delete secret perturbseqr-env -n johnkgardner
kube-compose -f docker-compose.dev.yaml up

kubectl create secret generic perturbseqr-env --from-env-file=.env -n johnkgardner
kubectl create -f k8s/minio-setup-job.yaml -n johnkgardner

# Re-upload GMT files

# Fresh ingest
kubectl create -f k8s/ingest-incremental-job.yaml -n johnkgardner
```

## URLs

- App: https://perturbseqr.k8s.dev.maayanlab.cloud
- MinIO Console: https://console.s3.perturbseqr.k8s.dev.maayanlab.cloud
