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

interface Tenant {
  id: string;
  code: string;
  name: string;
  name_ar?: string;
  email: string;
  status: string;
  created_at: string;
}

export default function TenantsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    api.get("/platform/tenants").then((res) => setTenants(res.data)).catch(() => {});
  }, []);

  const columns: ColumnDef<Tenant>[] = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "name", header: locale === "ar" ? "الاسم" : "Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "active" ? "default" : "destructive"}>
          {row.original.status}
        </Badge>
      ),
    },
    { accessorKey: "created_at", header: "Created" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t(locale, "tenants")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "إدارة المختبرات والاشتراكات" : "Manage laboratories and subscriptions"}
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t(locale, "create")}
        </Button>
      </div>
      <DataTable columns={columns} data={tenants} searchPlaceholder={t(locale, "search")} />
    </div>
  );
}
