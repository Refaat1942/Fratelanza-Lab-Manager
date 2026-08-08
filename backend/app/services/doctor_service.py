from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.doctors import Doctor, DoctorCommission
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.doctors import DoctorCreate, DoctorUpdate
from app.constants.specialties import resolve_specialty
from app.services.audit_service import AuditService
from app.utils.list_date_filter import filter_by_entry_date
from app.utils.date_filter import apply_date_range


class DoctorService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    async def list_doctors(
        self,
        tenant_id: UUID,
        params: PaginationParams,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> PaginatedResponse:
        query = select(Doctor).where(Doctor.tenant_id == tenant_id, Doctor.deleted_at.is_(None))
        query = filter_by_entry_date(query, Doctor.created_at, date_from, date_to)
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

    def _normalize_create(self, data: DoctorCreate) -> dict:
        payload = data.model_dump(exclude={"specialty_key"})
        name = payload["full_name"].strip()
        payload["full_name"] = name
        payload["full_name_ar"] = payload.get("full_name_ar") or name
        if data.specialty_key:
            en, ar = resolve_specialty(data.specialty_key)
            payload["specialty"] = en
            payload["specialty_ar"] = ar
        return payload

    def _normalize_update(self, data: DoctorUpdate) -> dict:
        payload = data.model_dump(exclude_unset=True, exclude={"specialty_key"})
        if data.specialty_key is not None:
            en, ar = resolve_specialty(data.specialty_key)
            payload["specialty"] = en
            payload["specialty_ar"] = ar
        if "full_name" in payload and payload["full_name"]:
            payload["full_name"] = payload["full_name"].strip()
            if "full_name_ar" not in payload:
                payload["full_name_ar"] = payload["full_name"]
        return payload

    async def accrue_commission_for_invoice(
        self,
        tenant_id: UUID,
        *,
        doctor_id: UUID,
        invoice_id: UUID,
        branch_id: UUID,
        invoice_total: float,
    ) -> DoctorCommission | None:
        doctor = await self.get_doctor(tenant_id, doctor_id)
        if not doctor or not doctor.is_active:
            return None
        rate = float(doctor.commission_rate or 0)
        if rate <= 0:
            return None
        amount = round(float(invoice_total) * rate / 100, 2)
        if amount <= 0:
            return None
        commission = DoctorCommission(
            tenant_id=tenant_id,
            doctor_id=doctor.id,
            invoice_id=invoice_id,
            branch_id=branch_id,
            amount=amount,
            commission_rate=rate,
            notes=f"Auto accrual on invoice",
        )
        self.db.add(commission)
        await self.db.flush()
        return commission

    async def create_doctor(self, tenant_id: UUID, data: DoctorCreate, user_id: UUID) -> Doctor:
        count = (await self.db.execute(select(func.count()).where(Doctor.tenant_id == tenant_id))).scalar() or 0
        doctor = Doctor(tenant_id=tenant_id, code=f"D{count + 1:05d}", **self._normalize_create(data))
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
        for key, value in self._normalize_update(data).items():
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

    async def commission_summary(
        self,
        tenant_id: UUID,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> dict:
        q = select(
            func.coalesce(func.sum(DoctorCommission.amount), 0),
            func.count(DoctorCommission.id),
        ).where(DoctorCommission.tenant_id == tenant_id)
        for clause in apply_date_range(DoctorCommission.created_at, date_from, date_to):
            q = q.where(clause)
        total, count = (await self.db.execute(q)).one()
        return {
            "total_commissions": float(total or 0),
            "commission_count": int(count or 0),
        }
