# Prod Server Deployment

## Setup

```bash
cp .env.example .env
# edit .env:
#   - POSTGRES_PASSWORD: secure value
#   - MINIO_ROOT_PASSWORD: secure value
#   - S3_URL: http://minio:<MINIO_ROOT_PASSWORD>@perturbseqr-minio:9000/data
#   - PUBLIC_S3_URL: https://perturbseqr.s3.amazonaws.com

kube-compose up
```

Production downloads use the AWS S3 bucket root, with no `/data` suffix. Rebuild the app image when changing `PUBLIC_S3_URL`, since the download URL is embedded at build time.

## MinIO + Ingest

Create a secret holding env values and then set up the MinIO bucket, upload GMT and files for download, run ingest.

```bash
# Create secret from .env
kubectl create secret generic perturbseqr-env --from-env-file=.env -n perturbseqr

# Create data bucket and apply public-read policy (denies public access to enrich/*)
kubectl create -f k8s/minio-setup-job.yaml -n perturbseqr
```

```bash
# Add rclone config for both prod (dest) and dev (source) MinIO:
#[perturbseqr]
#type = s3
#provider = Minio
#access_key_id = minio
#secret_access_key = prod MINIO_ROOT_PASSWORD from .env
#endpoint = https://s3.perturbseqr.maayanlab.cloud
#
#[perturbseqr-dev]
#type = s3
#provider = Minio
#access_key_id = minio
#secret_access_key = dev MINIO_ROOT_PASSWORD
#endpoint = https://s3.perturbseqr.k8s.maayanlab.cloud

# Sync GMTs, metadata parquets, and full-signature files from dev MinIO to prod MinIO.
# Everything is flat at data/ root. enrich/ is excluded since the ingest rebuilds it.
rclone copy --progress perturbseqr-dev:data/ perturbseqr:data/ --exclude "enrich/**"
```

`drug_lookup.json` ships inside the app image (served by Next from `public/metadata/`), so it does not need a MinIO upload.

```bash
# Run ingest
kubectl create -f k8s/ingest-incremental-job.yaml -n perturbseqr

# Logs
kubectl get jobs -n perturbseqr
kubectl logs -f job/<job-name> -n perturbseqr

# Restart app so PostGraphile picks up the new schema
kube-compose restart perturbseqr-app
```

## Updating

```bash
kube-compose version perturbseqr-app patch
docker compose build perturbseqr-app
docker compose push perturbseqr-app
kube-compose diff
kube-compose up
```

Or bump tags in `docker-compose.yaml`, rebuild, and run `kube-compose up`.

## Clean re-ingest (preserves user_gene_set)

```bash
kubectl create -f k8s/ingest-clean-job.yaml -n perturbseqr
```

## Full rebuild

`-v` deletes the postgres and minio PVCs requiring new MinIO uploads and a DB rebuild.

```bash
kube-compose down -v
kubectl delete secret perturbseqr-env -n perturbseqr
kube-compose up

kubectl create secret generic perturbseqr-env --from-env-file=.env -n perturbseqr
kubectl create -f k8s/minio-setup-job.yaml -n perturbseqr

# Re-sync data from dev MinIO (see MinIO + Ingest above)
rclone copy --progress perturbseqr-dev:data/ perturbseqr:data/ --exclude "enrich/**"

# Fresh ingest
kubectl create -f k8s/ingest-incremental-job.yaml -n perturbseqr
```

## URLs

- App: https://perturbseqr.maayanlab.cloud
- MinIO Console: https://console.s3.perturbseqr.maayanlab.cloud
- MCP: https://perturbseqr.maayanlab.cloud/mcp
