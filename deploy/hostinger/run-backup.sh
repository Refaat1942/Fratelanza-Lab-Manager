#!/bin/bash
# Run a one-shot LabMaster backup (platform DB, tenant DBs, uploads).
#
# Usage on VPS:
#   cd /opt/labmaster && sudo bash deploy/hostinger/run-backup.sh
#
# Scheduled automatically by deploy/hostinger/install-backup-cron.sh (host cron).

set -euo pipefail

INSTALL_DIR="${LABMASTER_INSTALL_DIR:-/opt/labmaster}"
exec bash "$INSTALL_DIR/deploy/hostinger/backup-all-tenants.sh" "$@"
