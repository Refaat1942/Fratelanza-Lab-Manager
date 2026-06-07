"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Name (EN)" },
  { accessorKey: "name_ar", header: "Name (AR)" },
  { accessorKey: "category", header: "Category" },
  { accessorKey: "price", header: "Price (EGP)" },
  { accessorKey: "cost", header: "Cost (EGP)" },
  { accessorKey: "turnaround_hours", header: "TAT (hrs)" },
];

export default function TestsPage() {
  return (
    <ModulePage
      titleKey="tests"
      descriptionEn="Test catalog with Arabic/English names, prices, and reference ranges"
      descriptionAr="كتالوج التحاليل بالعربية والإنجليزية والأسعار والمديات المرجعية"
      columns={columns}
    />
  );
}
