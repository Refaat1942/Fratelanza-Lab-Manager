"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "city", header: "City" },
  { accessorKey: "governorate", header: "Governorate" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "is_headquarters", header: "HQ" },
];

export default function BranchesPage() {
  return (
    <ModulePage
      titleKey="branches"
      descriptionEn="Multi-branch operations with separate inventory and revenue"
      descriptionAr="عمليات متعددة الفروع مع مخزون وإيرادات منفصلة"
      columns={columns}
    />
  );
}
