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

## MCP access

See [mcp/README.md](mcp/README.md) for setup and supported tools,
and [SKILL.md](SKILL.md) for the Perturb-Seqr agent skill.

## Citation
Perturb-Seqr: Comprehensive Signature Search Engine Integrating Connectivity Maps from Multiple Sources
John K. Gardner, Lily D. Taub, Daniel J. B. Clarke, Ido Diamant, Avi Ma'ayan
Department of Pharmacological Sciences, Mount Sinai Center for Bioinformatics, Icahn School of Medicine at Mount Sinai, New York, New York; CFDE Data Resource Center
