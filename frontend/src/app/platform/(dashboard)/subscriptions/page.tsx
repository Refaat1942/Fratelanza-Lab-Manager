"use client";

import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

interface Subscription {
  subscription_id: string;
  tenant_id: string;
  tenant_code: string;
  tenant_name: string;
  plan_name: string;
  plan_tier: string;
  status: string;
  tenant_status: string;
  expires_at: string;
  auto_renew: boolean;
  amount_paid: number;
  price_egp: number;
}

export default function SubscriptionsPage() {
  const { locale } = useLocale("platform");
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/platform/subscriptions")
      .then((res) => setItems(res.data))
      .catch(() => toast.error("Failed to load subscriptions"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const renew = async (tenantId: string) => {
    try {
      await api.post(`/platform/tenants/${tenantId}/renew`, {});
      toast.success("Subscription renewed");
      load();
    } catch {
      toast.error("Renewal failed");
    }
  };

  const columns: ColumnDef<Subscription>[] = [
    { accessorKey: "tenant_code", header: "Code" },
    { accessorKey: "tenant_name", header: locale === "ar" ? "المختبر" : "Laboratory" },
    { accessorKey: "plan_name", header: locale === "ar" ? "الباقة" : "Plan" },
    {
      accessorKey: "plan_tier",
      header: "Tier",
      cell: ({ row }) => <Badge variant="outline">{row.original.plan_tier}</Badge>,
    },
    {
      accessorKey: "status",
      header: "Sub Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "active" ? "default" : "destructive"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "tenant_status",
      header: "Tenant",
      cell: ({ row }) => (
        <Badge variant={row.original.tenant_status === "active" ? "default" : "secondary"}>
          {row.original.tenant_status}
        </Badge>
      ),
    },
    {
      accessorKey: "expires_at",
      header: "Expires",
      cell: ({ row }) => new Date(row.original.expires_at).toLocaleDateString(),
    },
    {
      accessorKey: "amount_paid",
      header: "Paid (EGP)",
      cell: ({ row }) => row.original.amount_paid.toLocaleString(),
    },
    {
      id: "actions",
      header: t(locale, "actions"),
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => renew(row.original.tenant_id)}>
          <RefreshCw className="h-3 w-3 mr-1" />
          {t(locale, "renew")}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(locale, "subscriptions")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar" ? "إدارة اشتراكات جميع المختبرات" : "Manage all laboratory subscriptions"}
        </p>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DataTable columns={columns} data={items} searchPlaceholder={t(locale, "search")} />
      )}
    </div>
  );
}
