"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Printer } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { downloadExcelFile, printTableDocument, type ExportColumn, type ExportRow } from "@/lib/export";
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

const reportSources: Record<string, string> = {
  inventory: "/inventory?page_size=100",
  referrals: "/referrals?page_size=100",
  patients: "/patients?page_size=100",
  branches: "/branches?page_size=100",
};

const dateKeys = ["issued_at", "expense_date", "created_at", "referral_date", "order_date", "updated_at", "date"];

function getDateValue(row: ExportRow): Date | null {
  for (const key of dateKeys) {
    const raw = row[key];
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

function inRange(row: ExportRow, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const value = getDateValue(row);
  if (!value) return false;
  if (from && value < new Date(from)) return false;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (value > end) return false;
  }
  return true;
}

function pickColumns(rows: ExportRow[], locale: "ar" | "en"): ExportColumn[] {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
    .filter((key) => !["id", "tenant_id", "branch_id", "patient_id", "supplier_id", "category_id"].includes(key))
    .slice(0, 12);
  return keys.map((key) => ({ key, header: locale === "ar" ? key.replaceAll("_", " ") : key.replaceAll("_", " ") }));
}

export default function ReportsPage() {
  const locale = useAuthStore((s) => s.locale);
  const today = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState<Record<string, { from: string; to: string }>>(() => (
    Object.fromEntries(reports.map((report) => [report.id, { from: report.id === "daily" ? today : "", to: report.id === "daily" ? today : "" }]))
  ));
  const [loading, setLoading] = useState<string | null>(null);

  const setReportFilter = (id: string, patch: Partial<{ from: string; to: string }>) => {
    setFilters((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const fetchItems = async (path: string): Promise<ExportRow[]> => {
    const { data } = await api.get(path);
    if (Array.isArray(data)) return data as ExportRow[];
    return (data.items || []) as ExportRow[];
  };

  const fetchReportRows = async (reportId: string): Promise<ExportRow[]> => {
    const filter = filters[reportId] || { from: "", to: "" };
    if (reportId === "daily") {
      const [invoices, expenses, results] = await Promise.all([
        fetchItems("/billing/invoices?page_size=100"),
        fetchItems("/expenses?page_size=100"),
        fetchItems("/results?page_size=100"),
      ]);
      return [
        ...invoices.map((row) => ({
          operation: locale === "ar" ? "فاتورة" : "Invoice",
          reference: row.invoice_number,
          name: row.patient_name,
          amount: row.total,
          status: row.status,
          issued_at: row.issued_at || row.created_at,
        })),
        ...expenses.map((row) => ({
          operation: locale === "ar" ? "مصروف" : "Expense",
          reference: row.expense_number,
          name: row.description,
          amount: row.amount,
          status: row.payment_method,
          expense_date: row.expense_date,
        })),
        ...results.map((row) => ({
          operation: locale === "ar" ? "نتيجة" : "Result",
          reference: row.order_number,
          name: row.patient_name,
          amount: "",
          status: row.status,
          created_at: row.created_at,
        })),
      ].filter((row) => inRange(row, filter.from, filter.to));
    }

    if (reportId === "monthly" || reportId === "profitability") {
      const [invoices, expenses] = await Promise.all([
        fetchItems("/billing/invoices?page_size=100"),
        fetchItems("/expenses?page_size=100"),
      ]);
      return [
        ...invoices.map((row) => ({
          type: locale === "ar" ? "إيراد" : "Revenue",
          reference: row.invoice_number,
          name: row.patient_name,
          amount: row.total,
          collected: row.paid_amount,
          issued_at: row.issued_at || row.created_at,
        })),
        ...expenses.map((row) => ({
          type: locale === "ar" ? "مصروف" : "Expense",
          reference: row.expense_number,
          name: row.description,
          amount: -Number(row.amount || 0),
          collected: "",
          expense_date: row.expense_date,
        })),
      ].filter((row) => inRange(row, filter.from, filter.to));
    }

    const source = reportSources[reportId];
    if (!source) return [];
    return (await fetchItems(source)).filter((row) => inRange(row, filter.from, filter.to));
  };

  const exportReport = async (report: (typeof reports)[number]) => {
    setLoading(report.id);
    try {
      const rows = await fetchReportRows(report.id);
      const columns = pickColumns(rows, locale);
      downloadExcelFile(`${report.id}-report.xls`, locale === "ar" ? report.ar : report.en, columns, rows);
      toast.success(locale === "ar" ? "تم تنزيل ملف Excel" : "Excel downloaded");
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(null);
    }
  };

  const printDaily = async () => {
    const report = reports[0];
    setLoading("daily-print");
    try {
      const rows = await fetchReportRows("daily");
      printTableDocument(locale === "ar" ? report.ar : report.en, pickColumns(rows, locale), rows, {
        dir: locale === "ar" ? "rtl" : "ltr",
        subtitle: `${filters.daily.from || "..."} - ${filters.daily.to || "..."}`,
      });
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(locale, "reports")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar" ? "تقارير يومية وشهرية وسنوية مع تصدير Excel" : "Daily, monthly, yearly reports with Excel export"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="text-base">{locale === "ar" ? report.ar : report.en}</CardTitle>
              <CardDescription>
                {locale === "ar" ? "فلترة بالتاريخ وتصدير Excel" : "Date filtered Excel export"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{locale === "ar" ? "من" : "From"}</p>
                  <Input
                    type="date"
                    value={filters[report.id]?.from || ""}
                    onChange={(e) => setReportFilter(report.id, { from: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{locale === "ar" ? "إلى" : "To"}</p>
                  <Input
                    type="date"
                    value={filters[report.id]?.to || ""}
                    onChange={(e) => setReportFilter(report.id, { to: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={loading === report.id} onClick={() => exportReport(report)}>
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
              {report.id === "daily" && (
                <Button variant="outline" size="sm" disabled={loading === "daily-print"} onClick={printDaily}>
                  <Printer className="mr-2 h-4 w-4" />
                  {locale === "ar" ? "طباعة PDF" : "Print PDF"}
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
