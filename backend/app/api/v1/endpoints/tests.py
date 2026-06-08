from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.common import MessageResponse, PaginationParams
from app.schemas.tests import ResultTemplateField, ResultTemplateUpdate, TestCategoryResponse, TestCreate, TestResponse, TestUpdate
from app.services.test_service import TestService
from app.utils.date_filter import parse_date_param

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
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    params = PaginationParams(page=page, page_size=page_size, search=search, sort_by=sort_by, sort_order=sort_order)
    result = await TestService(db).list_tests(
        tenant.id, params, category_id, parse_date_param(date_from), parse_date_param(date_to)
    )
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


@router.get("/{test_id}/result-template", response_model=list[ResultTemplateField])
async def get_result_template(
    test_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("tests.read"),
):
    templates = await TestService(db).get_result_template(tenant.id, test_id)
    return [
        ResultTemplateField(
            parameter_name=t.parameter_name,
            parameter_name_ar=t.parameter_name_ar,
            unit=t.unit,
            field_type=t.field_type,
            sort_order=t.sort_order,
            options=t.options,
        )
        for t in templates
    ]


@router.put("/{test_id}/result-template", response_model=list[ResultTemplateField])
async def save_result_template(
    test_id: UUID,
    data: ResultTemplateUpdate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("tests.update"),
):
    try:
        templates = await TestService(db).save_result_template(tenant.id, test_id, data)
        return [
            ResultTemplateField(
                parameter_name=t.parameter_name,
                parameter_name_ar=t.parameter_name_ar,
                unit=t.unit,
                field_type=t.field_type,
                sort_order=t.sort_order,
                options=t.options,
            )
            for t in templates
        ]
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


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
