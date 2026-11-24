# Production deployment

Run from the repo root on `main`, with the production Kubernetes context and `.env`
([example](.env.example)). Use the existing Compose project name.

## Update services

1. Build the app and enrichment images with the tag pinned in `docker-compose.yaml`:

   ```bash
   TAG='<image-tag>'
   gh workflow run build-app.yml --ref main -f tag="$TAG" -f environment=prod
   gh workflow run build-enrich.yml --ref main -f tag="$TAG"
   ```

2. Once the builds pass, check the diff, then deploy:

   ```bash
   kube-compose -f docker-compose.yaml diff
   kube-compose -f docker-compose.yaml up
   ```

## Publish a library

The [library's S3 files and manifest](libraries/README.md) must be ready, and the
catalog must already be initialized.

1. Build the ingest image from `main` with the bundled manifest:

   ```bash
   TAG='<image-tag>'
   SLUG='<library-slug>'
   gh workflow run build-ingest.yml --ref main -f tag="$TAG"
   ```

2. Once the build passes, run the setup job:

   ```bash
   LIBRARY_SETUP_IMAGE="johnkgardner/perturbseqr-ingest:$TAG" LIBRARY_RELEASE="$SLUG" \
     envsubst '${LIBRARY_SETUP_IMAGE} ${LIBRARY_RELEASE}' < k8s/library-setup-job.yaml |
     kubectl -n perturbseqr create -f -
   ```

3. Follow the job logs and verify the library in the [production app](https://perturbseqr.maayanlab.cloud/):

   ```bash
   kubectl -n perturbseqr logs -f 'job/<job-name>'
   ```
