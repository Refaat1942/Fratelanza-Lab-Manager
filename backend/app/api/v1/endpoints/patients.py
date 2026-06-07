from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.patients import (
    PatientCreate,
    PatientResponse,
    PatientUpdate,
    PatientVisitCreate,
    PatientVisitResponse,
)
from app.services.patient_service import PatientService

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("", response_model=dict)
async def list_patients(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("patients.read"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
    branch_id: UUID | None = None,
):
    params = PaginationParams(page=page, page_size=page_size, search=search, sort_by=sort_by, sort_order=sort_order)
    result = await PatientService(db).list_patients(tenant.id, params, branch_id)
    return {
        "items": [PatientResponse.model_validate(p) for p in result.items],
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "pages": result.pages,
    }


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    data: PatientCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("patients.create"),
):
    patient = await PatientService(db).create_patient(tenant.id, data, user.id)
    return PatientResponse.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("patients.read"),
):
    patient = await PatientService(db).get_patient(tenant.id, patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PatientResponse.model_validate(patient)


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: UUID,
    data: PatientUpdate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("patients.update"),
):
    patient = await PatientService(db).update_patient(tenant.id, patient_id, data, user.id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PatientResponse.model_validate(patient)


@router.delete("/{patient_id}", response_model=MessageResponse)
async def delete_patient(
    patient_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("patients.delete"),
):
    deleted = await PatientService(db).delete_patient(tenant.id, patient_id, user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return MessageResponse(message="Patient deleted", message_ar="تم حذف المريض")


@router.post("/visits", response_model=PatientVisitResponse, status_code=status.HTTP_201_CREATED)
async def create_visit(
    data: PatientVisitCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("patients.create"),
):
    visit = await PatientService(db).create_visit(tenant.id, data, user.id)
    return PatientVisitResponse.model_validate(visit)
