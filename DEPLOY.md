# Prod Server Deployment

## Setup

```bash
cp .env.example .env
# edit .env:
#   - POSTGRES_PASSWORD: secure value
#   - MINIO_ROOT_PASSWORD: secure value
#   - S3_URL: http://minio:<MINIO_ROOT_PASSWORD>@perturbseqr-minio:9000/data
#   - PUBLIC_S3_URL: https://s3.perturbseqr.maayanlab.cloud/data

# Build and push images via GitHub Actions "Build All Images" workflow
kube-compose up
```

## MinIO + Ingest

After `kube-compose up`, create the secret holding env values, set up the MinIO bucket, upload GMT files, then run ingest.

```bash
# Create secret from .env (consumed by k8s Job manifests below)
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

# upload .gmt.gz files to data bucket
rclone copyto --progress gmts perturbseqr:data/
```

```bash
# Run ingest (incremental — skips existing gene sets by hash)
kubectl create -f k8s/ingest-incremental-job.yaml -n perturbseqr

# Watch progress (Job names use generateName: ingest-incremental-<random>)
kubectl get jobs -n perturbseqr
kubectl logs -f job/<job-name> -n perturbseqr

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
kubectl create -f k8s/ingest-clean-job.yaml -n perturbseqr
```

## Full rebuild

`-v` deletes the postgres and minio PVCs, so this requires new MinIO uploads and a fresh DB rebuild.

```bash
kube-compose down -v
kubectl delete secret perturbseqr-env -n perturbseqr
kube-compose up
```

Then redo MinIO + Ingest steps above.

## URLs

- App: https://perturbseqr.maayanlab.cloud
- MinIO Console: https://console.s3.perturbseqr.maayanlab.cloud
