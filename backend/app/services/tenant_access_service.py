from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.auth import RefreshToken, User
from app.models.platform import SubscriptionStatus, Tenant, TenantStatus, TenantSubscription

settings = get_settings()
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
        await self.assert_subscription_active(tenant_id)
        return tenant

    async def assert_subscription_active(self, tenant_id: UUID) -> TenantSubscription:
        """Block lab access when subscription is past expiry and grace period."""
        result = await self.db.execute(
            select(TenantSubscription)
            .where(TenantSubscription.tenant_id == tenant_id)
            .order_by(TenantSubscription.created_at.desc())
            .limit(1)
        )
        sub = result.scalar_one_or_none()
        if not sub:
            raise ValueError("No subscription found for this laboratory. Contact platform support.")

        if sub.status == SubscriptionStatus.CANCELLED:
            raise ValueError("Subscription cancelled. Contact platform support to renew.")

        now = datetime.now(timezone.utc)
        expires_at = self._as_utc(sub.expires_at)
        if now <= expires_at:
            return sub

        grace_end = self._as_utc(sub.grace_ends_at)
        if grace_end is None:
            grace_end = expires_at + timedelta(days=settings.GRACE_PERIOD_DAYS)

        if now <= grace_end:
            return sub

        raise ValueError(
            "Subscription expired. Please renew your monthly plan to continue using LabMaster."
        )

    @staticmethod
    def _as_utc(dt: datetime | None) -> datetime | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

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
