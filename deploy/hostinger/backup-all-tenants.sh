#!/bin/bash
# LabMaster — one-shot backup: platform DB, each customer DB, and uploads volume.
#
# Run on the VPS host (recommended):
#   cd /opt/labmaster && sudo bash deploy/hostinger/run-backup.sh
#   cd /opt/labmaster && sudo bash deploy/hostinger/backup-all-tenants.sh
#
# Scheduled daily at 02:00 by deploy/hostinger/install-backup-cron.sh (host cron).
#
# Optional env:
#   LABMASTER_INSTALL_DIR=/opt/labmaster
#   LABMASTER_BACKUP_DIR=/path/to/backups   (default: Docker volume labmaster_backups)
#   LABMASTER_BACKUP_RETENTION_DAYS=14

set -euo pipefail

INSTALL_DIR="${LABMASTER_INSTALL_DIR:-/opt/labmaster}"
RETENTION_DAYS="${LABMASTER_BACKUP_RETENTION_DAYS:-14}"
DATE_TAG="$(date +%Y-%m-%d_%H%M%S)"
ENV_FILE="${INSTALL_DIR}/.env.production"
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.prod.yml"

log() { echo "[$(date -Iseconds)] $*"; }

resolve_backup_root() {
  if [ -n "${LABMASTER_BACKUP_DIR:-}" ]; then
    echo "$LABMASTER_BACKUP_DIR"
    return
  fi
  if docker volume inspect labmaster_backups >/dev/null 2>&1; then
    docker volume inspect labmaster_backups --format '{{.Mountpoint}}'
    return
  fi
  echo "/opt/labmaster-backups"
}

BACKUP_ROOT="$(resolve_backup_root)"
DAY_DIR="$BACKUP_ROOT/$DATE_TAG"

log() { echo "[$(date -Iseconds)] $*"; }

if [ ! -d "$INSTALL_DIR" ]; then
  log "ERROR: Install dir not found: $INSTALL_DIR"
  exit 1
fi

cd "$INSTALL_DIR"

if [ ! -f "$ENV_FILE" ]; then
  log "ERROR: Missing $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
set -a && source "$ENV_FILE" && set +a

POSTGRES_USER="${POSTGRES_USER:-labmaster}"
POSTGRES_DB="${POSTGRES_DB:-labmaster}"
TENANT_PREFIX="${TENANT_DATABASE_PREFIX:-labmaster_tenant_}"

mkdir -p "$BACKUP_ROOT" "$DAY_DIR"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

if ! compose exec -T postgres pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
  log "ERROR: PostgreSQL is not ready (is labmaster-postgres running?)"
  exit 1
fi

dump_db() {
  local db_name="$1"
  local out_file="$DAY_DIR/${db_name}.sql.gz"
  log "Dumping database: $db_name"
  compose exec -T postgres pg_dump -U "$POSTGRES_USER" --no-owner --no-acl "$db_name" | gzip -9 >"$out_file"
}

# 1) Platform registry database (tenants, subscriptions, platform admins)
dump_db "$POSTGRES_DB"

# 2) Each customer database from registry
TENANT_DBS=""
TENANT_DBS="$(compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT DISTINCT database_name FROM tenants WHERE database_name IS NOT NULL AND deleted_at IS NULL ORDER BY 1" \
  2>/dev/null | sed '/^$/d' || true)"

if [ -n "$TENANT_DBS" ]; then
  while IFS= read -r db; do
    [ -z "$db" ] && continue
    if [ "$db" != "$POSTGRES_DB" ]; then
      dump_db "$db"
    fi
  done <<<"$TENANT_DBS"
fi

# 3) Any tenant DB matching prefix not yet in registry (safety net)
EXTRA_DBS="$(compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE '${TENANT_PREFIX}%' ORDER BY 1" \
  2>/dev/null | sed '/^$/d' || true)"

if [ -n "$EXTRA_DBS" ]; then
  while IFS= read -r db; do
    [ -z "$db" ] && continue
    if [ ! -f "$DAY_DIR/${db}.sql.gz" ]; then
      dump_db "$db"
    fi
  done <<<"$EXTRA_DBS"
fi

# 4) Uploaded files (logos, etc.)
if docker volume inspect labmaster_uploads >/dev/null 2>&1; then
  log "Archiving uploads volume"
  docker run --rm \
    -v labmaster_uploads:/data:ro \
    -v "$DAY_DIR:/backup" \
    alpine:3.20 \
    tar czf "/backup/uploads.tar.gz" -C /data .
fi

# Manifest
{
  echo "timestamp=$DATE_TAG"
  echo "platform_db=$POSTGRES_DB"
  echo "tenant_prefix=$TENANT_PREFIX"
  echo "files:"
  ls -lh "$DAY_DIR"
} >"$DAY_DIR/manifest.txt"

# Retention: remove backup folders older than N days
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} + 2>/dev/null || true

log "Backup complete: $DAY_DIR"
log "Retention: ${RETENTION_DAYS} days under $BACKUP_ROOT"
