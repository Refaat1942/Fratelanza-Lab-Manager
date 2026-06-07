"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "sku", header: "SKU" },
  { accessorKey: "name", header: "Name (EN)" },
  { accessorKey: "name_ar", header: "Name (AR)" },
  { accessorKey: "category", header: "Category" },
  { accessorKey: "quantity", header: "Qty" },
  { accessorKey: "unit_cost", header: "Unit Cost" },
  { accessorKey: "expiry_date", header: "Expiry" },
];

export default function InventoryPage() {
  return (
    <ModulePage
      titleKey="inventory"
      descriptionEn="Egyptian lab consumables with batch and expiry tracking"
      descriptionAr="مستلزمات المختبر المصرية مع تتبع الدفعات وتواريخ الانتهاء"
      columns={columns}
    />
  );
}
