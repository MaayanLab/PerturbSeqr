# Perturb-Seqr

A comprehensive perturbation-signature search engine integrating connectivity maps from L1000, Tahoe-100M, NIBR DRUG-seq, CMap, Ginkgo Bioworks, SciPlex, DeepCover MoA, Perturb Atlas, Replogle Perturb-seq, CREEDS, and RummaGEO.

## Deployments

- **Production:** https://perturbseqr.maayanlab.cloud
- **Dev:** https://perturbseqr.k8s.dev.maayanlab.cloud
- **GraphQL API:** https://perturbseqr.maayanlab.cloud/graphiql

## Local Quick Start

Runs the full stack (postgres, MinIO, enrich, app) via docker compose.

```bash
cp .env.example .env
# Build all images including the one-off job containers (minio-setup, ingest)
COMPOSE_PROFILES=jobs docker compose build
docker compose up -d
# Create the MinIO bucket and apply the access policy
COMPOSE_PROFILES=jobs docker compose run --rm minio-setup
# Upload .gmt.gz files via the MinIO console at http://localhost:9001
#   login: minio / password from .env
# Then ingest the gene sets into Postgres
COMPOSE_PROFILES=jobs docker compose run --rm ingest
```

- App: http://localhost:3000
- MinIO console: http://localhost:9001
- GraphiQL: http://localhost:3000/graphiql

## Frontend Development

Run only the backend services in docker; run the Next.js app with hot reload:

```bash
cp .env.example .env
docker compose up -d perturbseqr-postgres perturbseqr-minio perturbseqr-enrich
npm install && npm run dev
```

## Reset

Wipe local postgres + MinIO volumes and rebuild from scratch:

```bash
docker compose down -v
docker compose up -d
COMPOSE_PROFILES=jobs docker compose run --rm minio-setup
# Re-upload GMT files via MinIO console
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
