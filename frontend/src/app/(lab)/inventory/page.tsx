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

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  name_ar: string;
  category: string;
  unit: string;
  unit_cost: number;
  total_quantity: number;
  reorder_level: number;
  is_active: boolean;
}

export default function InventoryPage() {
  const locale = useAuthStore((s) => s.locale);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/inventory")
      .then((res) => setItems(res.data.items || []))
      .catch(() => toast.error("Failed to load inventory"))
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnDef<InventoryItem>[] = [
    { accessorKey: "sku", header: "SKU" },
    {
      accessorKey: "name",
      header: locale === "ar" ? "الاسم" : "Name",
      cell: ({ row }) => locale === "ar" ? row.original.name_ar : row.original.name,
    },
    {
      accessorKey: "category",
      header: locale === "ar" ? "الفئة" : "Category",
      cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge>,
    },
    {
      accessorKey: "total_quantity",
      header: locale === "ar" ? "الكمية" : "Qty",
      cell: ({ row }) => {
        const low = row.original.total_quantity <= row.original.reorder_level;
        return <span className={low ? "text-amber-600 font-medium" : ""}>{row.original.total_quantity}</span>;
      },
    },
    {
      accessorKey: "unit_cost",
      header: locale === "ar" ? "تكلفة الوحدة" : "Unit Cost",
      cell: ({ row }) => `EGP ${row.original.unit_cost}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t(locale, "inventory")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "مستلزمات المختبر المصرية" : "Egyptian lab consumables with batch tracking"}
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
        <DataTable columns={columns} data={items} searchPlaceholder={t(locale, "search")} onExport={() => toast.info("Export")} />
      )}
    </div>
  );
}
