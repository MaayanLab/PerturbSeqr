# Adding a library

1. Upload the canonical GMT and any public Downloads files to the S3 bucket root.
2. Describe the files and library in `libraries/<slug>/manifest.json`.
3. Build the ingest image with the checked-in manifest, then run `library-setup`
   with the library slug.

The published catalog drives the grid, search filters, source links, and Downloads.
Use the [library-import skill](../.agents/skills/perturbseqr-library-import/SKILL.md)
for guidance writing a manifest. The [Ginkgo reFRAME deployment manifest](ginkgo-reframe/manifest.json)
is a working example with files already on S3.

## Manifest contract

Use the [JSON Schema](../ingest/perturbseqr_ingest/library-manifest.schema.json)
for field definitions. For a new S3-backed library, keep the deployment manifest short:

| Field | What to include |
|---|---|
| Identity | `schemaVersion: 1`, stable `slug`, `displayName`, `category` (`drug` or `gene`), `resource.key`, release `version`, and a short `description`. Related libraries share a resource key. |
| `license` | Verified `id` with optional license `url` and `attribution`, or `null` if unverified. File visibility is set separately through `distribution` and artifact status. |
| `input` | The canonical `gmt` S3 URI and its `sha256`, with `organism: "human"` and `geneIdentifiers: "symbol"`. Hash the exact uploaded bytes, including compression. |
| `artifacts` | A public artifact with `kind: "gmt"` and the same S3 URI as `input.gmt`, plus any hosted full signatures or metadata. Give each a `kind` and `s3` URI or external `url`. `label`, `format`, `bytes`, and companion file checksums are optional. |
| Optional metadata | `sources` and `publications` for public links, `presentation` for a logo or short label, and `input.compoundAnnotations` for checksum-pinned drug metadata read during import. |

`full_signatures` describes differential-expression results; `expression_counts`
describes raw counts. Omit missing files or mark them `awaiting-source`. Restricted
files can be declared with `status: "restricted"` and no public link. Keep detailed
methods and raw-input preparation in processing notes or a separate source manifest.
Include only public source links in checked-in manifests and notes.

For reFRAME, `input.compoundAnnotations` points to the same drug metadata Parquet
listed on Downloads. It maps each original label to the verified CID and aliases.
Set `input.compoundLabels: "names-and-pubchem-cids"` only when numeric labels are
known to be PubChem CIDs. One-direction sets are allowed by default; paired search
uses complete up/down pairs. Use a `presentation` logo when available; the grid
can render an initials tile without one.

### Library names and labels

| Manifest field | Where it appears | Character limit | GDPx1/GDPx2 example |
|---|---|---|---|
| `displayName` | Canonical library name used by the API; fallback for UI labels | None; no commas | `Ginkgo Bioworks` |
| `presentation.shortLabel` | Home grid caption beneath the logo | 16 | `GDPx1 + GDPx2` |
| `presentation.filterLabel` | One-line checkbox label beside the signature count | 24 | `Ginkgo GDPx1 + GDPx2` |
| `presentation.downloadTitle` | Full title on the Downloads card; wraps as needed | None | `Ginkgo Bioworks (GDPx1 + GDPx2)` |

The three presentation fields are optional and default to `displayName`. Set a
shorter grid or filter label when the canonical name is too long. Those surfaces
truncate at narrow widths; the Downloads title always displays in full.

The existing-library manifests use `registration: "existing"` to backfill
download links and catalog metadata for signatures already in the database.
Omit that flag for a new release.

## Upload first

The S3 bucket root is the flat downloads directory for **all** libraries:

```text
s3://perturbseqr/
├── cm4ai-limma-voom-de.h5ad
├── lincs-l1000-cp.gmt.gz
├── perturbseqr-drug_metadata.parquet
├── ginkgo-reframe.gmt.gz
├── ginkgo-reframe-deseq2.h5ad.zip
├── ginkgo-reframe-drug_metadata.parquet
├── …
└── enrich/                            # enrichment index backups
```

Put the canonical ingest GMT (`<slug>.gmt.gz`) and only the files we intend to
host on Downloads at the root. Use descriptive `<slug>-…` filenames and prefer
Parquet when the same metadata is available in both Parquet and CSV. Keep build
receipts, source material, processing notes, and validation reports with the local
build or the repository. Use root-level `s3://perturbseqr/<filename>` references in
the release manifest, with no per-library directories or hashes in object keys.
Checksums belong in the manifest. If an existing filename has different content,
choose a new descriptive filename for the changed file before publishing.

If the files are already on S3, proceed to the setup job. If you're starting with
raw or local source files, see [optional source preparation](#optional-source-preparation).
The same deployment manifest works for dev and production.

## Run the library setup job

The `library-setup` job uses the **same container image as `ingest`**. The image
includes the checked-in manifests and can be promoted from local testing to dev and
production with the exact same release definition. Given a library slug, the job
applies migrations, registers the existing catalog, stages the
selected library, asks enrichment to build and verify a candidate index, and publishes
the revision. It downloads only the GMT and optional compound lookup; full signatures
and other public companion files are checked with `HEAD` and registered by URL. The job
uses `DATABASE_URL` and `ENRICH_URL` from the deployment. Public S3 reads need no AWS
credentials in the setup container; index storage remains configured on enrichment.

### First upgrade of an existing database

1. Back up PostgreSQL and run `library-setup` **without a release manifest**. This applies
   pending migrations and backfills the 16 legacy manifests without rewriting existing
   signatures. It preserves signature IDs, download counters and the active background.
   Rebuild the job image if the migration changed. The migration uses a short lock timeout
   and rolls back on failure; if an existing transaction blocks it, resolve that first
   and rerun the catalog-only job.
2. Deploy the catalog-aware app and enrichment service against that database. Verify the
   legacy library counts, Downloads and a search. Keep the existing enrichment storage
   settings so the service can load its prior index.
3. Once the uploaded release is ready, select its slug from the ingest image. Subsequent
   library releases need only this release run. Run setup and legacy ingest separately.

### Docker Compose

With the intended local stack running, the catalog-only upgrade is:

```bash
docker compose -f docker-compose.yaml -f docker-compose.arm64.yaml run --rm --build --no-deps library-setup
```

The ARM64 override is for Apple Silicon; omit it on an amd64 host. After the service
upgrade, select the bundled reFRAME manifest by slug; its S3 files are already uploaded:

```bash
docker compose -f docker-compose.yaml -f docker-compose.arm64.yaml \
  run --rm --build --no-deps library-setup --release ginkgo-reframe
```

If using local MinIO for the index, add `-f docker-compose.local-index.yaml`
to the Compose commands for both enrichment and setup.

### Kubernetes

Set `NAMESPACE` to the target namespace and export `LIBRARY_SETUP_IMAGE` with the
published ingest image tag or digest containing the release manifest. The job uses the
existing `perturbseqr-env` secret in that namespace. Set `LIBRARY_RELEASE` to the
bundled slug, or leave it empty for the catalog-only upgrade:

```bash
LIBRARY_RELEASE=ginkgo-reframe envsubst '${LIBRARY_SETUP_IMAGE} ${LIBRARY_RELEASE}' \
  < k8s/library-setup-job.yaml | kubectl -n "$NAMESPACE" create -f -
```

Follow the logs for the generated Job name. The job selects the bundled manifest
by slug and logs each publication. Rerunning an active release skips its index
and publication. A failed candidate stays unpublished, so the same job can be rerun
after resolving the error. Keep previous index objects for rollback.

## Optional source preparation

For raw inputs, use a separate `source-manifest.json` with the local paths and
preparation recipe. Relative paths resolve from that manifest's directory. Follow
the [import skill](../.agents/skills/perturbseqr-library-import/SKILL.md) for canonical
GMT fields, and the [reFRAME processing notes](ginkgo-reframe/processing-notes.md#rebuilding-from-source)
for a reproducible example. Use `build --offline` for structural metadata and supplied
compound mappings; an online build can add reference annotations. The build writes a
local `resolved.json` receipt. When the files are approved for public redistribution,
you can upload that bundle with:

```bash
uv run --project etl perturbseqr-library upload --bundle /path/to/resolved.json --bucket perturbseqr
```

The upload helper generates a local `s3-manifest.json` with object locations and
checksums. Review it and save the deployment fields in `libraries/<slug>/manifest.json`
before running the setup job. Keep the source recipe and full build receipt locally
or in the repository. Use your normal local AWS credential configuration for uploads.

## Verification

```bash
uv run --project etl python -m unittest discover -s ingest/tests -v
```

Database integration tests require `LIBRARY_TEST_DATABASE_URL` pointing to a dedicated
empty database whose name ends in `_test`. They apply migrations and exercise legacy
backfill, guest visibility, alias search, and publication conflict detection.
No production connection is needed for local validation/build.

To include the real S3/enrichment lifecycle test, also set `LIBRARY_TEST_S3_ENDPOINT`
and `LIBRARY_TEST_ENRICH_URL` to disposable localhost services. That test uses bucket
`library-workflow-test` and local credentials `library-tests` / `library-tests-password`,
and exercises replacement, signed-object contents, retry idempotency and rollback.

Frontend regression checks:

```bash
npm run test:libraries
npx tsc --noEmit --incremental false
npm run lint
```
