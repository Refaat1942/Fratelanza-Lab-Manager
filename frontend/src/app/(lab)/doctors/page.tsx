"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "full_name", header: "Name" },
  { accessorKey: "specialty", header: "Specialty" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "commission_rate", header: "Commission %" },
];

export default function DoctorsPage() {
  return (
    <ModulePage
      titleKey="doctors"
      descriptionEn="Doctor database, commissions, and referral tracking"
      descriptionAr="قاعدة بيانات الأطباء والعمولات وتتبع الإحالات"
      columns={columns}
    />
  );
}
