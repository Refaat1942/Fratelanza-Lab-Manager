from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant_config import Branch
from app.schemas.branches import BranchCreate, BranchUpdate


class BranchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_branches(self, tenant_id: UUID) -> list[Branch]:
        result = await self.db.execute(
            select(Branch)
            .where(Branch.tenant_id == tenant_id, Branch.deleted_at.is_(None))
            .order_by(Branch.is_headquarters.desc(), Branch.name.asc())
        )
        return list(result.scalars().all())

    async def create_branch(self, tenant_id: UUID, data: BranchCreate) -> Branch:
        from app.services.tenant_limits_service import TenantLimitsService

        await TenantLimitsService(self.db).assert_can_add_branch(tenant_id)
        if data.is_headquarters:
            result = await self.db.execute(
                select(Branch).where(
                    Branch.tenant_id == tenant_id,
                    Branch.is_headquarters.is_(True),
                    Branch.deleted_at.is_(None),
                )
            )
            for existing in result.scalars().all():
                existing.is_headquarters = False

        branch = Branch(
            tenant_id=tenant_id,
            code=data.code,
            name=data.name,
            name_ar=data.name_ar,
            address=data.address,
            city=data.city,
            governorate=data.governorate,
            phone=data.phone,
            email=data.email,
            is_headquarters=data.is_headquarters,
        )
        self.db.add(branch)
        await self.db.flush()
        return branch

    async def update_branch(self, tenant_id: UUID, branch_id: UUID, data: BranchUpdate) -> Branch | None:
        result = await self.db.execute(
            select(Branch).where(
                Branch.id == branch_id,
                Branch.tenant_id == tenant_id,
                Branch.deleted_at.is_(None),
            )
        )
        branch = result.scalar_one_or_none()
        if not branch:
            return None

        if data.is_headquarters:
            hq_result = await self.db.execute(
                select(Branch).where(
                    Branch.tenant_id == tenant_id,
                    Branch.is_headquarters.is_(True),
                    Branch.deleted_at.is_(None),
                    Branch.id != branch_id,
                )
            )
            for existing in hq_result.scalars().all():
                existing.is_headquarters = False

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(branch, key, value)
        await self.db.flush()
        return branch

    async def delete_branch(self, tenant_id: UUID, branch_id: UUID) -> bool:
        result = await self.db.execute(
            select(Branch).where(
                Branch.id == branch_id,
                Branch.tenant_id == tenant_id,
                Branch.deleted_at.is_(None),
            )
        )
        branch = result.scalar_one_or_none()
        if not branch:
            return False
        branch.deleted_at = func.now()
        await self.db.flush()
        return True
