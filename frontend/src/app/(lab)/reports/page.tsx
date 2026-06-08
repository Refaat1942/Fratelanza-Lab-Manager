"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangeFilter, type DateRange } from "@/components/filters/date-range-filter";
import { Download, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { exportPlainRowsToExcel } from "@/lib/table-export";
import { toast } from "sonner";

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
  const [ranges, setRanges] = useState<Record<string, DateRange>>({});
  const [exporting, setExporting] = useState<string | null>(null);

  const updateRange = (reportId: string, value: DateRange) => {
    setRanges((current) => ({ ...current, [reportId]: value }));
  };

  const filterRowsByDate = (
    rows: Record<string, unknown>[],
    range: DateRange,
    dateKeys: string[]
  ) => {
    if (!range.from && !range.to) return rows;
    const from = range.from ? new Date(`${range.from}T00:00:00`) : null;
    const to = range.to ? new Date(`${range.to}T23:59:59`) : null;

    return rows.filter((row) => {
      const raw = dateKeys.map((key) => row[key]).find(Boolean);
      if (!raw) return false;
      const date = new Date(String(raw));
      if (Number.isNaN(date.getTime())) return false;
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  };

  const fetchRows = async (reportId: string, range: DateRange) => {
    if (["daily", "monthly", "profitability"].includes(reportId)) {
      const [billing, expenses] = await Promise.all([
        api.get("/billing/summary"),
        api.get("/expenses/summary"),
      ]);
      const collected = billing.data.total_collected || 0;
      const expenseTotal = expenses.data.total_expenses || 0;

      return [
        { metric: "date_from", value: range.from || "all" },
        { metric: "date_to", value: range.to || "all" },
        { metric: "total_invoiced", value: billing.data.total_invoiced || 0 },
        { metric: "total_collected", value: collected },
        { metric: "outstanding", value: billing.data.outstanding || 0 },
        { metric: "invoice_count", value: billing.data.invoice_count || 0 },
        { metric: "total_expenses", value: expenseTotal },
        { metric: "expense_count", value: expenses.data.expense_count || 0 },
        { metric: "net_profit", value: collected - expenseTotal },
      ];
    }

    const endpointByReport: Record<string, { path: string; dateKeys: string[] }> = {
      inventory: { path: "/inventory?page_size=100", dateKeys: ["created_at"] },
      referrals: { path: "/referrals?page_size=100", dateKeys: ["referral_date", "created_at"] },
      patients: { path: "/patients?page_size=100", dateKeys: ["created_at"] },
      branches: { path: "/branches", dateKeys: ["created_at"] },
    };

    const config = endpointByReport[reportId];
    if (!config) return [];

    const { data } = await api.get(config.path);
    const rows = (Array.isArray(data) ? data : data.items || []) as Record<string, unknown>[];
    return filterRowsByDate(rows, range, config.dateKeys);
  };

  const exportReport = async (reportId: string) => {
    const range = ranges[reportId] || { from: "", to: "" };
    setExporting(reportId);
    try {
      const rows = await fetchRows(reportId, range);
      exportPlainRowsToExcel(rows, `${reportId}-report.xls`);
      toast.success(locale === "ar" ? "تم تحميل ملف Excel" : "Excel report downloaded");
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(locale, "reports")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar" ? "تقارير بتاريخ محدد مع تحميل Excel فقط" : "Date-filtered reports with Excel-only downloads"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="text-base">{locale === "ar" ? report.ar : report.en}</CardTitle>
              <CardDescription>{locale === "ar" ? "تصفية تاريخ وتحميل Excel فقط" : "Date filter and Excel export only"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DateRangeFilter
                value={ranges[report.id] || { from: "", to: "" }}
                onChange={(value) => updateRange(report.id, value)}
                locale={locale}
              />
              <Button variant="outline" size="sm" onClick={() => exportReport(report.id)} disabled={exporting === report.id}>
                {exporting === report.id ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="me-2 h-4 w-4" />
                )}
                {t(locale, "exportExcel")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
