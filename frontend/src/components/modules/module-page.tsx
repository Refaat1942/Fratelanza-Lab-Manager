"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t, type TranslationKey } from "@/lib/i18n";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

interface ModulePageProps {
  titleKey: TranslationKey;
  descriptionEn: string;
  descriptionAr: string;
  columns: ColumnDef<Record<string, unknown>>[];
  data?: Record<string, unknown>[];
}

export function ModulePage({
  titleKey,
  descriptionEn,
  descriptionAr,
  columns,
  data = [],
}: ModulePageProps) {
  const locale = useAuthStore((s) => s.locale);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t(locale, titleKey)}</h1>
          <p className="text-muted-foreground">{locale === "ar" ? descriptionAr : descriptionEn}</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t(locale, "create")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {locale === "ar" ? "جميع السجلات" : "All Records"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data}
            searchPlaceholder={t(locale, "search")}
            onExport={() => toast.info("Export - Excel/PDF/CSV")}
            onPrint={() => window.print()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
