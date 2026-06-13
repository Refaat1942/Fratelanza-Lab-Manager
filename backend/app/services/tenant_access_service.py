from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import RefreshToken, User
from app.models.platform import Tenant, TenantStatus

BLOCKED_STATUSES = (TenantStatus.SUSPENDED, TenantStatus.DELETED)


class TenantAccessService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_tenant(self, tenant_id: UUID) -> Tenant | None:
        result = await self.db.execute(
            select(Tenant).where(Tenant.id == tenant_id, Tenant.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def assert_tenant_active(self, tenant_id: UUID) -> Tenant:
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            raise ValueError("Tenant not found")
        if tenant.deleted_at is not None:
            raise ValueError("Tenant account is deleted")
        if tenant.status in BLOCKED_STATUSES:
            raise ValueError(f"Tenant account is {tenant.status.value}")
        return tenant

    async def revoke_tenant_sessions(self, tenant_id: UUID) -> int:
        now = datetime.now(timezone.utc)
        user_ids_result = await self.db.execute(
            select(User.id).where(User.tenant_id == tenant_id, User.deleted_at.is_(None))
        )
        user_ids = [row[0] for row in user_ids_result.all()]
        if not user_ids:
            return 0

        result = await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id.in_(user_ids), RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        return result.rowcount or 0
