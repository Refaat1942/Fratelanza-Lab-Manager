# LabMaster Egypt

Commercial SaaS ERP + Laboratory Information Management System (LIMS) for medical laboratories across Egypt and the Middle East.

## Features

- **Multi-tenant SaaS** with subscription plans (Starter, Professional, Enterprise)
- **SaaS Owner Portal** for tenant management, billing, feature flags, revenue dashboard
- **Laboratory Modules**: Patients, Doctors, Referrals, Tests, Results, Billing, Expenses, Inventory, Purchasing, Suppliers, CRM, Marketing, Accounting, Reports, Settings, Users, Branches
- **Multi-branch** operations with consolidated reporting
- **White-label branding** per tenant (logo, colors, domain)
- **Arabic & English** UI support with RTL
- **RBAC** with JWT + refresh tokens and audit logs
- **Dynamic tables** with sorting, search, filter, pagination, export (Excel/PDF/CSV)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, TypeScript, TailwindCSS, Shadcn UI |
| Backend | FastAPI, Python 3.12 |
| Database | PostgreSQL 16 |
| Auth | JWT + Refresh Tokens + RBAC |
| Deployment | Docker, Nginx, Ubuntu VPS |

## Deploy on Hostinger VPS (Safe — won't touch existing projects)

```bash
ssh root@187.124.15.14

# 1. Deploy app
curl -fsSL https://raw.githubusercontent.com/Refaat1942/Fratelanza-Lab-Manager/main/deploy/hostinger/deploy.sh | bash

# 2. Connect domain (use a SUBDOMAIN — e.g. labmaster.yourdomain.com)
cd /opt/labmaster
sudo bash deploy/hostinger/setup-domain.sh labmaster.yourdomain.com
sudo bash deploy/hostinger/enable-ssl.sh labmaster.yourdomain.com

# If another project (e.g. Fratelanza) opens instead — isolated nginx fix:
sudo bash deploy/hostinger/apply-labmaster-nginx.sh labmaster.yourdomain.com
```

Uses isolated ports + a **separate nginx site** — your other projects stay untouched.

Guides: [Domain Setup](docs/DOMAIN_SETUP.md) | [VPS Deploy](docs/DEPLOYMENT_HOSTINGER.md)

## Quick Start (Local)

### Docker (Recommended)

```bash
docker compose up -d
```

- Frontend: http://localhost:3000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Demo Credentials

| Portal | Email | Password | Tenant Code |
|--------|-------|----------|-------------|
| Laboratory | labadmin | *(set on first deploy)* | demo-lab |
| SaaS Platform | superadmin | *(set on first deploy)* | — |

### Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Project Structure

```
├── backend/           # FastAPI API (Clean Architecture)
│   ├── app/
│   │   ├── api/       # REST endpoints
│   │   ├── core/      # Config, security
│   │   ├── db/        # Database session
│   │   ├── models/    # SQLAlchemy models (40+ tables)
│   │   ├── schemas/   # Pydantic schemas
│   │   └── services/  # Business logic
│   ├── alembic/       # Database migrations
│   ├── scripts/       # Seed data
│   └── tests/         # pytest tests
├── frontend/          # Next.js 15 application
│   └── src/
│       ├── app/       # App router pages
│       ├── components/# UI components
│       └── lib/       # API client, i18n
├── database/          # SQL schema reference
├── docker/            # Nginx config
└── docs/              # ERD, API, testing docs
```

## Documentation

- [ERD & Database Design](docs/ERD.md)
- [API Reference](docs/API.md)
- [Testing Strategy](docs/TESTING_STRATEGY.md)

## Future Modules

WhatsApp, SMS, Patient Portal, Mobile Apps, AI Insights, OCR Reports, Barcode & QR Tracking, Insurance Integration, Egyptian eInvoice Integration.

## License

Proprietary - Commercial SaaS Product
