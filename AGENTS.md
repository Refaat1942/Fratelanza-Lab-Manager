# AGENTS.md

## Cursor Cloud specific instructions

### Services

| Service | How to run | Notes |
|---------|------------|-------|
| PostgreSQL | `docker compose up -d postgres` | Required for API and migrations |
| Backend API | `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` | Run `alembic upgrade head` and `python scripts/seed.py` first |
| Frontend | `cd frontend && npm run dev` | http://localhost:3000 |

Full stack: `docker compose up -d` from repo root (frontend :3000, API :8000).

### Lint / test / build

- Backend tests: `cd backend && python -m pytest tests/ -q`
- Frontend build: `cd frontend && npm run build`
- No dedicated ESLint script in `package.json`; rely on `npm run build` for type checks.

### Platform vs lab apps

- Platform super-admin UI defaults to **English** (`useLocale("platform")`).
- Lab app defaults to **Arabic**.
- Platform routes live under `/platform/*`; lab routes under `/(lab)/*`.

### Common gotchas

- After dependency installs, restart dev servers if hot reload does not pick up new packages.
- Production deploy on VPS: `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build` plus `alembic upgrade head` in the backend container.
- Platform tenant feature saves can 500 if admin password fields are sent unchanged; tenants edit flow uses `passwordDirty` to avoid that.
- **Data “missing” after re-login:** usually wrong tenant DB routing or data left in platform DB. On login, missing rows are synced from platform → dedicated DB. Manual repair: `docker compose ... exec backend python scripts/sync_tenant_data_from_platform.py <lab-code>`.
- **Backups:** `backup` service in `docker-compose.prod.yml` runs daily at 02:00; also run `sudo bash deploy/hostinger/install-backup-cron.sh` on the host. After VPS reboot: `bash deploy/hostinger/post-reboot.sh`.
- Login screen pre-fills last laboratory code from `labmaster-auth` — customer must use the same code every time.
- Tests catalog list has **no default date filter**; transactional pages (patients, billing) still filter by date range.
