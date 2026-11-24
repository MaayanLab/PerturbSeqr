# Production deployment

Run from the repo root on `main`, with the production Kubernetes context and `.env`
([example](.env.example)). Keep the existing Compose project name and AWS S3 index
settings. Library setup jobs use the existing `perturbseqr-env` secret.

## Update services

1. Build the app and enrichment images with the tag pinned in `docker-compose.yaml`:

   ```bash
   TAG='<image-tag>'
   gh workflow run build-app.yml --ref main -f tag="$TAG" -f environment=prod
   gh workflow run build-enrich.yml --ref main -f tag="$TAG"
   ```

2. **First catalog upgrade only:** Run the catalog job after its ingest image is
   published. Wait for it to succeed before deploying the services.

   ```bash
   kubectl -n perturbseqr create -f k8s/perturbseqr-0.2.55-catalog.yaml
   ```

3. Once the service builds pass, check the diff, then deploy:

   ```bash
   kube-compose -f docker-compose.yaml diff
   kube-compose -f docker-compose.yaml up
   ```

4. Wait for the rollout and run an enrichment search against an existing library.

## Publish a library

The [library's S3 files and manifest](libraries/README.md) must be ready, and the
catalog must already be initialized.

If the release ships a ready-to-run Job and its ingest image is published, run
`kubectl -n perturbseqr create -f "$JOB_FILE"` with `JOB_FILE` set to the release's
Job YAML, then follow its logs (step 3).

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

3. Follow the job logs. Once it succeeds, verify the library in the [production app](https://perturbseqr.maayanlab.cloud/):

   ```bash
   kubectl -n perturbseqr logs -f 'job/<job-name>'
   ```
