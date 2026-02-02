#!/bin/bash
# PerturbSeqr Setup and Data Loading Script
# This script sets up PerturbSeqr and loads all signature data from individual GMT files
#
# Prerequisites:
#   - Docker and docker-compose installed
#   - dbmate installed (brew install dbmate)
#   - uv installed for Python package management
#   - GMT files in db/data/drug_perturbation/ and db/data/gene_perturbation/
#   - public/metadata/drug_lookup.json (build with: uv run db/build_drug_lookup.py)
#
# Usage:
#   ./scripts/setup_and_load_data.sh                   # Production mode (default) - Docker container frontend
#   ./scripts/setup_and_load_data.sh --dev             # Dev mode - Next.js dev server with hot reloading
#   ./scripts/setup_and_load_data.sh --rebuild         # Rebuild Docker images before starting
#   ./scripts/setup_and_load_data.sh --rebuild --dev   # Rebuild and run in dev mode
#   ./scripts/setup_and_load_data.sh --clean           # Clean rebuild: prune build cache, remove volumes, rebuild images

set -e  # Exit on error

# Parse arguments
DEV_MODE=false
REBUILD=false
CLEAN=false
for arg in "$@"; do
    case $arg in
        --dev)
            DEV_MODE=true
            shift
            ;;
        --rebuild)
            REBUILD=true
            shift
            ;;
        --clean)
            CLEAN=true
            REBUILD=true  # --clean implies --rebuild
            shift
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Container names (docker compose uses: {project}-{service}-{instance})
# Project name comes from COMPOSE_PROJECT_NAME in .env (perturbseek)
POSTGRES_CONTAINER="perturbseek-perturbseek-postgres-1"
ENRICH_CONTAINER="perturbseek-perturbseek-enrich-1"

# Database connection
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
export DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"

# Timing helper
SCRIPT_START=$(date +%s)
step_time() {
    local step_start=$1
    local step_end=$(date +%s)
    echo "  ⏱️  Step took $((step_end - step_start)) seconds"
}

echo "=== PerturbSeqr Setup Script ==="
echo "Working directory: $PROJECT_DIR"
echo "Start time: $(date)"
if [ "$DEV_MODE" = true ]; then
    echo "Mode: Development (Next.js dev server with hot reloading)"
else
    echo "Mode: Production (Docker container frontend)"
fi
if [ "$CLEAN" = true ]; then
    echo "Clean mode: Enabled (will prune build cache)"
fi
echo ""

# ------------------------------------------------------------------------------
# Step 1: Check prerequisites
# ------------------------------------------------------------------------------
STEP_START=$(date +%s)
echo "=== Step 1: Checking prerequisites ==="

if ! command -v docker &> /dev/null; then
    echo "ERROR: docker is not installed"
    exit 1
fi

if ! command -v dbmate &> /dev/null; then
    echo "ERROR: dbmate is not installed. Install with: brew install dbmate"
    exit 1
fi

if ! command -v uv &> /dev/null; then
    echo "ERROR: uv is not installed. Install from: https://github.com/astral-sh/uv"
    exit 1
fi

# Check for drug_lookup.json (required for FDA counts)
DRUG_LOOKUP="$PROJECT_DIR/public/metadata/drug_lookup.json"
if [ ! -f "$DRUG_LOOKUP" ]; then
    echo "ERROR: $DRUG_LOOKUP not found"
    echo "  Build it with: uv run db/build_drug_lookup.py"
    exit 1
fi

echo "All prerequisites found."
step_time $STEP_START
echo ""

# ------------------------------------------------------------------------------
# Step 2: Regenerate GraphQL types (if rebuilding)
# The Next.js app requires pre-generated types matching the current schema.
# This step starts postgres temporarily, runs migrations, generates types, then stops.
# ------------------------------------------------------------------------------
if [ "$REBUILD" = true ]; then
    STEP_START=$(date +%s)
    echo "=== Step 2: Regenerating GraphQL types ==="

    # Ensure fresh database for type generation (schema may have changed)
    docker compose down -v 2>/dev/null || true

    # Start postgres temporarily for type generation
    docker compose up -d perturbseek-postgres
    echo "Waiting for PostgreSQL..."
    WAIT_COUNT=0
    until docker exec $POSTGRES_CONTAINER pg_isready -U postgres &> /dev/null; do
        WAIT_COUNT=$((WAIT_COUNT + 1))
        if [ $WAIT_COUNT -ge 30 ]; then
            echo "ERROR: PostgreSQL failed to start"
            exit 1
        fi
        sleep 1
    done
    sleep 3

    # Run migrations
    echo "Running migrations..."
    DATABASE_URL="$DATABASE_URL" dbmate up

    # Start dev server in background, generate types, then kill it
    echo "Generating GraphQL types..."
    npm run dev &
    DEV_PID=$!
    sleep 15

    if npm run generate; then
        echo "Types generated successfully"
    else
        echo "ERROR: Failed to generate GraphQL types"
        kill $DEV_PID 2>/dev/null
        exit 1
    fi
    kill $DEV_PID 2>/dev/null
    sleep 2

    # Verify types were generated correctly (contains cid field)
    if ! grep -q "cid.*Maybe.*String" src/graphql/index.ts; then
        echo "ERROR: Generated types missing 'cid' field. Schema may be out of date."
        exit 1
    fi
    echo "Types verified."

    # Touch the file to update mtime and sync to disk
    touch src/graphql/index.ts
    sync
    sleep 1

    step_time $STEP_START
    echo ""
fi

# ------------------------------------------------------------------------------
# Step 3: Rebuild Docker images (if requested)
# ------------------------------------------------------------------------------
if [ "$REBUILD" = true ]; then
    STEP_START=$(date +%s)
    echo "=== Step 3: Rebuilding Docker images ==="
    if [ "$CLEAN" = true ]; then
        echo "Pruning Docker build cache (--clean mode)..."
        docker builder prune -af
        # Reset buildx builder to clear context cache
        docker buildx rm default 2>/dev/null || true
        docker buildx create --use --name default 2>/dev/null || true
    fi
    docker compose down -v
    DOCKER_BUILDKIT=1 docker compose build --no-cache --pull
    step_time $STEP_START
    echo ""
fi

# ------------------------------------------------------------------------------
# Step 4: Start PostgreSQL container first
# ------------------------------------------------------------------------------
STEP_START=$(date +%s)
echo "=== Step 4: Starting PostgreSQL container ==="
docker compose up -d perturbseek-postgres

echo "Waiting for PostgreSQL to be ready..."

# Wait for postgres to accept connections (with timeout)
WAIT_COUNT=0
MAX_WAIT=60
until docker exec $POSTGRES_CONTAINER pg_isready -U postgres &> /dev/null; do
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        echo "ERROR: PostgreSQL failed to start after ${MAX_WAIT} seconds"
        exit 1
    fi
    echo "  Waiting for postgres... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 1
done
echo "PostgreSQL is accepting connections, waiting for init scripts to complete..."
sleep 5  # Extra delay to ensure postgres init scripts are fully complete
echo "PostgreSQL is ready."
step_time $STEP_START
echo ""

# ------------------------------------------------------------------------------
# Step 5: Run database migrations
# ------------------------------------------------------------------------------
STEP_START=$(date +%s)
echo "=== Step 5: Running database migrations ==="
DATABASE_URL="$DATABASE_URL" dbmate up
step_time $STEP_START
echo ""

# ------------------------------------------------------------------------------
# Step 6: Load all signature data from GMT files
# ------------------------------------------------------------------------------
STEP_START=$(date +%s)
echo "=== Step 6: Loading signatures from GMT files ==="
echo ""

# Batch ingest all GMT files from db/data/drug_perturbation and db/data/gene_perturbation
# Library names and directions are automatically parsed from filenames
# Note: Large files like l1000-cp (718K gene sets) require ~4GB RAM on host machine
uv run db/ingest.py --batch
step_time $STEP_START
echo ""

# ------------------------------------------------------------------------------
# Step 7: Populate fda_counts table from drug_lookup.json
# ------------------------------------------------------------------------------
STEP_START=$(date +%s)
echo "=== Step 7: Populating FDA counts from drug_lookup.json ==="
uv run db/ingest_fda_counts.py
step_time $STEP_START
echo ""

# ------------------------------------------------------------------------------
# Step 8: Update signature counts per perturbation
# ------------------------------------------------------------------------------
STEP_START=$(date +%s)
echo "=== Step 8: Updating signature counts per perturbation ==="
uv run db/ingest_fda_counts.py --update-counts
step_time $STEP_START
echo ""

# ------------------------------------------------------------------------------
# Step 9: Refresh materialized views
# ------------------------------------------------------------------------------
STEP_START=$(date +%s)
echo "=== Step 9: Refreshing materialized views ==="
docker exec $POSTGRES_CONTAINER psql -U postgres -c "REFRESH MATERIALIZED VIEW app_public.gene_set_fda_counts;"
docker exec $POSTGRES_CONTAINER psql -U postgres -c "REFRESH MATERIALIZED VIEW app_private.pmc_stats;"
step_time $STEP_START
echo ""

# ------------------------------------------------------------------------------
# Step 10: Start enrich service
# NOTE: Must start AFTER materialized view refresh. The enrich service queries
# gene_set_fda_counts when building its index, and will crash if the view
# hasn't been populated (even if empty).
# ------------------------------------------------------------------------------
STEP_START=$(date +%s)
echo "=== Step 10: Starting enrich service ==="
docker compose up -d perturbseek-enrich

echo "Waiting for enrich service to be ready..."
sleep 5

# Verify enrich is responding
WAIT_COUNT=0
MAX_WAIT=30
until curl -s http://localhost:8000/ > /dev/null 2>&1; do
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        echo "WARNING: Enrich service not responding after ${MAX_WAIT} seconds (continuing anyway)"
        break
    fi
    echo "  Waiting for enrich... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 1
done
step_time $STEP_START
echo ""

# ------------------------------------------------------------------------------
# Step 11: Update background (creates background and triggers enrich indexing)
# ------------------------------------------------------------------------------
STEP_START=$(date +%s)
echo "=== Step 11: Updating background ==="
uv run db/update_background.py
step_time $STEP_START
echo ""

# ------------------------------------------------------------------------------
# Step 12: Populate gene descriptions and summaries from NCBI
# ------------------------------------------------------------------------------
STEP_START=$(date +%s)
echo "=== Step 12: Populating gene descriptions and summaries from NCBI ==="
uv run db/ingest_gene_info.py
step_time $STEP_START
echo ""

# ------------------------------------------------------------------------------
# Step 13: Verify loaded data
# ------------------------------------------------------------------------------
STEP_START=$(date +%s)
echo "=== Step 13: Verifying loaded data ==="
docker exec $POSTGRES_CONTAINER psql -U postgres -c "
SELECT
  l.name as library,
  COUNT(*) as count
FROM app_public.gene_set gs
JOIN app_public.gene_set_library l ON gs.library_id = l.id
GROUP BY l.name
ORDER BY count DESC;
"

echo ""
docker exec $POSTGRES_CONTAINER psql -U postgres -c "SELECT COUNT(*) as total_gene_sets FROM app_public.gene_set;"
docker exec $POSTGRES_CONTAINER psql -U postgres -c "SELECT COUNT(*) as gene_sets_with_perturbation FROM app_public.gene_set WHERE perturbation IS NOT NULL AND perturbation != '';"
docker exec $POSTGRES_CONTAINER psql -U postgres -c "SELECT COUNT(*) as genes_with_descriptions FROM app_public.gene WHERE description IS NOT NULL;"

echo ""
echo "FDA Counts summary:"
docker exec $POSTGRES_CONTAINER psql -U postgres -c "SELECT COUNT(*) as total_fda_entries, COUNT(CASE WHEN approved THEN 1 END) as fda_approved, COUNT(CASE WHEN moa IS NOT NULL AND moa != '' THEN 1 END) as with_moa FROM app_public.fda_counts;"
docker exec $POSTGRES_CONTAINER psql -U postgres -c "SELECT perturbation, count, approved, SUBSTRING(moa, 1, 50) as moa_preview FROM app_public.fda_counts WHERE count > 100 ORDER BY count DESC LIMIT 10;"
step_time $STEP_START

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------
SCRIPT_END=$(date +%s)
echo ""
echo "=========================================="
echo "=== Setup Complete ==="
echo "Total time: $((SCRIPT_END - SCRIPT_START)) seconds"
echo "End time: $(date)"
echo "=========================================="
echo ""
echo "PerturbSeqr backend services are running:"
echo "  - Postgres:  localhost:5432 (user: postgres, password: postgres)"
echo "  - Enrich:    http://localhost:8000"
echo ""

# ------------------------------------------------------------------------------
# Step 14: Start frontend
# ------------------------------------------------------------------------------
if [ "$DEV_MODE" = true ]; then
    echo "=== Step 14: Starting frontend (dev mode) ==="
    echo "Starting Next.js dev server with hot reloading..."
    echo "  - Web App:   http://localhost:3000"
    echo "  - GraphiQL:  http://localhost:3000/graphiql"
    echo ""
    echo "Press Ctrl+C to stop the dev server"
    echo ""
    npm run dev
else
    echo ""
    echo "To start the frontend, either:"
    echo "  - Run with --dev flag for Next.js dev server: ./scripts/setup_and_load_data.sh --dev"
    echo "  - Or start Docker frontend manually: docker compose up -d"
    echo ""
    echo "Once running:"
    echo "  - Web App:   http://localhost:3000"
    echo "  - GraphiQL:  http://localhost:3000/graphiql"
    echo ""
    echo "To stop:  docker compose down"
    echo "To start: docker compose up -d"
fi
