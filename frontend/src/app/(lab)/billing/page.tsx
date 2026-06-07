"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "invoice_number", header: "Invoice #" },
  { accessorKey: "patient_name", header: "Patient" },
  { accessorKey: "total", header: "Total (EGP)" },
  { accessorKey: "paid_amount", header: "Paid" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "issued_at", header: "Date" },
];

export default function BillingPage() {
  return (
    <ModulePage
      titleKey="billing"
      descriptionEn="Patient invoicing, payments, and receivables"
      descriptionAr="فواتير المرضى والمدفوعات والذمم المدينة"
      columns={columns}
    />
  );
}
