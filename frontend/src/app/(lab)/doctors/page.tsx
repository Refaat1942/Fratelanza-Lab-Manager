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

interface Doctor {
  id: string;
  code: string;
  full_name: string;
  full_name_ar?: string;
  specialty?: string;
  phone?: string;
  commission_rate: number;
  is_active: boolean;
}

export default function DoctorsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/doctors")
      .then((res) => setDoctors(res.data.items || []))
      .catch(() => toast.error("Failed to load doctors"))
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnDef<Doctor>[] = [
    { accessorKey: "code", header: locale === "ar" ? "الكود" : "Code" },
    {
      accessorKey: "full_name",
      header: locale === "ar" ? "الاسم" : "Name",
      cell: ({ row }) => locale === "ar" ? row.original.full_name_ar || row.original.full_name : row.original.full_name,
    },
    { accessorKey: "specialty", header: locale === "ar" ? "التخصص" : "Specialty" },
    { accessorKey: "phone", header: locale === "ar" ? "الهاتف" : "Phone" },
    {
      accessorKey: "commission_rate",
      header: locale === "ar" ? "العمولة %" : "Commission %",
      cell: ({ row }) => `${row.original.commission_rate}%`,
    },
    {
      accessorKey: "is_active",
      header: locale === "ar" ? "الحالة" : "Status",
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
          <h1 className="text-3xl font-bold">{t(locale, "doctors")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "قاعدة بيانات الأطباء والعمولات" : "Doctor database, commissions, and referrals"}
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
        <DataTable columns={columns} data={doctors} searchPlaceholder={t(locale, "search")} onExport={() => toast.info("Export")} />
      )}
    </div>
  );
}
