from pydantic import BaseModel


class DashboardStats(BaseModel):
    patients: int
    doctors: int
    tests: int
    inventory_items: int
    low_stock_items: int
