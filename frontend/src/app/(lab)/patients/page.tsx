"use client";

import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Patient {
  id: string;
  patient_code: string;
  full_name: string;
  full_name_ar?: string;
  phone?: string;
  national_id?: string;
  gender?: string;
  created_at: string;
}

export default function PatientsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/patients")
      .then((res) => setPatients(res.data.items || []))
      .catch(() => toast.error("Failed to load patients"))
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnDef<Patient>[] = [
    { accessorKey: "patient_code", header: locale === "ar" ? "الكود" : "Code" },
    {
      accessorKey: "full_name",
      header: locale === "ar" ? "الاسم" : "Name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{locale === "ar" ? row.original.full_name_ar || row.original.full_name : row.original.full_name}</div>
        </div>
      ),
    },
    { accessorKey: "phone", header: locale === "ar" ? "الهاتف" : "Phone" },
    { accessorKey: "national_id", header: locale === "ar" ? "الرقم القومي" : "National ID" },
    {
      accessorKey: "gender",
      header: locale === "ar" ? "النوع" : "Gender",
      cell: ({ row }) =>
        row.original.gender ? (
          <Badge variant="outline">{row.original.gender}</Badge>
        ) : (
          "-"
        ),
    },
    {
      id: "actions",
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>{t(locale, "edit")}</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">{t(locale, "delete")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t(locale, "patients")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "إدارة سجل المرضى والزيارات" : "Manage patient records and visits"}
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
        <DataTable
          columns={columns}
          data={patients}
          searchPlaceholder={t(locale, "search")}
          onExport={() => toast.info("Export feature - connect to API")}
          onPrint={() => window.print()}
        />
      )}
    </div>
  );
}
