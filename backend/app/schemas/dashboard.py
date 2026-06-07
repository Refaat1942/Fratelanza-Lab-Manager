from pydantic import BaseModel


class DashboardStats(BaseModel):
    patients: int
    doctors: int
    tests: int
    inventory_items: int
    low_stock_items: int


class FinancialInsight(BaseModel):
    total_invoiced: float
    total_collected: float
    outstanding: float
    invoice_count: int


class ExpenseInsight(BaseModel):
    total_expenses: float
    expense_count: int


class RecentPatient(BaseModel):
    id: str
    full_name: str
    patient_code: str
    created_at: str


class RecentInvoice(BaseModel):
    id: str
    invoice_number: str
    patient_name: str
    total: float
    status: str
    issued_at: str | None


class LowStockItem(BaseModel):
    id: str
    sku: str
    name: str
    total_quantity: float
    reorder_level: float


class OrderInsight(BaseModel):
    pending_orders: int
    completed_orders: int
    in_lab_orders: int


class DashboardInsights(BaseModel):
    stats: DashboardStats
    financial: FinancialInsight
    expenses: ExpenseInsight
    orders: OrderInsight
    recent_patients: list[RecentPatient]
    recent_invoices: list[RecentInvoice]
    low_stock: list[LowStockItem]
    net_profit: float
