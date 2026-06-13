"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { downloadDailyOperationsPdf, exportReportExcel } from "@/lib/export";
import { toast } from "sonner";

const reports = [
  { id: "daily", en: "Daily Operations Report", ar: "تقرير العمليات اليومي", pdf: true },
  { id: "monthly", en: "Monthly Operations Report", ar: "تقرير العمليات الشهري", pdf: true },
  { id: "profitability", en: "Profitability Report", ar: "تقرير الربحية", pdf: false },
  { id: "inventory", en: "Inventory Valuation", ar: "تقييم المخزون", pdf: false },
  { id: "referrals", en: "Doctor Referrals", ar: "إحالات الأطباء", pdf: false },
  { id: "patients", en: "Patient Statistics", ar: "إحصائيات المرضى", pdf: false },
  { id: "branches", en: "Branch Performance", ar: "أداء الفروع", pdf: false },
  { id: "labs_done", en: "Completed Lab Tests", ar: "التحاليل المنجزة", pdf: false },
];

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function todayRange() {
  const d = new Date().toISOString().slice(0, 10);
  return { from: d, to: d };
}

export default function ReportsPage() {
  const locale = useAuthStore((s) => s.locale);
  const defaults = defaultRange();
  const [ranges, setRanges] = useState<Record<string, { from: string; to: string }>>(
    Object.fromEntries(
      reports.map((r) => [r.id, r.id === "daily" ? todayRange() : { ...defaults }])
    )
  );
  const [exporting, setExporting] = useState<string | null>(null);

  const exportExcel = async (id: string) => {
    setExporting(`${id}-excel`);
    try {
      const range = ranges[id];
      await exportReportExcel(id, range.from, range.to);
      toast.success(locale === "ar" ? "تم تصدير Excel" : "Excel exported");
    } catch {
      toast.error(locale === "ar" ? "فشل التصدير" : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async (id: string) => {
    setExporting(`${id}-pdf`);
    try {
      const range = ranges[id];
      await downloadDailyOperationsPdf(range.from, range.to);
      toast.success(locale === "ar" ? "تم تصدير PDF" : "PDF exported");
    } catch {
      toast.error(locale === "ar" ? "فشل تصدير PDF" : "PDF export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(locale, "reports")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar"
            ? "تقرير العمليات اليومي بالعربية — عدد الفواتير، الإجمالي، المحصّل، المتبقي، والصافي (Excel و PDF)"
            : "Arabic daily operations report — invoices, gross, collected, remaining, net (Excel & PDF)"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="text-base">{locale === "ar" ? report.ar : report.en}</CardTitle>
              <CardDescription>
                {report.pdf
                  ? locale === "ar"
                    ? "Excel + PDF بالعربية"
                    : "Arabic Excel + PDF"
                  : locale === "ar"
                    ? "تصدير Excel"
                    : "Excel export"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{locale === "ar" ? "من" : "From"}</Label>
                  <Input
                    type="date"
                    value={ranges[report.id].from}
                    onChange={(e) =>
                      setRanges((prev) => ({
                        ...prev,
                        [report.id]: { ...prev[report.id], from: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{locale === "ar" ? "إلى" : "To"}</Label>
                  <Input
                    type="date"
                    value={ranges[report.id].to}
                    onChange={(e) =>
                      setRanges((prev) => ({
                        ...prev,
                        [report.id]: { ...prev[report.id], to: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={exporting === `${report.id}-excel`}
                  onClick={() => exportExcel(report.id)}
                >
                  <Download className="me-2 h-4 w-4" />
                  Excel
                </Button>
                {report.pdf && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={exporting === `${report.id}-pdf`}
                    onClick={() => exportPdf(report.id)}
                  >
                    <FileText className="me-2 h-4 w-4" />
                    PDF
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
