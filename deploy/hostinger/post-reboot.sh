#!/bin/bash
# Start LabMaster after a VPS reboot (files and DB volumes are preserved).
set -euo pipefail

INSTALL_DIR="${LABMASTER_INSTALL_DIR:-/opt/labmaster}"
cd "$INSTALL_DIR"

echo "Starting LabMaster stack..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

echo "Installing host backup cron if missing..."
if ! crontab -l 2>/dev/null | grep -q labmaster-daily-backup; then
  sudo bash deploy/hostinger/install-backup-cron.sh || bash deploy/hostinger/install-backup-cron.sh
fi

echo "Stack status:"
docker compose -f docker-compose.prod.yml --env-file .env.production ps
