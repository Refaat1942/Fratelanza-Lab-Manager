from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.doctors import Doctor, Referral
from app.models.patients import Patient
from app.models.tenant_config import Branch
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.referrals import ReferralCreate
from app.utils.list_date_filter import filter_by_entry_date


class ReferralService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_referrals(
        self,
        tenant_id: UUID,
        params: PaginationParams,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> PaginatedResponse:
        query = (
            select(Referral, Doctor, Patient)
            .join(Doctor, Referral.doctor_id == Doctor.id)
            .join(Patient, Referral.patient_id == Patient.id)
            .where(Referral.tenant_id == tenant_id)
            .order_by(Referral.referral_date.desc())
        )
        query = filter_by_entry_date(query, Referral.referral_date, date_from, date_to)
        count_query = select(Referral.id).where(Referral.tenant_id == tenant_id)
        count_query = filter_by_entry_date(count_query, Referral.referral_date, date_from, date_to)
        count = await self.db.scalar(select(func.count()).select_from(count_query.subquery()))
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
        items = []
        for ref, doctor, patient in (await self.db.execute(query)).all():
            items.append({
                "id": ref.id,
                "doctor_id": doctor.id,
                "doctor_name": doctor.full_name,
                "patient_id": patient.id,
                "patient_name": patient.full_name,
                "referral_date": ref.referral_date,
                "notes": ref.notes,
            })
        total = count or 0
        pages = (total + params.page_size - 1) // params.page_size if params.page_size else 0
        return PaginatedResponse(items=items, total=total, page=params.page, page_size=params.page_size, pages=pages)

    async def create_referral(self, tenant_id: UUID, data: ReferralCreate) -> Referral:
        branch_id = data.branch_id or await self.db.scalar(
            select(Branch.id).where(Branch.tenant_id == tenant_id, Branch.deleted_at.is_(None)).limit(1)
        )
        ref = Referral(
            tenant_id=tenant_id,
            doctor_id=data.doctor_id,
            patient_id=data.patient_id,
            branch_id=branch_id,
            referral_date=datetime.now(timezone.utc),
            notes=data.notes,
        )
        self.db.add(ref)
        await self.db.flush()
        return ref

    async def delete_referral(self, tenant_id: UUID, referral_id: UUID) -> bool:
        ref = await self.db.scalar(select(Referral).where(Referral.id == referral_id, Referral.tenant_id == tenant_id))
        if not ref:
            return False
        await self.db.delete(ref)
        await self.db.flush()
        return True
