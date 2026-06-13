#!/bin/bash
# Pull latest code, rebuild containers, and verify LabMaster is on the new version.
#
# Run on VPS as root or labmaster owner:
#   cd /opt/labmaster && sudo bash deploy/hostinger/update-production.sh

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
echo "=== LabMaster production update ==="
echo "Target build: $BUILD_SHA"
echo ""

git fetch origin main
git checkout main
git pull origin main

echo ""
echo "Rebuilding backend and frontend (no cache)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache backend frontend
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate backend frontend

echo ""
echo "Removing legacy backup container (backups use host cron now)..."
docker rm -f labmaster-backup 2>/dev/null || true

echo ""
echo "Installing host backup cron..."
bash deploy/hostinger/install-backup-cron.sh 2>/dev/null || sudo bash deploy/hostinger/install-backup-cron.sh

API_PORT="$(grep -E '^LABMASTER_API_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo 18000)"
API_PORT="${API_PORT:-18000}"

echo ""
echo "Waiting for API..."
sleep 8

HEALTH="$(curl -fsS "http://127.0.0.1:${API_PORT}/health" 2>/dev/null || echo '{}')"
echo "API health: $HEALTH"

VERSION="$(curl -fsS "http://127.0.0.1:${API_PORT}/api/v1/public/version" 2>/dev/null || echo '{}')"
echo "App version: $VERSION"

echo ""
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo ""
echo "=== Done ==="
echo "1. Hard-refresh browser: Ctrl+Shift+R"
echo "2. Settings → General should show version 1.2.0 build $BUILD_SHA"
echo "3. Reports → daily card should export Arabic Excel"
echo "4. Patients → new visit should show Paid / Remaining fields"
echo "5. Backups: sudo bash deploy/hostinger/run-backup.sh  (cron daily at 02:00)"
