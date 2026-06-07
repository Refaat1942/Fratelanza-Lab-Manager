# LabMaster Egypt - API Documentation

Base URL: `http://localhost:8000/api/v1`

Interactive docs: `http://localhost:8000/docs`

## Authentication

### Laboratory Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@demo-lab.eg",
  "password": "Demo@123",
  "tenant_code": "demo-lab"
}
```

### Platform Admin Login
```http
POST /auth/platform/login
Content-Type: application/json

{
  "email": "admin@labmaster.eg",
  "password": "Admin@123"
}
```

### Refresh Token
```http
POST /auth/refresh
{ "refresh_token": "..." }
```

### Headers for Tenant APIs
```
Authorization: Bearer <access_token>
X-Tenant-Id: <tenant_uuid>
```

## Platform APIs (SaaS Owner)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /platform/dashboard | Revenue dashboard |
| GET | /platform/tenants | List laboratories |
| POST | /platform/tenants | Create laboratory |
| PATCH | /platform/tenants/{id} | Update laboratory |
| POST | /platform/tenants/{id}/lock | Lock tenant |
| POST | /platform/tenants/{id}/unlock | Unlock tenant |
| GET | /platform/plans | List subscription plans |
| POST | /platform/plans | Create plan |
| PUT | /platform/tenants/{id}/features | Update feature flags |

## Laboratory APIs

| Module | Endpoints | Permissions |
|--------|-----------|-------------|
| Patients | GET/POST/PUT/DELETE /patients | patients.* |
| Doctors | /doctors (planned) | doctors.* |
| Tests | /tests (planned) | tests.* |
| Results | /results (planned) | results.* |
| Billing | /invoices (planned) | billing.* |
| Inventory | /inventory (planned) | inventory.* |
| Reports | /reports (planned) | reports.read |

## Pagination & Filtering

All list endpoints support:
- `page` (default: 1)
- `page_size` (default: 20, max: 100)
- `search` (full-text)
- `sort_by` (column name)
- `sort_order` (asc/desc)

## Error Responses

```json
{
  "detail": "Error message"
}
```

| Status | Meaning |
|--------|---------|
| 401 | Not authenticated |
| 403 | Insufficient permissions or tenant suspended |
| 404 | Resource not found |
| 422 | Validation error |
