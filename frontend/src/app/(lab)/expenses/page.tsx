"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "expense_number", header: "#" },
  { accessorKey: "description", header: "Description" },
  { accessorKey: "category", header: "Category" },
  { accessorKey: "amount", header: "Amount (EGP)" },
  { accessorKey: "expense_date", header: "Date" },
];

export default function ExpensesPage() {
  return (
    <ModulePage
      titleKey="expenses"
      descriptionEn="Track laboratory expenses by branch and category"
      descriptionAr="تتبع مصروفات المختبر حسب الفرع والفئة"
      columns={columns}
    />
  );
}
