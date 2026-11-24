# Dev deployment

Run from the repo root with the dev `.env` and the existing Compose project name.
Dev stores enrichment indexes in MinIO; library files come from AWS S3.

```bash
eval "$(sshkube init -s ssh.k8s.maayanlab.cloud)"
```

## Update services

1. Build the app and enrichment images from the branch being tested, using the
   tags pinned in `docker-compose.dev.yaml`. The app workflow adds `-dev`:

   ```bash
   REF='<branch>'
   APP_TAG='<app-tag-without-dev-suffix>'
   ENRICH_TAG='<enrich-tag>'
   gh workflow run build-app.yml --ref "$REF" -f tag="$APP_TAG" -f environment=dev
   gh workflow run build-enrich.yml --ref "$REF" -f tag="$ENRICH_TAG"
   ```

2. Once the builds pass, check the diff, then deploy:

   ```bash
   kube-compose -f docker-compose.dev.yaml diff
   kube-compose -f docker-compose.dev.yaml up
   ```

## Publish a library

The [library's S3 files and manifest](libraries/README.md) must be ready, and the
dev catalog must already be initialized.

1. Build the ingest image from the branch containing the manifest:

   ```bash
   REF='<branch>'
   TAG='<ingest-image-tag>'
   SLUG='<library-slug>'
   gh workflow run build-ingest.yml --ref "$REF" -f tag="$TAG"
   ```

2. Once the build passes, run the setup job:

   ```bash
   LIBRARY_SETUP_IMAGE="johnkgardner/perturbseqr-ingest:$TAG" LIBRARY_RELEASE="$SLUG" \
     envsubst '${LIBRARY_SETUP_IMAGE} ${LIBRARY_RELEASE}' < k8s/library-setup-job.yaml |
     kubectl -n johnkgardner create -f -
   ```

3. Follow the job logs and verify the library in the [dev app](https://perturbseqr.k8s.maayanlab.cloud/):

   ```bash
   kubectl -n johnkgardner logs -f 'job/<job-name>'
   ```
