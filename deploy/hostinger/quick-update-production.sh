#!/bin/bash
# Fast production update — uses Docker build cache (much faster than full rebuild).
#
#   cd /opt/labmaster && sudo bash deploy/hostinger/quick-update-production.sh
#
# Use update-production.sh with FULL_REBUILD=1 when Dockerfile or dependencies changed.

set -euo pipefail

INSTALL_DIR="${LABMASTER_INSTALL_DIR:-/opt/labmaster}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

cd "$INSTALL_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Missing $INSTALL_DIR/$ENV_FILE"
  exit 1
fi

export BUILD_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "=== LabMaster quick update (cached build) ==="
echo "Target build: $BUILD_SHA"

git fetch origin main
git checkout main
git pull origin main

echo ""
echo "Building backend and frontend (with cache)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend frontend
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate backend frontend

API_PORT="$(grep -E '^LABMASTER_API_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo 18000)"
API_PORT="${API_PORT:-18000}"

echo ""
# shellcheck source=wait-for-api.sh
source "$(dirname "$0")/wait-for-api.sh"
wait_for_api "$API_PORT" || true

echo ""
echo "=== Quick update done ==="
echo "Hard-refresh browser: Ctrl+Shift+R"
