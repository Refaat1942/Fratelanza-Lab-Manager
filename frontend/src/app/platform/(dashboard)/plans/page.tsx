"use client";

import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  name_ar: string;
  tier: string;
  billing_cycle: string;
  price_egp: number;
  max_branches: number;
  max_users: number;
  is_active: boolean;
}

export default function PlansPage() {
  const locale = useAuthStore((s) => s.locale);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    api.get("/platform/plans").then((res) => setPlans(res.data)).catch(() => {});
  }, []);

  const columns: ColumnDef<Plan>[] = [
    { accessorKey: "name", header: locale === "ar" ? "الاسم" : "Name" },
    {
      accessorKey: "tier",
      header: "Tier",
      cell: ({ row }) => <Badge variant="outline">{row.original.tier}</Badge>,
    },
    { accessorKey: "billing_cycle", header: "Billing" },
    {
      accessorKey: "price_egp",
      header: "Price (EGP)",
      cell: ({ row }) => row.original.price_egp.toLocaleString(),
    },
    { accessorKey: "max_branches", header: "Branches" },
    { accessorKey: "max_users", header: "Users" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t(locale, "plans")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "باقات Starter و Professional و Enterprise" : "Starter, Professional, and Enterprise plans"}
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t(locale, "create")}
        </Button>
      </div>
      <DataTable columns={columns} data={plans} searchPlaceholder={t(locale, "search")} />
    </div>
  );
}
