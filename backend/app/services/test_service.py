from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tests import Test, TestCategory, TestResultTemplate
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.tests import ResultTemplateUpdate, TestCreate, TestUpdate
from app.services.audit_service import AuditService
from app.utils.list_date_filter import filter_by_entry_date


class TestService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    async def ensure_default_category(self, tenant_id: UUID) -> TestCategory:
        """Every lab needs at least one category so tests can be saved."""
        result = await self.db.execute(
            select(TestCategory).where(
                TestCategory.tenant_id == tenant_id,
                TestCategory.deleted_at.is_(None),
            ).order_by(TestCategory.sort_order)
            .limit(1)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

        # Reuse soft-deleted GEN row (unique on tenant_id + code)
        archived = await self.db.execute(
            select(TestCategory).where(
                TestCategory.tenant_id == tenant_id,
                TestCategory.code == "GEN",
            )
        )
        restored = archived.scalar_one_or_none()
        if restored:
            restored.deleted_at = None
            restored.is_active = True
            await self.db.flush()
            return restored

        category = TestCategory(
            tenant_id=tenant_id,
            code="GEN",
            name="General",
            name_ar="عام",
            sort_order=0,
        )
        self.db.add(category)
        await self.db.flush()
        return category

    async def list_categories(self, tenant_id: UUID) -> list[TestCategory]:
        categories = await self._list_categories_raw(tenant_id)
        if not categories:
            await self.ensure_default_category(tenant_id)
            categories = await self._list_categories_raw(tenant_id)
        return categories

    async def _list_categories_raw(self, tenant_id: UUID) -> list[TestCategory]:
        result = await self.db.execute(
            select(TestCategory).where(
                TestCategory.tenant_id == tenant_id, TestCategory.deleted_at.is_(None), TestCategory.is_active.is_(True)
            ).order_by(TestCategory.sort_order)
        )
        return list(result.scalars().all())

    async def resolve_category_id(self, tenant_id: UUID, category_id: Optional[UUID]) -> UUID:
        if category_id:
            result = await self.db.execute(
                select(TestCategory).where(
                    TestCategory.id == category_id,
                    TestCategory.tenant_id == tenant_id,
                    TestCategory.deleted_at.is_(None),
                )
            )
            if result.scalar_one_or_none():
                return category_id
        default = await self.ensure_default_category(tenant_id)
        return default.id

    async def list_tests(
        self,
        tenant_id: UUID,
        params: PaginationParams,
        category_id: Optional[UUID] = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> PaginatedResponse:
        query = select(Test).where(Test.tenant_id == tenant_id, Test.deleted_at.is_(None))
        query = filter_by_entry_date(query, Test.created_at, date_from, date_to)
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

    async def _next_test_code(self, tenant_id: UUID) -> str:
        result = await self.db.execute(
            select(Test.code).where(Test.tenant_id == tenant_id, Test.code.like("T%"))
        )
        max_num = 0
        for (code,) in result.all():
            suffix = code[1:]
            if len(code) == 5 and suffix.isdigit():
                max_num = max(max_num, int(suffix))
        return f"T{max_num + 1:04d}"

    async def create_test(self, tenant_id: UUID, data: TestCreate, user_id: UUID) -> Test:
        category_id = await self.resolve_category_id(tenant_id, data.category_id)
        fields = data.model_dump(exclude={"category_id"})
        test = Test(
            tenant_id=tenant_id,
            category_id=category_id,
            code=await self._next_test_code(tenant_id),
            **fields,
        )
        self.db.add(test)
        await self.db.flush()
        audit_values = data.model_dump(mode="json")
        audit_values["category_id"] = str(category_id)
        await self.audit.log(
            tenant_id=tenant_id, user_id=user_id, action="create", module="tests",
            entity_type="test", entity_id=str(test.id), new_values=audit_values,
        )
        return test

    @staticmethod
    def _sync_display_name(updates: dict, current_name: str) -> dict:
        """Keep name_ar in sync when labs only maintain the English name."""
        if "name" in updates and "name_ar" not in updates:
            updates["name_ar"] = updates["name"].strip()
        elif "name_ar" in updates and not (updates.get("name_ar") or "").strip():
            updates["name_ar"] = (updates.get("name") or current_name).strip()
        if "name" in updates:
            updates["name"] = updates["name"].strip()
        return updates

    async def update_test(self, tenant_id: UUID, test_id: UUID, data: TestUpdate, user_id: UUID) -> Optional[Test]:
        test = await self.get_test(tenant_id, test_id)
        if not test:
            return None
        updates = self._sync_display_name(data.model_dump(exclude_unset=True), test.name)
        for key, value in updates.items():
            setattr(test, key, value)
        await self.db.flush()
        audit_values = {
            k: str(v) if isinstance(v, UUID) else v
            for k, v in updates.items()
        }
        await self.audit.log(
            tenant_id=tenant_id, user_id=user_id, action="update", module="tests",
            entity_type="test", entity_id=str(test.id),
            new_values=audit_values,
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
