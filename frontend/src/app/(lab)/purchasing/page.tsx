"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "po_number", header: "PO #" },
  { accessorKey: "supplier", header: "Supplier" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "total_amount", header: "Total (EGP)" },
  { accessorKey: "order_date", header: "Date" },
];

export default function PurchasingPage() {
  return (
    <ModulePage
      titleKey="purchasing"
      descriptionEn="Purchase orders and supplier management"
      descriptionAr="أوامر الشراء وإدارة الموردين"
      columns={columns}
    />
  );
}
