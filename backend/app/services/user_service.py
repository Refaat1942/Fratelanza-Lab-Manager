from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import Permission, Role, RolePermission, User, UserRole
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.users import TenantUserCreate, TenantUserUpdate
from app.services.auth_service import AuthService
from app.utils.list_date_filter import filter_by_entry_date


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_users(
        self,
        tenant_id: UUID,
        params: PaginationParams,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> PaginatedResponse:
        query = (
            select(User)
            .options(selectinload(User.roles).selectinload(UserRole.role))
            .where(
                User.tenant_id == tenant_id,
                User.deleted_at.is_(None),
                User.is_system.is_(False),
            )
            .order_by(User.created_at.desc())
        )
        query = filter_by_entry_date(query, User.created_at, date_from, date_to)
        from sqlalchemy import func
        count_query = select(User.id).where(
            User.tenant_id == tenant_id, User.deleted_at.is_(None), User.is_system.is_(False)
        )
        count_query = filter_by_entry_date(count_query, User.created_at, date_from, date_to)
        count_result = await self.db.execute(
            select(func.count()).select_from(count_query.subquery())
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

    async def list_roles(self, tenant_id: UUID) -> list[dict]:
        result = await self.db.execute(
            select(Role)
            .options(selectinload(Role.permissions).selectinload(RolePermission.permission))
            .where(Role.tenant_id == tenant_id, Role.deleted_at.is_(None))
            .order_by(Role.name)
        )
        roles = []
        for role in result.scalars().all():
            roles.append({
                "id": role.id,
                "name": role.name,
                "name_ar": role.name_ar,
                "description": role.description,
                "is_system": role.is_system,
                "permissions": [rp.permission.code for rp in role.permissions if rp.permission],
            })
        return roles

    async def list_permissions(self) -> list[dict]:
        result = await self.db.execute(select(Permission).order_by(Permission.module, Permission.action))
        return [
            {
                "code": p.code,
                "module": p.module,
                "action": p.action,
                "description": p.description,
                "description_ar": p.description_ar,
            }
            for p in result.scalars().all()
        ]

    def _user_payload(self, user: User) -> dict:
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "full_name_ar": user.full_name_ar,
            "phone": user.phone,
            "is_active": user.is_active,
            "is_tenant_admin": user.is_tenant_admin,
            "roles": [ur.role.name for ur in user.roles if ur.role],
            "last_login_at": user.last_login_at,
            "created_at": user.created_at,
        }

    async def _user_payload_with_roles(self, tenant_id: UUID, user_id: UUID) -> dict:
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.roles).selectinload(UserRole.role))
            .where(User.id == user_id, User.tenant_id == tenant_id)
        )
        user = result.scalar_one()
        return self._user_payload(user)

    async def create_user(self, tenant_id: UUID, data: TenantUserCreate) -> User:
        from app.schemas.auth import UserCreate
        return await AuthService(tenant_db=self.db).create_user(
            tenant_id,
            UserCreate(
                username=data.username,
                password=data.password,
                full_name=data.full_name,
                full_name_ar=data.full_name_ar,
                phone=data.phone,
                is_tenant_admin=data.is_tenant_admin,
                is_system=False,
                role_ids=data.role_ids,
            ),
        )

    async def update_user(self, tenant_id: UUID, user_id: UUID, data: TenantUserUpdate) -> User | None:
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == user_id, User.tenant_id == tenant_id, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if not user or user.is_system:
            return None
        if data.full_name is not None:
            user.full_name = data.full_name
        if data.full_name_ar is not None:
            user.full_name_ar = data.full_name_ar
        if data.phone is not None:
            user.phone = data.phone
        if data.is_active is not None:
            user.is_active = data.is_active
        if data.role_ids is not None:
            from sqlalchemy import delete

            await self.db.execute(delete(UserRole).where(UserRole.user_id == user.id))
            for role_id in data.role_ids:
                self.db.add(UserRole(user_id=user.id, role_id=role_id))
        await self.db.flush()
        refreshed = await self.db.execute(
            select(User)
            .options(selectinload(User.roles).selectinload(UserRole.role))
            .where(User.id == user.id)
        )
        return refreshed.scalar_one()

    async def deactivate_user(self, tenant_id: UUID, user_id: UUID) -> bool:
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.tenant_id == tenant_id, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if not user:
            return False
        if user.is_system:
            raise ValueError("System accounts cannot be deactivated from the laboratory portal")
        user.is_active = False
        await self.db.flush()
        return True
