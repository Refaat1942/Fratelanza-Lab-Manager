"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";

const reports = [
  { id: "daily", en: "Daily Report", ar: "التقرير اليومي" },
  { id: "monthly", en: "Monthly Report", ar: "التقرير الشهري" },
  { id: "profitability", en: "Profitability Report", ar: "تقرير الربحية" },
  { id: "inventory", en: "Inventory Valuation", ar: "تقييم المخزون" },
  { id: "referrals", en: "Doctor Referrals", ar: "إحالات الأطباء" },
  { id: "patients", en: "Patient Statistics", ar: "إحصائيات المرضى" },
  { id: "branches", en: "Branch Performance", ar: "أداء الفروع" },
];

export default function ReportsPage() {
  const locale = useAuthStore((s) => s.locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(locale, "reports")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar" ? "تقارير يومية وشهرية وسنوية مع تصدير Excel/PDF" : "Daily, monthly, yearly reports with Excel/PDF export"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="text-base">{locale === "ar" ? report.ar : report.en}</CardTitle>
              <CardDescription>Excel, PDF, CSV export</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                {t(locale, "export")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
