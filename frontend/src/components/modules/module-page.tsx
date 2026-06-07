"use client";

import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { t, type TranslationKey } from "@/lib/i18n";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t(locale, titleKey)}</h1>
        <p className="text-muted-foreground">{locale === "ar" ? descriptionAr : descriptionEn}</p>
      </div>

      {data.length === 0 ? (
        <Card className="border-dashed border-border/60 shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Construction className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">
              {locale === "ar" ? "قيد التطوير" : "Module In Development"}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {locale === "ar"
                ? "هذه الوحدة قيد البناء وسيتم تفعيلها في التحديث القادم."
                : "This module is being built and will be available in an upcoming release."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder={t(locale, "search")}
        />
      )}
    </div>
  );
}
