from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

from app.api.deps import CurrentTenant, CurrentUser, DbSession, require_permission
from app.schemas.billing import InvoiceCreate, InvoiceListItem, PaymentCreate
from app.schemas.common import MessageResponse, PaginationParams
from app.services.billing_service import BillingService
from app.services.pdf_service import PdfService
from app.utils.date_filter import parse_date_param

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/invoices")
async def list_invoices(
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("billing.read"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    params = PaginationParams(page=page, page_size=page_size)
    result = await BillingService(db).list_invoices(
        tenant.id, params, parse_date_param(date_from), parse_date_param(date_to)
    )
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
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    return await BillingService(db).get_financial_summary(
        tenant.id, parse_date_param(date_from), parse_date_param(date_to)
    )


@router.get("/invoices/{invoice_id}/receipt")
async def download_receipt(
    invoice_id: UUID,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser = require_permission("billing.read"),
):
    try:
        content = await PdfService(db).invoice_receipt_pdf(tenant.id, invoice_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="receipt_{invoice_id}.pdf"'},
    )


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
