# Per-customer databases and daily backups

LabMaster can run **one PostgreSQL database per laboratory** (customer) plus a **platform database** for tenants, subscriptions, and platform admins.

## Architecture

| Database | Contents |
|----------|----------|
| `labmaster` (platform) | `tenants`, `tenant_subscriptions`, `platform_users`, `platform_audit_logs`, … |
| `labmaster_tenant_<code>` | Patients, tests, invoices, users, branches, … for that lab only |

Example: tenant code `ahram-lab` → database `labmaster_tenant_ahram_lab`.

Controlled by environment variables (see `.env.production`):

```env
TENANT_DATABASE_PER_CUSTOMER=true
TENANT_DATABASE_PREFIX=labmaster_tenant_
```

New laboratories created in the **Platform → Tenants** UI automatically get:

1. A row in the platform `tenants` table with `database_name`
2. `CREATE DATABASE labmaster_tenant_<code>`
3. Alembic migrations on that database
4. Default branch, branding, and admin user in the **tenant** database

## Enable on an existing VPS (one-time)

From `/opt/labmaster`:

```bash
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build backend

# Platform migration (adds tenants.database_name)
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend alembic upgrade head

# Move each existing lab from shared data into its own DB
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend \
  python scripts/migrate_tenants_to_dedicated_dbs.py

# Dry-run first (optional):
# ... exec backend python scripts/migrate_tenants_to_dedicated_dbs.py --dry-run

# Single lab only:
# ... exec backend python scripts/migrate_tenants_to_dedicated_dbs.py --tenant-code ahram-lab
```

After migration, **all lab users must log in again** (JWT includes `database_name`).

Reset a lab admin password if needed:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend \
  python scripts/ensure_tenant_admin.py --tenant-code ahram-lab --username admin --password 'NewPass123!'
```

## Daily backups (per customer + platform)

### What is backed up

- Platform database (`labmaster`)
- **Every** customer database (`labmaster_tenant_*` from `tenants.database_name` and matching DB names)
- Uploads volume (`labmaster_uploads` — logos, files)

Backups are stored in the Docker volume **`labmaster_backups`** (default retention **14 days**).

Each run creates `YYYY-MM-DD_HHMMSS/` with `.sql.gz` files and `uploads.tar.gz`.

To see the on-disk path on the VPS:

```bash
docker volume inspect labmaster_backups --format '{{.Mountpoint}}'
```

### Install automatic daily backup (02:00 server time)

Backups are scheduled on the **host** with cron (no cron daemon inside Docker):

```bash
cd /opt/labmaster
sudo bash deploy/hostinger/install-backup-cron.sh
```

### Run a backup manually

```bash
cd /opt/labmaster
sudo bash deploy/hostinger/run-backup.sh
```

Optional overrides:

```bash
export LABMASTER_BACKUP_DIR=/mnt/backups/labmaster
export LABMASTER_BACKUP_RETENTION_DAYS=30
sudo -E bash deploy/hostinger/run-backup.sh
```

### Restore a customer database (example)

```bash
# Stop backend to avoid writes (optional but safer)
docker compose -f docker-compose.prod.yml --env-file .env.production stop backend

BACKUP_DIR="$(docker volume inspect labmaster_backups --format '{{.Mountpoint}}')"

gunzip -c "$BACKUP_DIR/2026-06-10_020001/labmaster_tenant_ahram_lab.sql.gz" | \
  docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  psql -U labmaster -d labmaster_tenant_ahram_lab

docker compose -f docker-compose.prod.yml --env-file .env.production start backend
```

**Important:** Copy the `labmaster_backups` volume off the VPS regularly (S3, Google Drive, another server). Local backups alone do not protect against full VPS loss.
