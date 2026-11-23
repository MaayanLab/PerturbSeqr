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

Library download URLs are registered from the library manifests. The existing production objects are under the AWS S3 bucket root, with no `/data` suffix.

## Storage and ingest

Production GMTs, metadata parquets, full-signature downloads, and enrichment indexes use the AWS bucket `perturbseqr`, in `us-east-1`. Upload data changes there before running ingest.

For the first manifest-catalog upgrade and for new library releases, use the
[library setup job](libraries/README.md#run-the-library-setup-job). The catalog-only
run prepares the existing database before the app and enrichment services are upgraded.
Subsequent releases use one job with a release slug and the ingest image that
contains its manifest.

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

The bucket root is the flat downloads directory for every library. For example,
`cm4ai-limma-voom-de.h5ad`, `lincs-l1000-cp.gmt.gz`, and `ginkgo-reframe.gmt.gz`
are all root-level object keys, with manifest references such as
`s3://perturbseqr/ginkgo-reframe.gmt.gz`. Store only the ingest GMTs and files
served on Downloads there. Keep enrichment backups under `enrich/` and retain
manifests, provenance, and build reports outside S3. See the
[release layout](libraries/README.md#upload-first) for naming conventions.

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
