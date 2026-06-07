"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "entry_number", header: "Entry #" },
  { accessorKey: "entry_date", header: "Date" },
  { accessorKey: "description", header: "Description" },
  { accessorKey: "debit", header: "Debit" },
  { accessorKey: "credit", header: "Credit" },
];

export default function AccountingPage() {
  return (
    <ModulePage
      titleKey="accounting"
      descriptionEn="Revenue, expenses, profit, cash flow, and daily closing"
      descriptionAr="الإيرادات والمصروفات والأرباح والتدفق النقدي والإقفال اليومي"
      columns={columns}
    />
  );
}
