# Dev Server Deployment

## Manifest catalog rollout

The dev app uses the flat public library assets in `s3://perturbseqr/`. Enrichment
continues to store index backups in the existing MinIO container and volume.

For the first upgrade, build the **App** (environment `dev`), **Enrich**, and
**Ingest** images using the individual GitHub Actions workflows on the same commit.
Use the same release-candidate tag for all three (this rollout uses `0.2.55-rc.1`);
the app workflow appends `-dev`. The setup job uses `perturbseqr-ingest:0.2.55-rc.1`.

1. Back up the dev database and run the [Kubernetes setup job](libraries/README.md#kubernetes)
   in `johnkgardner` with `LIBRARY_RELEASE` empty to migrate and register the existing catalog.
2. Review `kube-compose -f docker-compose.dev.yaml diff`, then apply the app and enrichment
   upgrade. Verify the existing catalog and a search at <https://perturbseqr.k8s.maayanlab.cloud/>.
3. Run the same setup job with `LIBRARY_RELEASE=ginkgo-reframe`. Verify that reFRAME
   appears in search and on Downloads after publication.

> Select the cluster with `sshkube use -s ssh.k8s.maayanlab.cloud` (sshkube >= 0.4 manages multiple clusters).

kube-compose and kubectl require an active sshkube session. Run `eval "$(sshkube init -s ssh.k8s.maayanlab.cloud)"` before the other commands.

## Setup

```bash
cp .env.example .env
# edit .env:
#   - POSTGRES_PASSWORD: secure value
#   - MINIO_ROOT_PASSWORD: secure value
#   - S3_URL: http://minio:<MINIO_ROOT_PASSWORD>@perturbseqr-minio:9000/data
#   - PUBLIC_S3_URL: https://s3.perturbseqr.k8s.maayanlab.cloud/data

eval "$(sshkube init -s ssh.k8s.maayanlab.cloud)"
kube-compose -f docker-compose.dev.yaml up
```

If sshkube errors out, see [the cluster docs](https://docs.k8s.maayanlab.cloud/):

```bash
sshkube kill-server
eval "$(sshkube init -s ssh.k8s.maayanlab.cloud)"
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
#endpoint = https://s3.perturbseqr.k8s.maayanlab.cloud

# GMTs
rclone copy --progress data/drug_perturbation/ perturbseqr-dev:data/
rclone copy --progress data/gene_perturbation/ perturbseqr-dev:data/
rclone copy --progress data/full-signatures/ perturbseqr-dev:data/

# Metadata parquets (collated + per-dataset, all flat in data/metadata/; skips source inputs there)
rclone copy --progress data/metadata/ perturbseqr-dev:data/ --include "*_metadata.parquet"
```

`drug_lookup.json` ships inside the app image (served by Next from `public/metadata/`), so it does not need a MinIO upload.

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

- App: https://perturbseqr.k8s.maayanlab.cloud
- MinIO Console: https://console.s3.perturbseqr.k8s.maayanlab.cloud
- MCP: https://perturbseqr.k8s.maayanlab.cloud/mcp
