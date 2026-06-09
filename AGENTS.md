# AGENTS.md

## Cursor Cloud specific instructions

LabMaster Egypt is a multi-tenant SaaS ERP + LIMS: **FastAPI backend**, **Next.js 15 frontend**, **PostgreSQL 16**. See [README.md](README.md) for full project overview.

### Services (local dev without Docker)

| Service | Port | How to run |
|---------|------|------------|
| PostgreSQL 16 | 5432 | System service: `sudo pg_ctlcluster 16 main start` |
| Backend (Uvicorn) | 8000 | `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` |
| Frontend (Next.js) | 3000 | `cd frontend && npm run dev` |
| Nginx proxy (recommended for browser) | 8080 | See note below |

**Important:** In the browser, `frontend/src/lib/api-base.ts` routes API calls to same-origin `/api/v1` on localhost. Hitting the frontend directly on port **3000** will 404 on login unless you also proxy `/api/` (Docker Compose uses nginx on port 80 for this). For native local dev, use an nginx reverse proxy on port **8080** that forwards `/api/` → `127.0.0.1:8000` and `/` → `127.0.0.1:3000`, then open **http://localhost:8080**.

Alternatively, run the full stack with `docker compose up -d` (includes postgres, redis, backend, frontend, nginx).

### First-time database setup

```bash
cp backend/.env.example backend/.env
cd backend && source .venv/bin/activate
alembic upgrade head
python scripts/seed.py
python scripts/ensure_platform_admin.py
python scripts/ensure_demo_admin.py
```

### Demo credentials (after seed)

| Portal | URL | Username | Password | Tenant |
|--------|-----|----------|----------|--------|
| Laboratory | `/login` | `labadmin` | `Demo@123` | `demo-lab` |
| SaaS Platform | `/platform/login` | `superadmin` | `Admin@123` | — |

### Lint / test / build

| Component | Command |
|-----------|---------|
| Backend tests | `cd backend && source .venv/bin/activate && pytest` |
| Frontend lint | `cd frontend && npm run lint` |
| Frontend build | `cd frontend && npm run build` |

Redis is configured in compose/env but is **not used** by application code today.
