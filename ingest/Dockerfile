# Ingest container for PerturbSeek
#
# The ingest service uses the default entrypoint. The library-setup service uses
# the same image with `python -m perturbseqr_ingest.library_setup` as entrypoint.

FROM python:3.14-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

ARG DBMATE_VERSION=2.29.3
RUN curl -fsSL -o /usr/local/bin/dbmate \
      "https://github.com/amacneil/dbmate/releases/download/v${DBMATE_VERSION}/dbmate-linux-$(dpkg --print-architecture)" \
    && chmod +x /usr/local/bin/dbmate

# Install the lean ingest runtime package (deps + the perturbseqr_ingest package)
COPY ingest/pyproject.toml ./ingest_src/pyproject.toml
COPY ingest/perturbseqr_ingest ./ingest_src/perturbseqr_ingest
RUN pip install --no-cache-dir ./ingest_src

COPY libraries ./libraries
COPY public/metadata/drug_lookup.json ./metadata/drug_lookup.json

# Copy migrations for dbmate
COPY db/migrations ./migrations/

# Copy wipe_libraries.sql (used when INGEST_CLEAN=true)
COPY db/sql/wipe_libraries.sql ./sql/wipe_libraries.sql

ENV INGEST_MANIFEST_DIR=/app/libraries
ENV INGEST_METADATA_DIR=/app/metadata
ENV INGEST_DATA_DIR=/app/data

# Copy entrypoints
COPY ingest/entrypoint.sh ./entrypoint.sh
COPY ingest/ingest-entrypoint.sh ./ingest-entrypoint.sh
RUN chmod +x entrypoint.sh ingest-entrypoint.sh

# Default entrypoint runs migrations + ingest
ENTRYPOINT ["./ingest-entrypoint.sh"]
