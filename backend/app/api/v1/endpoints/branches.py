from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.branches import BranchCreate, BranchResponse, BranchUpdate
from app.schemas.common import MessageResponse
from app.services.branch_service import BranchService

router = APIRouter(prefix="/branches", tags=["Branches"])


@router.get("", response_model=list[BranchResponse])
async def list_branches(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("settings.manage"),
):
    branches = await BranchService(db).list_branches(tenant.id)
    return [BranchResponse.model_validate(b) for b in branches]


@router.post("", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
async def create_branch(
    data: BranchCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("settings.manage"),
):
    branch = await BranchService(db).create_branch(tenant.id, data)
    await db.commit()
    return BranchResponse.model_validate(branch)


@router.put("/{branch_id}", response_model=BranchResponse)
async def update_branch(
    branch_id: UUID,
    data: BranchUpdate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("settings.manage"),
):
    branch = await BranchService(db).update_branch(tenant.id, branch_id, data)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    await db.commit()
    return BranchResponse.model_validate(branch)


@router.delete("/{branch_id}", response_model=MessageResponse)
async def delete_branch(
    branch_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("settings.manage"),
):
    deleted = await BranchService(db).delete_branch(tenant.id, branch_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Branch not found")
    await db.commit()
    return MessageResponse(message="Branch deleted", message_ar="تم حذف الفرع")
