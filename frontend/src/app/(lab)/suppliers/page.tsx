"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "contact_person", header: "Contact" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "email", header: "Email" },
];

export default function SuppliersPage() {
  return (
    <ModulePage
      titleKey="suppliers"
      descriptionEn="Supplier database and contact management"
      descriptionAr="قاعدة بيانات الموردين وإدارة جهات الاتصال"
      columns={columns}
    />
  );
}
