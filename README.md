# PerturbSeqr

## Quick Start

```bash
# 1. Set up environment
cp .env.example .env

# 2. Start services and load data
./scripts/setup_and_load_data.sh
```

App available at http://localhost:3000

## Development Mode

```bash
docker compose up -d perturbseek-postgres perturbseek-enrich
dbmate up
npm install
npm run dev
```
