#!/bin/bash
# Deploy PerturbSeqr to k8s dev server with database restore
#
# Prerequisites:
#   - sshkube installed and configured
#   - Database dump at: perturbseqr_backup.dump
#   - GHCR_PAT environment variable set (GitHub PAT with read:packages)
#
# Usage:
#   export GHCR_PAT=ghp_xxx
#   ./scripts/deploy_to_dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

NAMESPACE="johnkgardner"
DUMP_FILE="perturbseqr_backup.dump"
BACKGROUND_ID="f12e0a26-1eb4-4bf3-bfe6-60de2ca2f0fe"

# Images - GHCR (private)
IMAGE_TAG="${IMAGE_TAG:-0.0.1}"
POSTGRES_IMAGE="ghcr.io/maayanlab/perturbseqr-postgres:${IMAGE_TAG}"
ENRICH_IMAGE="ghcr.io/maayanlab/perturbseqr-enrich:${IMAGE_TAG}"
APP_IMAGE="ghcr.io/maayanlab/perturbseqr-app:${IMAGE_TAG}"
IMAGE_PULL_SECRET="ghcr-secret"

echo "=== PerturbSeqr Dev Server Deployment ==="
echo "Working directory: $PROJECT_DIR"
echo "Namespace: $NAMESPACE"
echo "Image tag: $IMAGE_TAG"
echo ""

# Initialize sshkube for kubectl access
eval "$(sshkube init)"

# ------------------------------------------------------------------------------
# Step 1: Verify prerequisites
# ------------------------------------------------------------------------------
echo "=== Step 1: Checking prerequisites ==="

if [ -z "$GHCR_PAT" ]; then
    echo "ERROR: GHCR_PAT environment variable not set"
    echo "  Create a GitHub PAT with read:packages permission"
    echo "  Then run: export GHCR_PAT=ghp_xxx"
    exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
    echo "ERROR: Database dump not found: $DUMP_FILE"
    exit 1
fi

echo "Verifying cluster access..."
if ! kubectl get pods -n $NAMESPACE > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to cluster or access namespace $NAMESPACE"
    echo "  Run: sshkube install -s ssh.k8s.dev.maayanlab.cloud -u johnkgardner"
    exit 1
fi
echo "Cluster access verified."
echo ""

# ------------------------------------------------------------------------------
# Step 2: Create imagePullSecret for GHCR
# ------------------------------------------------------------------------------
echo "=== Step 2: Creating imagePullSecret for GHCR ==="

kubectl delete secret $IMAGE_PULL_SECRET -n $NAMESPACE --ignore-not-found
kubectl create secret docker-registry $IMAGE_PULL_SECRET \
    --namespace $NAMESPACE \
    --docker-server=ghcr.io \
    --docker-username=johnkgardner \
    --docker-password="$GHCR_PAT"

echo "imagePullSecret '$IMAGE_PULL_SECRET' created."
echo ""

# ------------------------------------------------------------------------------
# Step 3: Create PVC (namespace already exists)
# ------------------------------------------------------------------------------
echo "=== Step 3: Creating PVC ==="

kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: perturbseqr-data
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: gp2
  resources:
    requests:
      storage: 50Gi
EOF

echo "PVC created."
echo ""

# ------------------------------------------------------------------------------
# Step 4: Deploy PostgreSQL
# ------------------------------------------------------------------------------
echo "=== Step 4: Deploying PostgreSQL ==="

kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: perturbseqr-postgres
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: perturbseqr-postgres
  template:
    metadata:
      labels:
        app: perturbseqr-postgres
    spec:
      imagePullSecrets:
      - name: $IMAGE_PULL_SECRET
      containers:
      - name: postgres
        image: $POSTGRES_IMAGE
        env:
        - name: POSTGRES_DB
          value: postgres
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          value: postgres
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: perturbseqr-data
---
apiVersion: v1
kind: Service
metadata:
  name: perturbseqr-postgres
  namespace: $NAMESPACE
spec:
  selector:
    app: perturbseqr-postgres
  ports:
  - port: 5432
    targetPort: 5432
EOF

echo "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=available deployment/perturbseqr-postgres -n $NAMESPACE --timeout=120s
POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=perturbseqr-postgres -o jsonpath='{.items[0].metadata.name}')
echo "PostgreSQL pod: $POSTGRES_POD"

# Wait for postgres to actually accept connections
until kubectl exec -n $NAMESPACE $POSTGRES_POD -- pg_isready -U postgres &> /dev/null; do
    echo "  Waiting for postgres to accept connections..."
    sleep 2
done
echo "PostgreSQL is ready."
echo ""

# ------------------------------------------------------------------------------
# Step 5: Copy database dump to cluster
# ------------------------------------------------------------------------------
echo "=== Step 5: Copying database dump to cluster ($(du -h $DUMP_FILE | cut -f1)) ==="
echo "This may take a while..."
kubectl cp "$DUMP_FILE" "$NAMESPACE/$POSTGRES_POD:/tmp/$DUMP_FILE"
echo "Dump copied."
echo ""

# ------------------------------------------------------------------------------
# Step 6: Restore database
# ------------------------------------------------------------------------------
echo "=== Step 6: Restoring database ==="
kubectl exec -n $NAMESPACE $POSTGRES_POD -- pg_restore \
    -U postgres \
    -d postgres \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "/tmp/$DUMP_FILE" || true
echo "Database restored."
echo ""

# ------------------------------------------------------------------------------
# Step 7: Refresh materialized views
# ------------------------------------------------------------------------------
echo "=== Step 7: Refreshing materialized views ==="
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -c \
    "REFRESH MATERIALIZED VIEW app_public.gene_set_fda_counts;"
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -c \
    "REFRESH MATERIALIZED VIEW app_private.pmc_stats;"
echo "Materialized views refreshed."
echo ""

# ------------------------------------------------------------------------------
# Step 8: Verify data
# ------------------------------------------------------------------------------
echo "=== Step 8: Verifying restored data ==="
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -c \
    "SELECT COUNT(*) as total_gene_sets FROM app_public.gene_set;"
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -c \
    "SELECT id, n_gene_ids FROM app_public.background;"
echo ""

# ------------------------------------------------------------------------------
# Step 9: Deploy enrich service
# ------------------------------------------------------------------------------
echo "=== Step 9: Deploying enrich service ==="

kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: perturbseqr-enrich
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: perturbseqr-enrich
  template:
    metadata:
      labels:
        app: perturbseqr-enrich
    spec:
      imagePullSecrets:
      - name: $IMAGE_PULL_SECRET
      containers:
      - name: enrich
        image: $ENRICH_IMAGE
        env:
        - name: ROCKET_DATABASES
          value: '{postgres={url="postgres://postgres:postgres@perturbseqr-postgres/postgres"}}'
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "5Gi"
          limits:
            memory: "8Gi"
---
apiVersion: v1
kind: Service
metadata:
  name: perturbseqr-enrich
  namespace: $NAMESPACE
spec:
  selector:
    app: perturbseqr-enrich
  ports:
  - port: 8000
    targetPort: 8000
EOF

echo "Waiting for enrich service to be ready..."
kubectl wait --for=condition=available deployment/perturbseqr-enrich -n $NAMESPACE --timeout=300s || true
echo "Enrich service deployed."
echo ""

# ------------------------------------------------------------------------------
# Step 10: Trigger background indexing
# ------------------------------------------------------------------------------
echo "=== Step 10: Triggering background indexing ==="
ENRICH_POD=$(kubectl get pods -n $NAMESPACE -l app=perturbseqr-enrich -o jsonpath='{.items[0].metadata.name}')
sleep 10  # Give enrich time to start

echo "Triggering index for background $BACKGROUND_ID..."
kubectl exec -n $NAMESPACE $ENRICH_POD -- curl -s "http://localhost:8000/$BACKGROUND_ID" || true
echo "Background indexing triggered."
echo ""

# ------------------------------------------------------------------------------
# Step 11: Deploy app
# ------------------------------------------------------------------------------
echo "=== Step 11: Deploying app ==="

kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: perturbseqr-app
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: perturbseqr-app
  template:
    metadata:
      labels:
        app: perturbseqr-app
    spec:
      imagePullSecrets:
      - name: $IMAGE_PULL_SECRET
      containers:
      - name: app
        image: $APP_IMAGE
        env:
        - name: PUBLIC_URL
          value: https://perturbseqr.dev.maayanlab.cloud
        - name: DATABASE_URL
          value: postgres://postgres:postgres@perturbseqr-postgres/postgres
        - name: NODE_ENV
          value: production
        - name: ENRICH_URL
          value: http://perturbseqr-enrich:8000
        ports:
        - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: perturbseqr-app
  namespace: $NAMESPACE
spec:
  selector:
    app: perturbseqr-app
  ports:
  - port: 3000
    targetPort: 3000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: perturbseqr-ingress
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - perturbseqr.dev.maayanlab.cloud
    secretName: perturbseqr-tls
  rules:
  - host: perturbseqr.dev.maayanlab.cloud
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: perturbseqr-app
            port:
              number: 3000
EOF

echo "Waiting for app to be ready..."
kubectl wait --for=condition=available deployment/perturbseqr-app -n $NAMESPACE --timeout=120s || true
echo "App deployed."
echo ""

# ------------------------------------------------------------------------------
# Step 12: Cleanup
# ------------------------------------------------------------------------------
echo "=== Step 12: Cleaning up ==="
kubectl exec -n $NAMESPACE $POSTGRES_POD -- rm -f "/tmp/$DUMP_FILE"
echo "Removed dump file from cluster."
echo ""

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------
echo "=========================================="
echo "=== Deployment Complete ==="
echo "=========================================="
echo ""
echo "PerturbSeqr is now available at:"
echo "  https://perturbseqr.dev.maayanlab.cloud"
echo ""
echo "To check status:"
echo "  eval \"\$(sshkube init)\" && kubectl get pods -n $NAMESPACE"
echo ""
echo "To view logs:"
echo "  eval \"\$(sshkube init)\" && kubectl logs -n $NAMESPACE deployment/perturbseqr-app"
echo ""
echo "To tear down:"
echo "  eval \"\$(sshkube init)\" && kubectl delete deployment perturbseqr-app perturbseqr-enrich perturbseqr-postgres -n $NAMESPACE"
echo "  eval \"\$(sshkube init)\" && kubectl delete svc perturbseqr-app perturbseqr-enrich perturbseqr-postgres -n $NAMESPACE"
echo "  eval \"\$(sshkube init)\" && kubectl delete ingress perturbseqr-ingress -n $NAMESPACE"
echo "  eval \"\$(sshkube init)\" && kubectl delete pvc perturbseqr-data -n $NAMESPACE"
echo "  eval \"\$(sshkube init)\" && kubectl delete secret $IMAGE_PULL_SECRET -n $NAMESPACE"
