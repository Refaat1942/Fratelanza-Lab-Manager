from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.billing import InvoiceCreate, InvoiceListItem, PaymentCreate
from app.schemas.common import MessageResponse, PaginationParams
from app.services.billing_service import BillingService

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/invoices")
async def list_invoices(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("billing.read"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    params = PaginationParams(page=page, page_size=page_size)
    result = await BillingService(db).list_invoices(tenant.id, params)
    return {
        "items": [InvoiceListItem.model_validate(i) for i in result.items],
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "pages": result.pages,
    }


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
async def create_invoice(
    data: InvoiceCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("billing.create"),
):
    try:
        invoice = await BillingService(db).create_invoice(tenant.id, data, user.id)
        return {"id": str(invoice.id), "invoice_number": invoice.invoice_number, "total": float(invoice.total)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoices/{invoice_id}/payments")
async def record_payment(
    invoice_id: UUID,
    data: PaymentCreate,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("billing.create"),
):
    try:
        invoice = await BillingService(db).add_payment(tenant.id, invoice_id, data, user.id)
        return {"paid_amount": float(invoice.paid_amount), "status": invoice.status.value}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/summary")
async def financial_summary(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("billing.read"),
):
    return await BillingService(db).get_financial_summary(tenant.id)


@router.get("/invoices/{invoice_id}")
async def get_invoice_detail(
    invoice_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("billing.read"),
):
    detail = await BillingService(db).get_invoice_detail(tenant.id, invoice_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return detail


@router.delete("/invoices/{invoice_id}", response_model=MessageResponse)
async def delete_invoice(
    invoice_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("billing.create"),
):
    deleted = await BillingService(db).delete_invoice(tenant.id, invoice_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return MessageResponse(message="Invoice cancelled", message_ar="تم إلغاء الفاتورة")
