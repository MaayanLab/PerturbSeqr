#!/bin/bash
# Export data and enrich index for deployment
#
# Creates data-only dump and copies enrich index for fast deployment.
# Run this after setup_and_load_data.sh when you want to update dev server data.
#
# Output files:
#   - perturbseqr_data.dump  (data only, no schema)
#   - enrich_index.bin       (pre-built enrich index)
#   - .background_id         (UUID for enrich)
#
# Usage:
#   ./scripts/export_for_deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Container names (must match docker-compose setup)
POSTGRES_CONTAINER="perturbseqr-perturbseqr-postgres-1"
ENRICH_CONTAINER="perturbseqr-perturbseqr-enrich-1"

echo "=== Exporting for deployment ==="
echo ""

# Check containers are running
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    echo "ERROR: PostgreSQL container not running: $POSTGRES_CONTAINER"
    echo "Run ./scripts/setup_and_load_data.sh first."
    exit 1
fi

# Get current background_id from database
echo "Querying background_id from database..."
BACKGROUND_ID=$(docker exec $POSTGRES_CONTAINER psql -U postgres -t -c \
    "SELECT id FROM app_public.background ORDER BY created DESC LIMIT 1" | tr -d ' \n')

if [ -z "$BACKGROUND_ID" ]; then
    echo "ERROR: No background found in database."
    echo "Run ./scripts/setup_and_load_data.sh first."
    exit 1
fi
echo "Background ID: $BACKGROUND_ID"
echo ""

# 1. Export DATA ONLY (no schema, no permissions)
echo "=== Creating data-only dump ==="
echo "This exports all data without schema or permissions (dbmate handles those)..."
docker exec $POSTGRES_CONTAINER pg_dump -U postgres -Fc --data-only postgres > perturbseqr_data.dump
echo "Created: perturbseqr_data.dump ($(du -h perturbseqr_data.dump | cut -f1))"
echo ""

# 2. Export enrich index
echo "=== Exporting enrich index ==="
INDEX_PATH="/data/index_${BACKGROUND_ID}.bin"
echo "Copying from container: $ENRICH_CONTAINER:$INDEX_PATH"

if docker cp "$ENRICH_CONTAINER:$INDEX_PATH" ./enrich_index.bin 2>/dev/null; then
    echo "Created: enrich_index.bin ($(du -h enrich_index.bin | cut -f1))"
else
    echo "WARNING: Could not copy enrich index from container."
    echo "  The index may not exist yet, or the container may not be running."
    echo "  Deploy will work but enrich will rebuild the index (takes hours)."
fi
echo ""

# 3. Save background_id
echo "$BACKGROUND_ID" > .background_id
echo "Saved: .background_id"
echo ""

echo "=========================================="
echo "=== Export complete ==="
echo "=========================================="
echo ""
echo "Files ready for deployment:"
ls -lh perturbseqr_data.dump enrich_index.bin .background_id 2>/dev/null || true
echo ""
echo "Next step:"
echo "  ./scripts/deploy_to_dev.sh"
echo ""
