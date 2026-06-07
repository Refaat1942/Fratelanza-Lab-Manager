"use client";

import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  tenant_id?: string;
  created_at: string;
}

export default function AuditPage() {
  const locale = useAuthStore((s) => s.locale);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    api.get("/platform/audit-logs").then((res) => setLogs(res.data)).catch(() => {});
  }, []);

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: "created_at",
      header: "Time",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge>,
    },
    { accessorKey: "entity_type", header: "Entity" },
    { accessorKey: "entity_id", header: "ID" },
    { accessorKey: "tenant_id", header: "Tenant ID" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(locale, "auditLogs")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar" ? "سجل جميع إجراءات مالك المنصة" : "Platform owner action audit trail"}
        </p>
      </div>
      <DataTable columns={columns} data={logs} searchPlaceholder={t(locale, "search")} />
    </div>
  );
}
