"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "referral_date", header: "Date" },
  { accessorKey: "doctor_name", header: "Doctor" },
  { accessorKey: "patient_name", header: "Patient" },
  { accessorKey: "branch", header: "Branch" },
];

export default function ReferralsPage() {
  return (
    <ModulePage
      titleKey="referrals"
      descriptionEn="Referral tracking and doctor performance reports"
      descriptionAr="تتبع الإحالات وتقارير أداء الأطباء"
      columns={columns}
    />
  );
}
