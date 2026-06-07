from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tests import Test, TestCategory, TestResultTemplate
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.tests import ResultTemplateUpdate, TestCreate, TestUpdate
from app.services.audit_service import AuditService


class TestService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    async def list_categories(self, tenant_id: UUID) -> list[TestCategory]:
        result = await self.db.execute(
            select(TestCategory).where(
                TestCategory.tenant_id == tenant_id, TestCategory.deleted_at.is_(None), TestCategory.is_active.is_(True)
            ).order_by(TestCategory.sort_order)
        )
        return list(result.scalars().all())

    async def list_tests(self, tenant_id: UUID, params: PaginationParams, category_id: Optional[UUID] = None) -> PaginatedResponse:
        query = select(Test).where(Test.tenant_id == tenant_id, Test.deleted_at.is_(None))
        if category_id:
            query = query.where(Test.category_id == category_id)
        if params.search:
            term = f"%{params.search}%"
            query = query.where(or_(Test.name.ilike(term), Test.name_ar.ilike(term), Test.code.ilike(term)))
        count_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = count_result.scalar() or 0
        sort_col = getattr(Test, params.sort_by or "name", Test.name)
        query = query.order_by(sort_col.desc() if params.sort_order == "desc" else sort_col.asc())
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        result = await self.db.execute(query)
        items = result.scalars().all()
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def get_test(self, tenant_id: UUID, test_id: UUID) -> Optional[Test]:
        result = await self.db.execute(
            select(Test).where(Test.id == test_id, Test.tenant_id == tenant_id, Test.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def create_test(self, tenant_id: UUID, data: TestCreate, user_id: UUID) -> Test:
        count = (await self.db.execute(select(func.count()).where(Test.tenant_id == tenant_id))).scalar() or 0
        test = Test(tenant_id=tenant_id, code=f"T{count + 1:04d}", **data.model_dump())
        self.db.add(test)
        await self.db.flush()
        await self.audit.log(
            tenant_id=tenant_id, user_id=user_id, action="create", module="tests",
            entity_type="test", entity_id=str(test.id), new_values=data.model_dump(mode="json"),
        )
        return test

    async def update_test(self, tenant_id: UUID, test_id: UUID, data: TestUpdate, user_id: UUID) -> Optional[Test]:
        test = await self.get_test(tenant_id, test_id)
        if not test:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(test, key, value)
        await self.db.flush()
        await self.audit.log(
            tenant_id=tenant_id, user_id=user_id, action="update", module="tests",
            entity_type="test", entity_id=str(test.id),
            new_values=data.model_dump(exclude_unset=True, mode="json"),
        )
        return test

    async def delete_test(self, tenant_id: UUID, test_id: UUID, user_id: UUID) -> bool:
        test = await self.get_test(tenant_id, test_id)
        if not test:
            return False
        test.deleted_at = func.now()
        await self.audit.log(
            tenant_id=tenant_id, user_id=user_id, action="delete", module="tests",
            entity_type="test", entity_id=str(test.id),
        )
        return True

    async def get_result_template(self, tenant_id: UUID, test_id: UUID) -> list[TestResultTemplate]:
        result = await self.db.execute(
            select(TestResultTemplate)
            .where(TestResultTemplate.tenant_id == tenant_id, TestResultTemplate.test_id == test_id)
            .order_by(TestResultTemplate.sort_order)
        )
        return list(result.scalars().all())

    async def save_result_template(self, tenant_id: UUID, test_id: UUID, data: ResultTemplateUpdate) -> list[TestResultTemplate]:
        test = await self.get_test(tenant_id, test_id)
        if not test:
            raise ValueError("Test not found")
        existing = await self.db.execute(
            select(TestResultTemplate).where(TestResultTemplate.test_id == test_id, TestResultTemplate.tenant_id == tenant_id)
        )
        for row in existing.scalars().all():
            await self.db.delete(row)
        await self.db.flush()
        templates = []
        for i, field in enumerate(data.fields):
            t = TestResultTemplate(
                tenant_id=tenant_id,
                test_id=test_id,
                parameter_name=field.parameter_name,
                parameter_name_ar=field.parameter_name_ar,
                unit=field.unit,
                field_type=field.field_type,
                sort_order=field.sort_order if field.sort_order else i,
                options=field.options,
            )
            self.db.add(t)
            templates.append(t)
        await self.db.flush()
        return templates
