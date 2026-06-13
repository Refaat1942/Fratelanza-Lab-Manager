# LabMaster Egypt — Customer Readiness Report

Use this checklist before selling monthly subscriptions to laboratory customers.

## Architecture: how customer data is stored

| What customers expect | What LabMaster does today |
|----------------------|---------------------------|
| "Own database" | **Logical isolation** — one shared PostgreSQL database; each lab's rows are tagged with `tenant_id` |
| Separate server per customer | **Not implemented** — single app instance serves all tenants |
| Monthly auto-billing | **Manual renewal** via SaaS Owner Portal (record payment + extend `expires_at`) — no Stripe/payment gateway yet |

Each customer **does** get:

- Unique tenant code (e.g. `cairo-lab`)
- Isolated patients, results, billing, inventory, users (enforced in API services)
- Own subscription plan (Starter / Professional / Enterprise) with user & branch limits
- White-label branding (logo, colors)
- Optional custom domain field (DNS/nginx setup is manual)

## Pre-sale health check commands

```bash
# 1. Backend tests (subscriptions, isolation, auth)
cd backend && source .venv/bin/activate && pytest tests/ -v

# 2. API module sweep (all lab + platform endpoints)
python scripts/health_check.py

# 3. Frontend
cd frontend && npm run lint && npm run build
```

## Module status (lab portal)

| Module | API | UI | Notes |
|--------|-----|-----|-------|
| Patients | ✅ | ✅ | CRUD, visits, search |
| Doctors | ✅ | ✅ | |
| Tests & categories | ✅ | ✅ | Result templates |
| Results & orders | ✅ | ✅ | Enter, verify, release |
| Billing (patient invoices) | ✅ | ✅ | Not SaaS subscription billing |
| Inventory | ✅ | ✅ | Import template |
| Suppliers & purchasing | ✅ | ✅ | |
| Expenses | ✅ | ✅ | |
| Referrals & CRM | ✅ | ✅ | |
| Branches | ✅ | ✅ | Plan branch limits enforced |
| Users & RBAC | ✅ | ✅ | Plan user limits enforced |
| Reports & export | ✅ | ✅ | Excel/PDF |
| Dashboard & assistant | ✅ | ✅ | Rule-based assistant |
| Settings & branding | ✅ | ✅ | Limits visible to tenant admin |

## SaaS platform (your operator console)

| Feature | Status |
|---------|--------|
| Create tenant + admin user | ✅ |
| Assign subscription plan | ✅ |
| Renew subscription (manual payment) | ✅ |
| Suspend / lock / activate tenant | ✅ |
| Change plan (with downgrade checks) | ✅ |
| Revenue dashboard (MRR/YRR estimate) | ✅ Reporting only |
| Audit logs | ✅ |
| Feature flags per tenant | ✅ Stored; **not enforced on API routes** |

## Subscription enforcement (after latest fixes)

| Rule | Enforced |
|------|----------|
| Suspended / locked / expired tenant status | ✅ Login + API blocked |
| Subscription past `expires_at` | ✅ Blocked after grace period |
| Grace period (`GRACE_PERIOD_DAYS`, default 7) | ✅ Read-only grace then block |
| Max users per plan | ✅ On user create |
| Max branches per plan | ✅ On branch create |
| Auto-renew payment | ❌ Not automated |
| Stripe / card payments | ❌ Not implemented |

## Security checklist before production

| Item | Action required |
|------|-----------------|
| `SECRET_KEY` | Set strong random value in production `.env` |
| `ENVIRONMENT=production` | Disables demo password reset on startup |
| `DEBUG=false` | Production mode |
| Demo credentials | Remove or disable `demo-lab` tenant before go-live |
| HTTPS | Terminate SSL at nginx (see `deploy/hostinger/`) |
| Login rate limiting | ⚠️ Add rate limits on `/auth/login` |
| MFA for platform admin | ❌ Not implemented |
| PostgreSQL RLS | ❌ Optional hardening — app-layer isolation only today |

## Recommended go-live workflow (operator-managed SaaS)

1. **Create tenant** in Platform → Tenants with plan (monthly/yearly).
2. **Collect payment** offline (bank transfer, cash, etc.).
3. **Renew subscription** in Platform → enter `amount_paid`, extend period.
4. **Hand off** tenant code + admin username/password to customer.
5. Customer uses lab portal at your domain (e.g. `https://labmaster.yourdomain.com/login`).

## Gaps to close for fully automated SaaS sales

1. Payment gateway (Stripe / Paymob / Fawry) + webhooks
2. Customer self-signup + trial checkout
3. Scheduled job: expiry → grace → suspend → lock
4. Enforce `tenant_feature_flags` / plan `features.modules` on API
5. Integration test CI on every deploy
6. Database backups & restore runbook
7. Optional: dedicated database per enterprise customer (custom project)

## Honest positioning for customers

**Ready now:** Full LIMS/ERP for each laboratory, multi-tenant, Arabic/English, white-label, operator-managed monthly plans with enforced expiry and user/branch limits.

**Not ready yet:** Self-serve signup, automatic card billing, physically separate database per lab, payment dunning emails.
