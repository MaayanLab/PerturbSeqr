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

COPY ingest/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy ingest scripts (GMT data comes from MinIO or mounted volume)
COPY db/ingest.py db/ingest_fda_counts.py db/ingest_gene_info.py db/update_background.py ./db/
COPY db/db_utils.py db/gmt_parser.py db/perturbation_parser.py ./db/
COPY scripts/upload_gmts_to_minio.py ./scripts/
COPY src/config/libraries.json ./config/libraries.json
COPY public/metadata/drug_lookup.json ./metadata/drug_lookup.json

# Copy migrations for dbmate
COPY db/migrations ./migrations/

ENV INGEST_CONFIG_DIR=/app/config
ENV INGEST_METADATA_DIR=/app/metadata
ENV INGEST_DATA_DIR=/app/data

# Copy entrypoints
COPY ingest/entrypoint.sh ./entrypoint.sh
COPY ingest/ingest-entrypoint.sh ./ingest-entrypoint.sh
RUN chmod +x entrypoint.sh ingest-entrypoint.sh

# Default entrypoint runs migrations + ingest
ENTRYPOINT ["./ingest-entrypoint.sh"]
