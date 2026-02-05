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

# Step 1: Upload GMT files to MinIO
echo "=== Step 1: Uploading GMT files to MinIO ==="
python /app/scripts/upload_gmts_to_minio.py
echo ""

# Step 2: Ingest data from MinIO to Postgres
echo "=== Step 2: Ingesting gene sets from MinIO ==="
cd /app/db && python ingest.py --batch --minio
echo ""

# Step 3: Ingest FDA counts
echo "=== Step 3: Ingesting FDA counts ==="
cd /app/db && python ingest_fda_counts.py
cd /app/db && python ingest_fda_counts.py --update-counts
echo ""

# Step 4: Refresh materialized views
echo "=== Step 4: Refreshing materialized views ==="
psql "$DATABASE_URL" -c "REFRESH MATERIALIZED VIEW app_public.gene_set_fda_counts;"
psql "$DATABASE_URL" -c "REFRESH MATERIALIZED VIEW app_private.pmc_stats;"
psql "$DATABASE_URL" -c "ANALYZE;"
echo ""

# Step 5: Create background and trigger enrich
echo "=== Step 5: Creating background and triggering enrich index ==="
cd /app/db && python update_background.py
echo ""

# Step 6: Ingest gene info from NCBI
echo "=== Step 6: Ingesting gene info from NCBI ==="
cd /app/db && python ingest_gene_info.py
echo ""

echo "=== Ingest Complete ==="
echo "Finished at: $(date)"
