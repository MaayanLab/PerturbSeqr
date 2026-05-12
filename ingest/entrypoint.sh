#!/bin/bash
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

# Step 1: Ingest data from MinIO to Postgres (GMT files must already be uploaded)
echo "=== Step 1: Ingesting gene sets from MinIO ==="
cd /app/db && python ingest.py --batch --minio
echo ""

# Step 2: Ingest FDA counts
echo "=== Step 2: Ingesting FDA counts ==="
cd /app/db && python ingest_fda_counts.py
echo ""

# Step 3: Refresh materialized views
echo "=== Step 3: Refreshing materialized views ==="
psql "$DATABASE_URL" -c "REFRESH MATERIALIZED VIEW app_public.gene_set_fda_counts;"
psql "$DATABASE_URL" -c "REFRESH MATERIALIZED VIEW app_private.pmc_stats;"
psql "$DATABASE_URL" -c "ANALYZE;"
echo ""

# Step 4: Create background and trigger enrich
echo "=== Step 4: Creating background and triggering enrich index ==="
cd /app/db && python update_background.py
echo ""

# Step 5: Ingest gene info from NCBI
echo "=== Step 5: Ingesting gene info from NCBI ==="
cd /app/db && python ingest_gene_info.py
echo ""

echo "=== Ingest Complete ==="
echo "Finished at: $(date)"
