# LabMaster Security — Customer Data Protection

This document explains how LabMaster keeps each laboratory's data isolated and protected in production.

## Data isolation (multi-tenant)

- Every patient, result, invoice, and user record is scoped by `tenant_id` in the database.
- API requests from laboratory users are authenticated with JWT and bound to the user's tenant from the database — not from a client-supplied header alone.
- If a client sends `X-Tenant-Id` that does not match the authenticated user, the request is rejected.
- Platform (SaaS owner) APIs are separate and require a platform-admin token; laboratory tokens cannot access them.

## Authentication

- Passwords are hashed with bcrypt before storage.
- Access tokens expire after 30 minutes; refresh tokens after 7 days.
- Refresh tokens are stored as SHA-256 hashes (never in plain text).
- Login, platform login, and token refresh are rate-limited to reduce brute-force attacks.
- Suspended, locked, or expired tenants cannot log in or refresh sessions.

## Production deployment checklist

Before going live with customer data:

1. **HTTPS** — Run `enable-ssl.sh` so all traffic is encrypted in transit.
2. **Secrets** — Set strong values in `.env.production`:
   - `SECRET_KEY` (openssl rand -hex 32)
   - `POSTGRES_PASSWORD`
   - `PLATFORM_ADMIN_PASSWORD`
   - `DEMO_ADMIN_PASSWORD` (or remove demo tenant in production)
3. **CORS** — Set `CORS_ORIGINS` to your HTTPS domain only.
4. **Never commit** `.env.production` to git.
5. **Do not set** `RESET_BOOTSTRAP_PASSWORDS=true` in production unless you intentionally reset bootstrap accounts.
6. **Change default passwords** after first login if demo accounts remain enabled.

## What deploy does NOT do (by design)

- Does not reset existing admin passwords on every deploy.
- Does not expose PostgreSQL or Redis on public host ports (internal Docker network only).
- Does not modify other nginx sites or projects on the VPS.
- Does not expose `/docs` or `/redoc` when `ENVIRONMENT=production`.

## Infrastructure isolation

See [deploy/hostinger/ISOLATION.md](../deploy/hostinger/ISOLATION.md) for VPS-level isolation from other projects.

## Reporting issues

If you discover a security issue, change affected passwords immediately and restrict access until patched.
