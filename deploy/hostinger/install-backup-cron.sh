#!/bin/bash
# Install daily LabMaster backups at 02:00 server time (host cron).
# Backups run as a one-shot script — no cron daemon inside Docker.
#
# Usage:
#   sudo bash deploy/hostinger/install-backup-cron.sh

set -euo pipefail

INSTALL_DIR="${LABMASTER_INSTALL_DIR:-/opt/labmaster}"
BACKUP_SCRIPT="$INSTALL_DIR/deploy/hostinger/run-backup.sh"
CRON_LINE="0 2 * * * LABMASTER_INSTALL_DIR=$INSTALL_DIR bash $BACKUP_SCRIPT >> /var/log/labmaster-backup.log 2>&1"
MARKER="# labmaster-daily-backup"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Run as root (sudo) so backups can write to the Docker volume."
  exit 1
fi

if [ ! -f "$BACKUP_SCRIPT" ]; then
  echo "ERROR: Backup script not found: $BACKUP_SCRIPT"
  exit 1
fi

chmod +x "$INSTALL_DIR/deploy/hostinger/backup-all-tenants.sh"
chmod +x "$BACKUP_SCRIPT"

if ! docker volume inspect labmaster_backups >/dev/null 2>&1; then
  echo "Creating Docker volume labmaster_backups..."
  docker volume create labmaster_backups >/dev/null
fi

touch /var/log/labmaster-backup.log
chmod 600 /var/log/labmaster-backup.log

TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$MARKER" | grep -v "run-backup.sh" | grep -v "backup-all-tenants.sh" >"$TMP" || true
echo "$CRON_LINE $MARKER" >>"$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Installed host cron for daily backup (02:00):"
crontab -l | grep labmaster || true
echo ""
echo "Backup storage: Docker volume labmaster_backups"
docker volume inspect labmaster_backups --format '  Mountpoint: {{.Mountpoint}}' 2>/dev/null || true
echo ""
echo "Test now:  sudo bash $BACKUP_SCRIPT"
echo "Logs:      /var/log/labmaster-backup.log"
