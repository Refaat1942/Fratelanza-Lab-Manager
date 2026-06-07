# LabMaster Egypt - Testing Strategy

## Test Pyramid

```
        /\
       /E2E\          Playwright (future)
      /------\
     /Integration\    API + DB tests (pytest)
    /--------------\
   /   Unit Tests   \  Services, schemas, utilities
  /------------------\
```

## Backend Testing (pytest)

### Setup
```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v --cov=app
```

### Test Categories

| Category | Location | Coverage Target |
|----------|----------|-----------------|
| Unit | `tests/unit/` | Services, security, schemas |
| Integration | `tests/integration/` | API endpoints with test DB |
| Auth | `tests/integration/test_auth.py` | JWT, RBAC, refresh tokens |

### Key Test Scenarios

1. **Authentication**: Login, refresh, token expiry, invalid credentials
2. **Multi-tenancy**: Tenant isolation - user A cannot access tenant B data
3. **RBAC**: Permission checks on all CRUD endpoints
4. **Patients**: CRUD, search by name/phone/national ID, soft delete
5. **Subscriptions**: Expiry, grace period, suspension logic
6. **Audit**: All mutations create audit log entries

## Frontend Testing (future)

- **Component tests**: Vitest + React Testing Library for DataTable, forms
- **E2E tests**: Playwright for login flow, patient CRUD, export

## CI Pipeline (recommended)

```yaml
- Backend: pytest + coverage report (min 80%)
- Frontend: npm run lint + npm run build
- Docker: docker compose build
- Migration: alembic upgrade head on clean DB
```

## Test Database

Use a separate `labmaster_test` database. Set `DATABASE_URL` in test conftest to point to test DB with transaction rollback per test.
