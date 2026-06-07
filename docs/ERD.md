# LabMaster Egypt - Entity Relationship Diagram

## Architecture Overview

```mermaid
erDiagram
    TENANTS ||--o{ TENANT_SUBSCRIPTIONS : has
    SUBSCRIPTION_PLANS ||--o{ TENANT_SUBSCRIPTIONS : defines
    TENANTS ||--o{ BRANCHES : operates
    TENANTS ||--|| TENANT_BRANDING : brands
    TENANTS ||--o{ USERS : employs
    TENANTS ||--o{ PATIENTS : manages
    TENANTS ||--o{ DOCTORS : tracks
    TENANTS ||--o{ TESTS : offers
    TENANTS ||--o{ INVENTORY_ITEMS : stocks

    PATIENTS ||--o{ PATIENT_VISITS : visits
    PATIENT_VISITS ||--o{ LAB_ORDERS : orders
    LAB_ORDERS ||--o{ LAB_ORDER_ITEMS : contains
    LAB_ORDER_ITEMS }o--|| TESTS : references
    LAB_ORDERS ||--o{ LAB_RESULTS : produces
    LAB_RESULTS ||--o{ LAB_RESULT_VALUES : contains

    PATIENTS ||--o{ INVOICES : billed
    INVOICES ||--o{ INVOICE_ITEMS : contains
    INVOICES ||--o{ PAYMENTS : receives

    DOCTORS ||--o{ REFERRALS : refers
    DOCTORS ||--o{ DOCTOR_COMMISSIONS : earns

    TESTS }o--|| TEST_CATEGORIES : categorized
    TESTS ||--o{ TEST_REFERENCE_RANGES : has
    TESTS ||--o{ TEST_CONSUMABLES : consumes
    TEST_CONSUMABLES }o--|| INVENTORY_ITEMS : deducts

    INVENTORY_ITEMS ||--o{ INVENTORY_BATCHES : batched
    INVENTORY_ITEMS ||--o{ INVENTORY_TRANSACTIONS : logs
    SUPPLIERS ||--o{ PURCHASE_ORDERS : supplies

    USERS ||--o{ USER_ROLES : assigned
    ROLES ||--o{ ROLE_PERMISSIONS : grants
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : defined

    TENANTS {
        uuid id PK
        string code UK
        string name
        enum status
        timestamp deleted_at
    }

    PATIENTS {
        uuid id PK
        uuid tenant_id FK
        uuid branch_id FK
        string patient_code
        string national_id
        string full_name
        timestamp deleted_at
    }

    TESTS {
        uuid id PK
        uuid tenant_id FK
        uuid category_id FK
        string code
        string name
        string name_ar
        decimal price
        decimal cost
    }

    INVENTORY_ITEMS {
        uuid id PK
        uuid tenant_id FK
        uuid branch_id FK
        string sku
        enum category
        decimal unit_cost
    }
```

## Multi-Tenancy Strategy

- Every business table includes `tenant_id UUID NOT NULL` with FK to `tenants(id) ON DELETE CASCADE`
- API middleware validates tenant context via JWT + `X-Tenant-Id` header
- Soft delete via `deleted_at` column on all mutable entities
- Platform tables (`platform_users`, `subscription_plans`) have no tenant_id

## Index Strategy

| Table | Index | Purpose |
|-------|-------|---------|
| patients | (tenant_id, patient_code) UNIQUE | Code generation |
| patients | GIN on name, phone, national_id | Full-text search |
| audit_logs | (tenant_id, created_at DESC) | Audit trail queries |
| tenant_subscriptions | (expires_at) WHERE active | Renewal monitoring |
| inventory_batches | (expiry_date) WHERE qty > 0 | Expiry alerts |

## Subscription Lifecycle

```mermaid
stateDiagram-v2
    [*] --> trial: Tenant Created
    trial --> active: Payment Received
    active --> grace: Subscription Expired
    grace --> suspended: Grace Period Ended
    grace --> active: Renewal Payment
    suspended --> active: Reactivation
    active --> locked: Admin Lock
    locked --> active: Admin Unlock
```
