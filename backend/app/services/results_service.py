from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.orders import LabOrder, LabOrderItem, LabResult, LabResultValue, OrderStatus, ResultStatus
from app.models.patients import Patient, PatientVisit, VisitStatus
from app.models.tests import Test, TestResultTemplate
from app.models.tenant_config import Branch
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.results import LabOrderCreate, ResultEntryCreate
from app.utils.list_date_filter import filter_by_entry_date


class ResultsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_results(
        self,
        tenant_id: UUID,
        params: PaginationParams,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> PaginatedResponse:
        query = (
            select(LabResult, LabOrder, Patient, Test)
            .join(LabOrder, LabResult.order_id == LabOrder.id)
            .join(Patient, LabOrder.patient_id == Patient.id)
            .join(Test, LabResult.test_id == Test.id)
            .where(LabResult.tenant_id == tenant_id, LabResult.deleted_at.is_(None))
            .order_by(LabOrder.ordered_at.desc())
        )
        query = filter_by_entry_date(query, LabOrder.ordered_at, date_from, date_to)
        count_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = count_result.scalar() or 0
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        result = await self.db.execute(query)
        items = []
        for lab_result, order, patient, test in result.all():
            items.append({
                "id": lab_result.id,
                "order_id": order.id,
                "order_number": order.order_number,
                "patient_id": patient.id,
                "patient_name": patient.full_name,
                "test_id": test.id,
                "test_name": test.name,
                "test_code": test.code,
                "status": lab_result.status,
                "ordered_at": order.ordered_at,
            })
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def list_orders(
        self,
        tenant_id: UUID,
        params: PaginationParams,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> PaginatedResponse:
        query = (
            select(LabOrder, Patient, func.count(LabOrderItem.id))
            .join(Patient, LabOrder.patient_id == Patient.id)
            .outerjoin(LabOrderItem, LabOrderItem.order_id == LabOrder.id)
            .where(LabOrder.tenant_id == tenant_id, LabOrder.deleted_at.is_(None))
            .group_by(LabOrder.id, Patient.id)
            .order_by(LabOrder.ordered_at.desc())
        )
        query = filter_by_entry_date(query, LabOrder.ordered_at, date_from, date_to)
        count_query = select(LabOrder.id).where(LabOrder.tenant_id == tenant_id, LabOrder.deleted_at.is_(None))
        count_query = filter_by_entry_date(count_query, LabOrder.ordered_at, date_from, date_to)
        count_result = await self.db.execute(
            select(func.count()).select_from(count_query.subquery())
        )
        total = count_result.scalar() or 0
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        result = await self.db.execute(query)
        items = []
        for order, patient, test_count in result.all():
            items.append({
                "id": order.id,
                "order_number": order.order_number,
                "patient_id": patient.id,
                "patient_name": patient.full_name,
                "status": order.status,
                "ordered_at": order.ordered_at,
                "test_count": test_count,
            })
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def create_order(self, tenant_id: UUID, data: LabOrderCreate, user_id: UUID) -> LabOrder:
        patient = await self.db.get(Patient, data.patient_id)
        if not patient or patient.tenant_id != tenant_id:
            raise ValueError("Patient not found")

        branch_id = data.branch_id or patient.branch_id
        if not branch_id:
            branch_result = await self.db.execute(
                select(Branch.id).where(Branch.tenant_id == tenant_id, Branch.deleted_at.is_(None)).limit(1)
            )
            branch_id = branch_result.scalar_one_or_none()
        if not branch_id:
            raise ValueError("No branch available")

        now = datetime.now(timezone.utc)
        visit_count = await self.db.execute(
            select(func.count()).where(PatientVisit.tenant_id == tenant_id)
        )
        visit_num = (visit_count.scalar() or 0) + 1
        visit = PatientVisit(
            tenant_id=tenant_id,
            patient_id=patient.id,
            branch_id=branch_id,
            visit_number=f"V{visit_num:05d}",
            visit_date=now,
            status=VisitStatus.IN_PROGRESS,
            referring_doctor_id=data.referring_doctor_id,
        )
        self.db.add(visit)
        await self.db.flush()

        order_count = await self.db.execute(select(func.count()).where(LabOrder.tenant_id == tenant_id))
        order_num = (order_count.scalar() or 0) + 1
        order = LabOrder(
            tenant_id=tenant_id,
            visit_id=visit.id,
            patient_id=patient.id,
            branch_id=branch_id,
            order_number=f"ORD-{order_num:05d}",
            status=OrderStatus.PENDING,
            ordered_at=now,
            referring_doctor_id=data.referring_doctor_id,
            notes=data.notes,
        )
        self.db.add(order)
        await self.db.flush()

        for test_id in data.test_ids:
            test = await self.db.get(Test, test_id)
            if not test or test.tenant_id != tenant_id:
                continue
            item = LabOrderItem(
                tenant_id=tenant_id,
                order_id=order.id,
                test_id=test.id,
                price=float(test.price),
            )
            self.db.add(item)
            await self.db.flush()
            self.db.add(
                LabResult(
                    tenant_id=tenant_id,
                    order_id=order.id,
                    order_item_id=item.id,
                    test_id=test.id,
                    branch_id=branch_id,
                    status=ResultStatus.PENDING,
                )
            )
        await self.db.flush()
        return order

    async def enter_result(
        self, tenant_id: UUID, result_id: UUID, data: ResultEntryCreate, user_id: UUID
    ) -> LabResult:
        result = await self.db.execute(
            select(LabResult).where(
                LabResult.id == result_id, LabResult.tenant_id == tenant_id, LabResult.deleted_at.is_(None)
            )
        )
        lab_result = result.scalar_one_or_none()
        if not lab_result:
            raise ValueError("Result not found")

        for v in data.values:
            self.db.add(
                LabResultValue(
                    tenant_id=tenant_id,
                    result_id=lab_result.id,
                    parameter_name=v.parameter_name,
                    value=v.value,
                    unit=v.unit,
                    reference_range=v.reference_range,
                )
            )
        lab_result.status = ResultStatus.VERIFIED
        lab_result.verified_by = user_id
        lab_result.verified_at = datetime.now(timezone.utc)
        lab_result.notes = data.notes
        await self.db.flush()
        return lab_result

    async def get_result_form(self, tenant_id: UUID, result_id: UUID) -> dict:
        result = await self.db.execute(
            select(LabResult, Test, Patient, LabOrder)
            .join(Test, LabResult.test_id == Test.id)
            .join(LabOrder, LabResult.order_id == LabOrder.id)
            .join(Patient, LabOrder.patient_id == Patient.id)
            .where(LabResult.id == result_id, LabResult.tenant_id == tenant_id, LabResult.deleted_at.is_(None))
        )
        row = result.first()
        if not row:
            raise ValueError("Result not found")
        lab_result, test, patient, order = row
        tpl_result = await self.db.execute(
            select(TestResultTemplate)
            .where(TestResultTemplate.test_id == test.id, TestResultTemplate.tenant_id == tenant_id)
            .order_by(TestResultTemplate.sort_order)
        )
        templates = tpl_result.scalars().all()
        if not templates:
            templates = [
                type("T", (), {"parameter_name": "Result", "parameter_name_ar": "النتيجة", "unit": "", "field_type": "text", "sort_order": 0})()
            ]
        return {
            "result_id": str(lab_result.id),
            "order_number": order.order_number,
            "patient_name": patient.full_name,
            "test_name": test.name,
            "test_id": str(test.id),
            "status": lab_result.status.value,
            "fields": [
                {
                    "parameter_name": t.parameter_name,
                    "parameter_name_ar": getattr(t, "parameter_name_ar", None),
                    "unit": t.unit,
                    "field_type": getattr(t, "field_type", "numeric"),
                    "sort_order": getattr(t, "sort_order", i),
                }
                for i, t in enumerate(templates)
            ],
        }

    async def release_result(self, tenant_id: UUID, result_id: UUID) -> LabResult:
        result = await self.db.execute(
            select(LabResult).where(
                LabResult.id == result_id, LabResult.tenant_id == tenant_id, LabResult.deleted_at.is_(None)
            )
        )
        lab_result = result.scalar_one_or_none()
        if not lab_result:
            raise ValueError("Result not found")
        lab_result.status = ResultStatus.RELEASED
        lab_result.released_at = datetime.now(timezone.utc)
        await self.db.flush()
        return lab_result
