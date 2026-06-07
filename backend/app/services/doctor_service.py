from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.doctors import Doctor
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.doctors import DoctorCreate, DoctorUpdate
from app.services.audit_service import AuditService


class DoctorService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    async def list_doctors(self, tenant_id: UUID, params: PaginationParams) -> PaginatedResponse:
        query = select(Doctor).where(Doctor.tenant_id == tenant_id, Doctor.deleted_at.is_(None))
        if params.search:
            term = f"%{params.search}%"
            query = query.where(
                or_(
                    Doctor.full_name.ilike(term),
                    Doctor.full_name_ar.ilike(term),
                    Doctor.phone.ilike(term),
                    Doctor.code.ilike(term),
                    Doctor.specialty.ilike(term),
                )
            )
        count_result = await self.db.execute(select(func.count()).select_from(query.subquery()))
        total = count_result.scalar() or 0
        sort_col = getattr(Doctor, params.sort_by or "created_at", Doctor.created_at)
        query = query.order_by(sort_col.desc() if params.sort_order == "desc" else sort_col.asc())
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        result = await self.db.execute(query)
        items = result.scalars().all()
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def get_doctor(self, tenant_id: UUID, doctor_id: UUID) -> Optional[Doctor]:
        result = await self.db.execute(
            select(Doctor).where(Doctor.id == doctor_id, Doctor.tenant_id == tenant_id, Doctor.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def create_doctor(self, tenant_id: UUID, data: DoctorCreate, user_id: UUID) -> Doctor:
        count = (await self.db.execute(select(func.count()).where(Doctor.tenant_id == tenant_id))).scalar() or 0
        doctor = Doctor(tenant_id=tenant_id, code=f"D{count + 1:05d}", **data.model_dump())
        self.db.add(doctor)
        await self.db.flush()
        await self.audit.log(
            tenant_id=tenant_id, user_id=user_id, action="create", module="doctors",
            entity_type="doctor", entity_id=str(doctor.id), new_values=data.model_dump(mode="json"),
        )
        return doctor

    async def update_doctor(self, tenant_id: UUID, doctor_id: UUID, data: DoctorUpdate, user_id: UUID) -> Optional[Doctor]:
        doctor = await self.get_doctor(tenant_id, doctor_id)
        if not doctor:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(doctor, key, value)
        await self.db.flush()
        await self.audit.log(
            tenant_id=tenant_id, user_id=user_id, action="update", module="doctors",
            entity_type="doctor", entity_id=str(doctor.id),
            new_values=data.model_dump(exclude_unset=True, mode="json"),
        )
        return doctor

    async def delete_doctor(self, tenant_id: UUID, doctor_id: UUID, user_id: UUID) -> bool:
        doctor = await self.get_doctor(tenant_id, doctor_id)
        if not doctor:
            return False
        doctor.deleted_at = func.now()
        await self.audit.log(
            tenant_id=tenant_id, user_id=user_id, action="delete", module="doctors",
            entity_type="doctor", entity_id=str(doctor.id),
        )
        return True
