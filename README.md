# Perturb-Seqr

## Quick Start

```bash
cp .env.example .env
# Build all images including one-off job containers
COMPOSE_PROFILES=jobs docker compose build
docker compose up -d
COMPOSE_PROFILES=jobs docker compose run --rm minio-setup
# Upload .gmt.gz files to MinIO console at http://localhost:9001 (login: minio / password from .env)
COMPOSE_PROFILES=jobs docker compose run --rm ingest
```

App: http://localhost:3000

## Development

```bash
cp .env.example .env
docker compose up -d perturbseqr-postgres perturbseqr-minio perturbseqr-enrich
npm install && npm run dev
```

## Reset

```bash
docker compose down -v
docker compose up -d
COMPOSE_PROFILES=jobs docker compose run --rm minio-setup
# Re-upload GMT files to MinIO
COMPOSE_PROFILES=jobs docker compose run --rm ingest
```

## Deploy

See [DEV_DEPLOY.md](DEV_DEPLOY.md) for deploying to the dev Kubernetes cluster.
