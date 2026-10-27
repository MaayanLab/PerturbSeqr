#!/bin/bash
# Ingest-only entrypoint for PerturbSeek
#
# This script runs:
#   1. Database migrations (dbmate)
#   2. Library wipe (only if INGEST_CLEAN=true; preserves user_gene_set and background)
#   3. Gene set ingest from S3 storage
#   4. FDA counts ingest
#   5. Materialized view refresh
#   6. Background creation + enrich trigger
#   7. Gene info ingest from NCBI
#
# Prerequisites:
#   - PostgreSQL running and healthy
#   - S3 storage configured with GMT files uploaded (AWS or dev MinIO)
#   - Enrich service running (for index rebuild)
#
# Usage:
#   docker compose run ingest                          # incremental (skips existing gene sets by hash)
#   docker compose run -e INGEST_CLEAN=true ingest     # local: clean re-ingest
#   INGEST_CLEAN=true kube-compose run ingest          # cluster: clean re-ingest (kube-compose has no -e flag)

set -e

echo "=== PerturbSeek Data Ingest ==="
echo "Started at: $(date)"
echo ""

# Increase file descriptor limits (avoids 'too many open files' errors)
echo "System limits:"
ulimit -a 2>/dev/null || true
echo ""

# Try to increase soft limit (may fail in containers, that's ok)
ulimit -n 65536 2>/dev/null || echo "Note: Could not increase file limit (not critical)"
echo ""

# Step 1: Run dbmate migrations
echo "=== Step 1: Running database migrations ==="
dbmate --migrations-dir /app/migrations up || echo "Migrations already applied or no new migrations"
echo ""

# Step 2: Wipe library tables if INGEST_CLEAN=true
if [ "${INGEST_CLEAN:-false}" = "true" ]; then
  echo "=== Step 2: Wiping library tables (INGEST_CLEAN=true) ==="
  psql "$DATABASE_URL" -f /app/sql/wipe_libraries.sql
  echo ""
fi

# Step 3: Ingest data from S3 storage to Postgres
echo "=== Step 3: Ingesting gene sets from S3 storage ==="
python -m perturbseqr_ingest.ingest --batch --s3
echo ""

# Step 4: Ingest FDA counts
echo "=== Step 4: Ingesting FDA counts ==="
python -m perturbseqr_ingest.ingest_fda_counts
echo ""

# Step 5: Refresh materialized views
echo "=== Step 5: Refreshing materialized views ==="
psql "$DATABASE_URL" -c "REFRESH MATERIALIZED VIEW app_public.gene_set_fda_counts;"
psql "$DATABASE_URL" -c "REFRESH MATERIALIZED VIEW app_private.pmc_stats;"
psql "$DATABASE_URL" -c "ANALYZE;"
echo ""

# Step 6: Create background and trigger enrich
echo "=== Step 6: Creating background and triggering enrich index ==="
python -m perturbseqr_ingest.update_background
echo ""

# Step 7: Ingest gene info from NCBI
echo "=== Step 7: Ingesting gene info from NCBI ==="
python -m perturbseqr_ingest.ingest_gene_info
echo ""

echo "=== Ingest Complete ==="
echo "Finished at: $(date)"
