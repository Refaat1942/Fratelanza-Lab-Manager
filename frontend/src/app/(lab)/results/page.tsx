"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "order_number", header: "Order #" },
  { accessorKey: "patient_name", header: "Patient" },
  { accessorKey: "test_name", header: "Test" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "ordered_at", header: "Ordered" },
];

export default function ResultsPage() {
  return (
    <ModulePage
      titleKey="results"
      descriptionEn="Enter, verify, and release laboratory test results"
      descriptionAr="إدخال واعتماد وإصدار نتائج التحاليل"
      columns={columns}
    />
  );
}
