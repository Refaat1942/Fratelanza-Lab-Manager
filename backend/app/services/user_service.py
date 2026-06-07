from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import User, UserRole
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.users import TenantUserCreate
from app.services.auth_service import AuthService


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_users(self, tenant_id: UUID, params: PaginationParams) -> PaginatedResponse:
        query = (
            select(User)
            .options(selectinload(User.roles).selectinload(UserRole.role))
            .where(User.tenant_id == tenant_id, User.deleted_at.is_(None))
            .order_by(User.created_at.desc())
        )
        from sqlalchemy import func
        count_result = await self.db.execute(
            select(func.count()).where(User.tenant_id == tenant_id, User.deleted_at.is_(None))
        )
        total = count_result.scalar() or 0
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        result = await self.db.execute(query)
        users = result.scalars().all()
        items = []
        for u in users:
            items.append({
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "full_name": u.full_name,
                "full_name_ar": u.full_name_ar,
                "phone": u.phone,
                "is_active": u.is_active,
                "is_tenant_admin": u.is_tenant_admin,
                "roles": [ur.role.name for ur in u.roles],
                "last_login_at": u.last_login_at,
                "created_at": u.created_at,
            })
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def create_user(self, tenant_id: UUID, data: TenantUserCreate) -> User:
        from app.schemas.auth import UserCreate
        return await AuthService(self.db).create_user(
            tenant_id,
            UserCreate(
                username=data.username,
                password=data.password,
                full_name=data.full_name,
                full_name_ar=data.full_name_ar,
                phone=data.phone,
                is_tenant_admin=data.is_tenant_admin,
                role_ids=data.role_ids,
            ),
        )

    async def deactivate_user(self, tenant_id: UUID, user_id: UUID) -> bool:
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.tenant_id == tenant_id, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if not user:
            return False
        user.is_active = False
        await self.db.flush()
        return True
