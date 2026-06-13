from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patients import Patient, PatientVisit, VisitStatus
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.patients import PatientCreate, PatientUpdate, PatientVisitCreate
from app.schemas.patients import (
    PatientQuickVisitCreate,
    PatientQuickVisitResponse,
    format_patient_age_note,
)
from app.schemas.results import LabOrderCreate
from app.schemas.billing import InvoiceCreate, InvoiceItemCreate
from app.services.results_service import ResultsService
from app.services.billing_service import BillingService
from app.models.tests import Test
from app.models.orders import LabOrderItem
from app.services.audit_service import AuditService
from app.utils.date_filter import apply_date_range


class PatientService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    async def list_patients(
        self,
        tenant_id: UUID,
        params: PaginationParams,
        branch_id: Optional[UUID] = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> PaginatedResponse:
        query = select(Patient).where(Patient.tenant_id == tenant_id, Patient.deleted_at.is_(None))
        for clause in apply_date_range(Patient.created_at, date_from, date_to):
            query = query.where(clause)
        if branch_id:
            query = query.where(Patient.branch_id == branch_id)
        if params.search:
            term = f"%{params.search}%"
            query = query.where(
                or_(
                    Patient.full_name.ilike(term),
                    Patient.full_name_ar.ilike(term),
                    Patient.phone.ilike(term),
                    Patient.national_id.ilike(term),
                    Patient.patient_code.ilike(term),
                )
            )
        count_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = count_result.scalar() or 0
        sort_col = getattr(Patient, params.sort_by or "created_at", Patient.created_at)
        query = query.order_by(sort_col.desc() if params.sort_order == "desc" else sort_col.asc())
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        result = await self.db.execute(query)
        items = result.scalars().all()
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def get_patient(self, tenant_id: UUID, patient_id: UUID) -> Optional[Patient]:
        result = await self.db.execute(
            select(Patient).where(
                Patient.id == patient_id, Patient.tenant_id == tenant_id, Patient.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def create_patient(
        self, tenant_id: UUID, data: PatientCreate, user_id: UUID, branch_id: Optional[UUID] = None
    ) -> Patient:
        count_result = await self.db.execute(
            select(func.count()).where(Patient.tenant_id == tenant_id)
        )
        count = (count_result.scalar() or 0) + 1
        patient = Patient(
            tenant_id=tenant_id,
            branch_id=data.branch_id or branch_id,
            patient_code=f"P{count:06d}",
            **data.model_dump(exclude={"branch_id"}),
        )
        self.db.add(patient)
        await self.db.flush()
        await self.audit.log(
            tenant_id=tenant_id,
            user_id=user_id,
            action="create",
            module="patients",
            entity_type="patient",
            entity_id=str(patient.id),
            new_values=data.model_dump(mode="json"),
        )
        return patient

    async def update_patient(
        self, tenant_id: UUID, patient_id: UUID, data: PatientUpdate, user_id: UUID
    ) -> Optional[Patient]:
        patient = await self.get_patient(tenant_id, patient_id)
        if not patient:
            return None
        old = {k: getattr(patient, k) for k in data.model_dump(exclude_unset=True)}
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(patient, key, value)
        await self.db.flush()
        await self.audit.log(
            tenant_id=tenant_id,
            user_id=user_id,
            action="update",
            module="patients",
            entity_type="patient",
            entity_id=str(patient.id),
            old_values=old,
            new_values=data.model_dump(exclude_unset=True, mode="json"),
        )
        return patient

    async def delete_patient(self, tenant_id: UUID, patient_id: UUID, user_id: UUID) -> bool:
        patient = await self.get_patient(tenant_id, patient_id)
        if not patient:
            return False
        patient.deleted_at = func.now()
        await self.audit.log(
            tenant_id=tenant_id,
            user_id=user_id,
            action="delete",
            module="patients",
            entity_type="patient",
            entity_id=str(patient.id),
        )
        return True

    async def create_visit(self, tenant_id: UUID, data: PatientVisitCreate, user_id: UUID) -> PatientVisit:
        from datetime import datetime, timezone

        count_result = await self.db.execute(
            select(func.count()).where(PatientVisit.tenant_id == tenant_id)
        )
        count = (count_result.scalar() or 0) + 1
        visit = PatientVisit(
            tenant_id=tenant_id,
            patient_id=data.patient_id,
            branch_id=data.branch_id,
            visit_number=f"V{count:06d}",
            visit_date=datetime.now(timezone.utc),
            status=VisitStatus.REGISTERED,
            referring_doctor_id=data.referring_doctor_id,
            notes=data.notes,
        )
        self.db.add(visit)
        await self.db.flush()
        await self.audit.log(
            tenant_id=tenant_id,
            user_id=user_id,
            action="create",
            module="patients",
            entity_type="patient_visit",
            entity_id=str(visit.id),
        )
        return visit

    async def quick_visit(
        self, tenant_id: UUID, data: PatientQuickVisitCreate, user_id: UUID
    ) -> PatientQuickVisitResponse:
        """Create/update patient, lab order, and invoice in one step."""
        if data.patient_id:
            patient = await self.get_patient(tenant_id, data.patient_id)
            if not patient:
                raise ValueError("Patient not found")
            patient.full_name = data.full_name.strip()
            patient.phone = data.phone.strip() if data.phone and data.phone.strip() else None
            if data.age is not None:
                patient.notes = format_patient_age_note(data.age)
            await self.db.flush()
        else:
            patient = await self.create_patient(
                tenant_id,
                PatientCreate(
                    full_name=data.full_name.strip(),
                    phone=data.phone.strip() if data.phone and data.phone.strip() else None,
                    notes=format_patient_age_note(data.age),
                ),
                user_id,
            )

        for test_id in data.test_ids:
            test = await self.db.get(Test, test_id)
            if not test or test.tenant_id != tenant_id or test.deleted_at:
                raise ValueError("One or more tests were not found")

        order = await ResultsService(self.db).create_order(
            tenant_id,
            LabOrderCreate(patient_id=patient.id, test_ids=data.test_ids),
            user_id,
        )

        items_result = await self.db.execute(
            select(LabOrderItem).where(LabOrderItem.order_id == order.id)
        )
        order_items = list(items_result.scalars().all())
        total_price = sum(float(i.price) for i in order_items)
        total_cost = sum(float(i.cost or 0) for i in order_items)

        if data.discount_percent is not None and data.discount_percent > 0:
            discount_amount = round(total_price * data.discount_percent / 100, 2)
        else:
            discount_amount = float(data.discount)
        discount_amount = min(discount_amount, total_price)

        invoice_items: list[InvoiceItemCreate] = []
        for item in order_items:
            test = await self.db.get(Test, item.test_id)
            invoice_items.append(
                InvoiceItemCreate(
                    description=test.name if test else "Test",
                    unit_price=float(item.price),
                    quantity=1,
                    test_id=item.test_id,
                )
            )

        invoice = await BillingService(self.db).create_invoice(
            tenant_id,
            InvoiceCreate(
                patient_id=patient.id,
                visit_id=order.visit_id,
                order_id=order.id,
                discount=discount_amount,
                items=invoice_items,
            ),
            user_id,
        )

        await self.audit.log(
            tenant_id=tenant_id,
            user_id=user_id,
            action="quick_visit",
            module="patients",
            entity_type="patient",
            entity_id=str(patient.id),
            new_values={
                "order_id": str(order.id),
                "invoice_id": str(invoice.id),
                "test_count": len(order_items),
                "total_price": total_price,
            },
        )

        return PatientQuickVisitResponse(
            patient_id=patient.id,
            patient_code=patient.patient_code,
            order_id=order.id,
            order_number=order.order_number,
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            total_price=total_price - discount_amount,
            total_cost=total_cost,
            margin=total_price - discount_amount - total_cost,
            test_count=len(order_items),
        )
