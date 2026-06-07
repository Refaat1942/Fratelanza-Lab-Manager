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
import { toast } from "sonner";

interface Test {
  id: string;
  code: string;
  name: string;
  name_ar: string;
  price: number;
  cost: number;
  turnaround_hours: number;
  is_active: boolean;
}

export default function TestsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/tests")
      .then((res) => setTests(res.data.items || []))
      .catch(() => toast.error("Failed to load tests"))
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnDef<Test>[] = [
    { accessorKey: "code", header: "Code" },
    {
      accessorKey: "name",
      header: locale === "ar" ? "الاسم" : "Name",
      cell: ({ row }) => locale === "ar" ? row.original.name_ar : row.original.name,
    },
    {
      accessorKey: "price",
      header: locale === "ar" ? "السعر" : "Price (EGP)",
      cell: ({ row }) => row.original.price.toLocaleString(),
    },
    {
      accessorKey: "cost",
      header: locale === "ar" ? "التكلفة" : "Cost (EGP)",
      cell: ({ row }) => row.original.cost.toLocaleString(),
    },
    { accessorKey: "turnaround_hours", header: "TAT (hrs)" },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t(locale, "tests")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "كتالوج التحاليل بالعربية والإنجليزية" : "Test catalog with Arabic/English names and prices"}
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t(locale, "create")}
        </Button>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DataTable columns={columns} data={tests} searchPlaceholder={t(locale, "search")} onExport={() => toast.info("Export")} />
      )}
    </div>
  );
}
