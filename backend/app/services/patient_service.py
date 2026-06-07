from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patients import Patient, PatientVisit, VisitStatus
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.patients import PatientCreate, PatientUpdate, PatientVisitCreate
from app.services.audit_service import AuditService


class PatientService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    async def list_patients(
        self, tenant_id: UUID, params: PaginationParams, branch_id: Optional[UUID] = None
    ) -> PaginatedResponse:
        query = select(Patient).where(Patient.tenant_id == tenant_id, Patient.deleted_at.is_(None))
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
