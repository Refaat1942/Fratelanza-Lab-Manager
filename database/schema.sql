-- LabMaster Egypt - Complete PostgreSQL Schema
-- Multi-tenant SaaS ERP/LIMS with tenant_id on all business tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Platform / SaaS Owner tables (no tenant_id)
-- tenants, subscription_plans, tenant_subscriptions, platform_users, platform_audit_logs, tenant_feature_flags

-- All business tables include:
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
--   tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
--   created_at TIMESTAMPTZ DEFAULT NOW()
--   updated_at TIMESTAMPTZ DEFAULT NOW()
--   deleted_at TIMESTAMPTZ NULL (soft delete)

-- See backend/app/models/ for full SQLAlchemy model definitions.
-- Run: cd backend && alembic upgrade head && python scripts/seed.py

-- Key indexes (applied via Alembic migration):
-- idx_patients_search: GIN on (full_name, phone, national_id) using pg_trgm
-- idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL
-- idx_subscriptions_expires ON tenant_subscriptions(expires_at) WHERE status = 'active'
-- idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC)
-- idx_inventory_batches_expiry ON inventory_batches(expiry_date) WHERE quantity > 0

-- Tenant isolation policy: all queries MUST filter by tenant_id
-- Row-level security can be enabled per deployment:
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation ON patients USING (tenant_id = current_setting('app.tenant_id')::uuid);
