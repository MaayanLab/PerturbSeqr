# Perturb-Seqr

A comprehensive perturbation-signature search engine integrating connectivity maps from L1000, Tahoe-100M, NIBR DRUG-seq, CMap, Ginkgo Bioworks, SciPlex, DeepCover MoA, Perturb Atlas, Replogle Perturb-seq, CREEDS, and RummaGEO.

## Deployments

- **Production:** https://perturbseqr.maayanlab.cloud
- **Dev:** https://perturbseqr.k8s.dev.maayanlab.cloud
- **GraphQL API:** https://perturbseqr.maayanlab.cloud/graphiql

## Local Quick Start

Runs the stack via Docker Compose, using AWS S3 for ingest, downloads, and enrichment indexes. The dev cluster retains MinIO; see [DEV_DEPLOY.md](DEV_DEPLOY.md).

```bash
cp .env.example .env
# Edit .env: supply AWS credentials and set ENRICH_S3_PREFIX to a unique
# enrich/local-<identifier>/ prefix for this database (never enrich/production/).
docker compose build perturbseqr-enrich ingest
docker compose up -d
# Read GMTs already stored at the root of the AWS perturbseqr bucket
COMPOSE_PROFILES=jobs docker compose run --rm ingest
```

- App: http://localhost:3000
- GraphiQL: http://localhost:3000/graphiql

### Use the existing local index store

If your local database already uses MinIO for enrichment backups, use
[`docker-compose.local-index.yaml`](docker-compose.local-index.yaml). It pins
`johnkgardner/perturbseqr-minio:RELEASE.2025-09-07T16-13-09Z` and reuses the Compose
project's `minio-data` volume and existing `data` bucket. Set `MINIO_ROOT_PASSWORD`
to the existing store's password and use the same project name as the running database.
On Apple Silicon, run:

```bash
docker compose -f docker-compose.yaml -f docker-compose.arm64.yaml \
  -f docker-compose.local-index.yaml up -d --wait perturbseqr-minio
```

Use the same Compose files when rebuilding `perturbseqr-enrich`. MinIO is reachable
only within the Compose network and is wired only to enrichment. `library-setup`
reads the manifest's GMT and metadata from AWS S3, and Downloads uses the public S3 URLs.

## Frontend Development

Run only the backend services in docker; run the Next.js app with hot reload:

```bash
cp .env.example .env
# Supply AWS credentials and a unique local ENRICH_S3_PREFIX as above
docker compose build perturbseqr-enrich
docker compose up -d perturbseqr-postgres perturbseqr-enrich
npm install && npm run dev
```

## Reset

Wipe local PostgreSQL volumes and rebuild from the existing AWS GMTs. This leaves AWS objects intact:

```bash
docker compose down -v
docker compose up -d
COMPOSE_PROFILES=jobs docker compose run --rm ingest
```

## Deploy

See [DEV_DEPLOY.md](DEV_DEPLOY.md) for the dev Kubernetes cluster deployment workflow.

## Add a library

Upload the canonical GMT and hosted downloads to the root of `s3://perturbseqr/`, build the ingest image with `libraries/<slug>/manifest.json`, then select the slug in the containerized `library-setup` job. See the [reFRAME manifest](libraries/ginkgo-reframe/manifest.json) for a working example, the [library setup guide](libraries/README.md) for commands, and the [import skill](.agents/skills/perturbseqr-library-import/SKILL.md) for help authoring a manifest. Keep source preparation separate. The `enrich/` prefix holds index backups.

## MCP access

See [mcp/README.md](mcp/README.md) for setup and supported tools,
and [SKILL.md](SKILL.md) for the Perturb-Seqr agent skill.

## Citation

**Perturb-Seqr: Comprehensive Signature Search Engine Integrating Connectivity Maps from Multiple Sources**

Lily D. Taub<sup>1</sup>, John K. Gardner<sup>1</sup>, Ido Diamant<sup>1</sup>, Daniel J. B. Clarke<sup>1</sup>, Avi Ma'ayan<sup>1</sup>

<sup>1</sup>Department of Pharmacological Sciences, Mount Sinai Center for Bioinformatics, Icahn School of Medicine at Mount Sinai, New York, New York; CFDE Data Resource Center

bioRxiv (2026). [doi:10.64898/2026.10.06.757137](https://doi.org/10.64898/2026.10.06.757137)
