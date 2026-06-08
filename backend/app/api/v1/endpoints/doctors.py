from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.doctors import DoctorCreate, DoctorResponse, DoctorUpdate
from app.services.doctor_service import DoctorService
from app.utils.date_filter import parse_date_param

router = APIRouter(prefix="/doctors", tags=["Doctors"])


@router.get("")
async def list_doctors(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("doctors.read"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    params = PaginationParams(page=page, page_size=page_size, search=search, sort_by=sort_by, sort_order=sort_order)
    result = await DoctorService(db).list_doctors(
        tenant.id, params, parse_date_param(date_from), parse_date_param(date_to)
    )
    return {
        "items": [DoctorResponse.model_validate(d) for d in result.items],
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "pages": result.pages,
    }


@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor(
    data: DoctorCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("doctors.create"),
):
    doctor = await DoctorService(db).create_doctor(tenant.id, data, user.id)
    return DoctorResponse.model_validate(doctor)


@router.get("/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(
    doctor_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("doctors.read"),
):
    doctor = await DoctorService(db).get_doctor(tenant.id, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return DoctorResponse.model_validate(doctor)


@router.put("/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(
    doctor_id: UUID,
    data: DoctorUpdate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("doctors.update"),
):
    doctor = await DoctorService(db).update_doctor(tenant.id, doctor_id, data, user.id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return DoctorResponse.model_validate(doctor)


@router.delete("/{doctor_id}", response_model=MessageResponse)
async def delete_doctor(
    doctor_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("doctors.delete"),
):
    deleted = await DoctorService(db).delete_doctor(tenant.id, doctor_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return MessageResponse(message="Doctor deleted", message_ar="تم حذف الطبيب")
