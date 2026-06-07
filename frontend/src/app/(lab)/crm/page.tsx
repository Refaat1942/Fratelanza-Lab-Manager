"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "full_name", header: "Name" },
  { accessorKey: "organization", header: "Organization" },
  { accessorKey: "contact_type", header: "Type" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "source", header: "Source" },
];

export default function CrmPage() {
  return (
    <ModulePage
      titleKey="crm"
      descriptionEn="Customer relationship management and lead tracking"
      descriptionAr="إدارة علاقات العملاء وتتبع العملاء المحتملين"
      columns={columns}
    />
  );
}
