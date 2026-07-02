# Prod Server Deployment

## Setup

```bash
cp .env.example .env
# edit .env:
#   - POSTGRES_PASSWORD: secure value
#   - MINIO_ROOT_PASSWORD: secure value
#   - S3_URL: http://minio:<MINIO_ROOT_PASSWORD>@perturbseqr-minio:9000/data
#   - PUBLIC_S3_URL: https://s3.perturbseqr.maayanlab.cloud/data

kube-compose up
```

## MinIO + Ingest

Create a secret holding env values and then set up the MinIO bucket, upload GMT and files for download, run ingest.

```bash
# Create secret from .env
kubectl create secret generic perturbseqr-env --from-env-file=.env -n perturbseqr

# Create data bucket and apply public-read policy (denies public access to enrich/*)
kubectl create -f k8s/minio-setup-job.yaml -n perturbseqr
```

```bash
# Add rclone config
#[perturbseqr]
#type = s3
#provider = Minio
#access_key_id = minio
#secret_access_key = MINIO_ROOT_PASSWORD from .env
#endpoint = https://s3.perturbseqr.maayanlab.cloud

# GMTs
rclone copy --progress data/drug_perturbation/ perturbseqr:data/
rclone copy --progress data/gene_perturbation/ perturbseqr:data/
rclone copy --progress data/full-signatures/ perturbseqr:data/

# Metadata parquets (collated + per-dataset, all flat in data/metadata/; skips source inputs there)
rclone copy --progress data/metadata/ perturbseqr:data/ --include "*_metadata.parquet"
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

# Re-upload GMT files

# Fresh ingest
kubectl create -f k8s/ingest-incremental-job.yaml -n perturbseqr
```

## URLs

- App: https://perturbseqr.maayanlab.cloud
- MinIO Console: https://console.s3.perturbseqr.maayanlab.cloud
