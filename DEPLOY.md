# Prod Server Deployment

## Setup

```bash
cp .env.example .env
# edit .env:
#   - POSTGRES_PASSWORD: secure value
#   - PUBLIC_S3_URL: https://perturbseqr.s3.amazonaws.com
#   - INGEST_S3_ENDPOINT: https://s3.us-east-1.amazonaws.com
#   - INGEST_S3_BUCKET: perturbseqr
#   - ENRICH_S3_ENDPOINT: https://s3.us-east-1.amazonaws.com
#   - ENRICH_S3_BUCKET: perturbseqr
#   - ENRICH_S3_PREFIX: enrich/production/
#   - AWS_REGION: (default: us-east-1)
#   - AWS_ACCESS_KEY_ID: supplied privately
#   - AWS_SECRET_ACCESS_KEY: supplied privately
#   - AWS_SESSION_TOKEN: temporary credentials only. Leave unset otherwise.

kube-compose up
```

Production downloads use the AWS S3 bucket root, with no `/data` suffix. Rebuild the app image when changing `PUBLIC_S3_URL`, since the download URL is embedded at build time.

## Storage and ingest

Production GMTs, metadata parquets, full-signature downloads, and enrichment indexes use the AWS bucket `perturbseqr`, in `us-east-1`. Upload data changes there before running ingest.

### Container configuration

```bash
# Create or update the ingest Job secret from .env
kubectl create secret generic perturbseqr-env --from-env-file=.env -n perturbseqr --dry-run=client -o yaml | kubectl apply -f -
```

### Configure rclone for production AWS S3

Add this remote to your local rclone configuration:

```ini
[perturbseqr]
type = s3
provider = AWS
env_auth = true
region = us-east-1
```

Export `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (plus `AWS_SESSION_TOKEN` for temporary credentials); rclone does not load `.env`.

Files are stored at the bucket root. For example, `cm4ai.gmt.gz` is public at `https://perturbseqr.s3.amazonaws.com/cm4ai.gmt.gz`.

### Upload updates before ingest

```bash
# GMTs
rclone copy --progress data/drug_perturbation/ perturbseqr:perturbseqr/
rclone copy --progress data/gene_perturbation/ perturbseqr:perturbseqr/

# Full-signature downloads
rclone copy --progress data/full-signatures/ perturbseqr:perturbseqr/

# Metadata parquets; omit other metadata-source inputs
rclone copy --progress data/metadata/ perturbseqr:perturbseqr/ --include "*_metadata.parquet"

# Inspect uploaded object names
rclone lsf perturbseqr:perturbseqr/ --max-depth 1
```

Ingest reads the supported GMT objects from the bucket root.

### Run ingest

```bash
# Run ingest
kubectl create -f k8s/ingest-incremental-job.yaml -n perturbseqr

# Logs
kubectl get jobs -n perturbseqr
kubectl logs -f job/<job-name> -n perturbseqr

# Restart app so PostGraphile picks up the new schema
kube-compose restart perturbseqr-app
```

## Updating the app

```bash
kube-compose version perturbseqr-app patch
docker compose build perturbseqr-app
docker compose push perturbseqr-app
kube-compose diff
kube-compose up
```

Or bump tags in `docker-compose.yaml`, build and push the images, and run `kube-compose up`.

## Clean re-ingest (preserves user_gene_set)

```bash
kubectl create -f k8s/ingest-clean-job.yaml -n perturbseqr
```

## Full rebuild

Deletes the PostgreSQL PVCs.

```bash
kube-compose down -v
kubectl delete secret perturbseqr-env -n perturbseqr
kube-compose up

kubectl create secret generic perturbseqr-env --from-env-file=.env -n perturbseqr

# Fresh ingest from AWS, once the updated ingest image/environment are configured
kubectl create -f k8s/ingest-incremental-job.yaml -n perturbseqr
```

## URLs

- App: https://perturbseqr.maayanlab.cloud
- AWS downloads: https://perturbseqr.s3.amazonaws.com/
- MCP: https://perturbseqr.maayanlab.cloud/mcp
