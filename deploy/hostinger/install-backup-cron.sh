#!/bin/bash
# Install daily LabMaster backups at 02:00 server time.
#
# Usage:
#   sudo bash deploy/hostinger/install-backup-cron.sh

set -euo pipefail

INSTALL_DIR="${LABMASTER_INSTALL_DIR:-/opt/labmaster}"
BACKUP_SCRIPT="$INSTALL_DIR/deploy/hostinger/backup-all-tenants.sh"
CRON_LINE="0 2 * * * cd $INSTALL_DIR && bash $BACKUP_SCRIPT >> /var/log/labmaster-backup.log 2>&1"
MARKER="# labmaster-daily-backup"

if [ ! -f "$BACKUP_SCRIPT" ]; then
  echo "ERROR: Backup script not found: $BACKUP_SCRIPT"
  exit 1
fi

chmod +x "$BACKUP_SCRIPT"

TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$MARKER" | grep -v "backup-all-tenants.sh" >"$TMP" || true
echo "$CRON_LINE $MARKER" >>"$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Installed daily backup cron (02:00):"
crontab -l | grep labmaster || true
echo ""
echo "Test now: cd $INSTALL_DIR && bash deploy/hostinger/backup-all-tenants.sh"
echo "Logs: /var/log/labmaster-backup.log"
