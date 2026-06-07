from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.tests import TestCategoryResponse, TestCreate, TestResponse, TestUpdate
from app.services.test_service import TestService

router = APIRouter(prefix="/tests", tags=["Tests"])


@router.get("/categories", response_model=list[TestCategoryResponse])
async def list_categories(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("tests.read"),
):
    categories = await TestService(db).list_categories(tenant.id)
    return [TestCategoryResponse.model_validate(c) for c in categories]


@router.get("")
async def list_tests(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("tests.read"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    category_id: UUID | None = None,
    sort_by: str | None = "name",
    sort_order: str = "asc",
):
    params = PaginationParams(page=page, page_size=page_size, search=search, sort_by=sort_by, sort_order=sort_order)
    result = await TestService(db).list_tests(tenant.id, params, category_id)
    return {
        "items": [TestResponse.model_validate(t) for t in result.items],
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "pages": result.pages,
    }


@router.post("", response_model=TestResponse, status_code=status.HTTP_201_CREATED)
async def create_test(
    data: TestCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("tests.create"),
):
    test = await TestService(db).create_test(tenant.id, data, user.id)
    return TestResponse.model_validate(test)


@router.get("/{test_id}", response_model=TestResponse)
async def get_test(
    test_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("tests.read"),
):
    test = await TestService(db).get_test(tenant.id, test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return TestResponse.model_validate(test)


@router.put("/{test_id}", response_model=TestResponse)
async def update_test(
    test_id: UUID,
    data: TestUpdate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("tests.update"),
):
    test = await TestService(db).update_test(tenant.id, test_id, data, user.id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return TestResponse.model_validate(test)


@router.delete("/{test_id}", response_model=MessageResponse)
async def delete_test(
    test_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("tests.delete"),
):
    deleted = await TestService(db).delete_test(tenant.id, test_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Test not found")
    return MessageResponse(message="Test deleted", message_ar="تم حذف التحليل")
