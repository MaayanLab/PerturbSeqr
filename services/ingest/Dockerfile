# Ingest container for PerturbSeek
#
# This container handles two jobs:
#   1. upload-gmts: Upload GMT files from mounted volume to MinIO
#   2. ingest: Run migrations and ingest data from MinIO to Postgres
#
# Usage:
#   docker compose run upload-gmts   # Upload GMT files to MinIO
#   docker compose run ingest        # Run migrations + ingest data
#
# For k8s with bundled GMT files:
#   ./scripts/build_ingest_image.sh 0.0.1 --push

FROM python:3.14-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN set -x \
    && echo "Installing dbmate..." \
    && curl -fsSL -o /usr/local/bin/dbmate https://github.com/amacneil/dbmate/releases/latest/download/dbmate-linux-amd64 \
    && chmod +x /usr/local/bin/dbmate

COPY services/ingest/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy ingest scripts (GMT data comes from MinIO or mounted volume)
COPY services/db/ingest.py services/db/ingest_fda_counts.py services/db/ingest_gene_info.py services/db/update_background.py ./db/
COPY services/db/db_utils.py services/db/gmt_parser.py services/db/perturbation_parser.py ./db/
COPY src/config/libraries.json ./config/libraries.json
COPY public/metadata/drug_lookup.json ./metadata/drug_lookup.json

# Copy migrations for dbmate
COPY services/db/migrations ./migrations/

# Copy wipe_libraries.sql (used when INGEST_CLEAN=true)
COPY services/db/sql/wipe_libraries.sql ./sql/wipe_libraries.sql

ENV INGEST_CONFIG_DIR=/app/config
ENV INGEST_METADATA_DIR=/app/metadata
ENV INGEST_DATA_DIR=/app/data

# Copy entrypoints
COPY services/ingest/entrypoint.sh ./entrypoint.sh
COPY services/ingest/ingest-entrypoint.sh ./ingest-entrypoint.sh
RUN chmod +x entrypoint.sh ingest-entrypoint.sh

# Default entrypoint runs migrations + ingest
ENTRYPOINT ["./ingest-entrypoint.sh"]
