"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "name", header: "Campaign" },
  { accessorKey: "channel", header: "Channel" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "start_date", header: "Start" },
  { accessorKey: "budget", header: "Budget (EGP)" },
];

export default function MarketingPage() {
  return (
    <ModulePage
      titleKey="marketing"
      descriptionEn="Marketing campaigns and outreach tracking"
      descriptionAr="حملات التسويق وتتبع التواصل"
      columns={columns}
    />
  );
}
