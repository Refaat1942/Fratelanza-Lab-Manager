from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import RefreshToken, User
from app.models.platform import SubscriptionStatus, Tenant, TenantStatus, TenantSubscription

BLOCKED_STATUSES = (TenantStatus.SUSPENDED, TenantStatus.LOCKED, TenantStatus.EXPIRED)


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
        if tenant.status in BLOCKED_STATUSES:
            raise ValueError(f"Tenant account is {tenant.status.value}")
        if await self.subscription_lapsed(tenant):
            raise ValueError(f"Tenant account is {TenantStatus.EXPIRED.value}")
        return tenant

    async def subscription_lapsed(self, tenant: Tenant) -> bool:
        """True once the latest subscription is cancelled or past its cut-off.
        Paid plans keep working through the grace period; demos stop at expiry."""
        sub = (
            await self.db.execute(
                select(TenantSubscription)
                .where(TenantSubscription.tenant_id == tenant.id)
                .order_by(TenantSubscription.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if not sub:
            return False
        if sub.status in (SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED):
            return True
        cutoff = sub.expires_at
        if tenant.status != TenantStatus.TRIAL and sub.grace_ends_at:
            cutoff = sub.grace_ends_at
        return datetime.now(timezone.utc) > cutoff

    async def revoke_tenant_sessions(self, tenant_id: UUID, tenant_db: AsyncSession | None = None) -> int:
        from app.db.manager import get_database_manager

        now = datetime.now(timezone.utc)
        db = tenant_db
        close_db = False
        if db is None:
            tenant = await self.get_tenant(tenant_id)
            mgr = get_database_manager()
            if not tenant:
                db = self.db
            else:
                db_name = mgr.resolve_tenant_database(tenant.code, tenant.database_name)
                if db_name == mgr.platform_database_name:
                    db = self.db
                else:
                    db = await mgr.tenant_session(db_name)
                    close_db = True
        try:
            user_ids_result = await db.execute(
                select(User.id).where(User.tenant_id == tenant_id, User.deleted_at.is_(None))
            )
            user_ids = [row[0] for row in user_ids_result.all()]
            if not user_ids:
                return 0

            result = await db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id.in_(user_ids), RefreshToken.revoked_at.is_(None))
                .values(revoked_at=now)
            )
            if close_db:
                await db.commit()
            return result.rowcount or 0
        finally:
            if close_db:
                await db.close()
