"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";
import { toast } from "sonner";

const reports = [
  { id: "daily", en: "Daily Operations", ar: "عمليات اليوم", descriptionEn: "Patients, results, invoices, and expenses", descriptionAr: "المرضى والنتائج والفواتير والمصروفات" },
  { id: "monthly", en: "Monthly Summary", ar: "الملخص الشهري", descriptionEn: "Monthly billing and expense movement", descriptionAr: "حركة الفواتير والمصروفات شهرياً" },
  { id: "profitability", en: "Profitability", ar: "الربحية", descriptionEn: "Collected cash vs expenses by day", descriptionAr: "المتحصلات مقابل المصروفات يومياً" },
  { id: "inventory", en: "Inventory Valuation", ar: "تقييم المخزون", descriptionEn: "Current stock value and reorder exposure", descriptionAr: "قيمة المخزون الحالية ومستوى إعادة الطلب" },
  { id: "referrals", en: "Doctor Referrals", ar: "إحالات الأطباء", descriptionEn: "Referral activity with notes", descriptionAr: "نشاط الإحالات مع الملاحظات" },
  { id: "patients", en: "Patient Statistics", ar: "إحصائيات المرضى", descriptionEn: "Patient registrations and demographics", descriptionAr: "تسجيلات المرضى والبيانات الديموغرافية" },
  { id: "branches", en: "Branch Performance", ar: "أداء الفروع", descriptionEn: "Invoices, collections, and expenses per branch", descriptionAr: "الفواتير والتحصيل والمصروفات لكل فرع" },
];

interface DateRangeState {
  from: string;
  to: string;
}

interface InvoiceRow {
  invoice_number: string;
  patient_name: string;
  total: number;
  paid_amount: number;
  issued_at?: string;
  created_at?: string;
  branch_id?: string;
}

interface ExpenseRow {
  expense_number: string;
  description: string;
  amount: number;
  expense_date: string;
  vendor?: string;
  payment_method?: string;
  branch_id?: string;
}

interface PatientRow {
  patient_code: string;
  full_name: string;
  full_name_ar?: string;
  phone?: string;
  city?: string;
  gender?: string;
  created_at: string;
}

interface ResultRow {
  order_number: string;
  patient_name: string;
  test_name: string;
  status: string;
  ordered_at: string;
}

interface InventoryRow {
  sku: string;
  name: string;
  name_ar?: string;
  category: string;
  total_quantity: number;
  unit_cost: number;
  reorder_level: number;
  created_at?: string;
}

interface ReferralRow {
  doctor_name: string;
  patient_name: string;
  referral_date: string;
  notes?: string;
}

interface BranchRow {
  id: string;
  code: string;
  name: string;
  name_ar?: string;
  city?: string;
  governorate?: string;
  phone?: string;
  created_at: string;
}

function inRange(value: string | undefined, range: DateRangeState) {
  if (!value) return !range.from && !range.to;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const from = range.from ? new Date(`${range.from}T00:00:00`) : null;
  const to = range.to ? new Date(`${range.to}T23:59:59.999`) : null;

  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function groupByPeriod(rows: Array<{ date: string; revenue?: number; collected?: number; expenses?: number }>) {
  const grouped = new Map<string, { revenue: number; collected: number; expenses: number }>();

  rows.forEach((row) => {
    const key = row.date.slice(0, 7);
    const current = grouped.get(key) || { revenue: 0, collected: 0, expenses: 0 };
    current.revenue += row.revenue || 0;
    current.collected += row.collected || 0;
    current.expenses += row.expenses || 0;
    grouped.set(key, current);
  });

  return [...grouped.entries()].map(([period, totals]) => ({
    period,
    revenue: totals.revenue,
    collected: totals.collected,
    expenses: totals.expenses,
    net_profit: totals.collected - totals.expenses,
  }));
}

export default function ReportsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [ranges, setRanges] = useState<Record<string, DateRangeState>>(
    Object.fromEntries(reports.map((report) => [report.id, { from: "", to: "" }]))
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const labels = useMemo(
    () => ({
      reportRange: locale === "ar" ? "الفترة" : "Date range",
      exportExcel: locale === "ar" ? "تصدير Excel" : "Export Excel",
      reportSheet: locale === "ar" ? "الملخص" : "Summary",
    }),
    [locale]
  );

  const updateRange = (reportId: string, key: keyof DateRangeState, value: string) => {
    setRanges((current) => ({
      ...current,
      [reportId]: {
        ...current[reportId],
        [key]: value,
      },
    }));
  };

  const fetchItems = async <T,>(path: string) => {
    const { data } = await api.get(path, { params: { page_size: 100 } });
    return (data.items || data) as T[];
  };

  const exportReport = async (reportId: string) => {
    const range = ranges[reportId];
    setLoadingId(reportId);

    try {
      if (reportId === "daily") {
        const [patients, invoices, results, expenses] = await Promise.all([
          fetchItems<PatientRow>("/patients"),
          fetchItems<InvoiceRow>("/billing/invoices"),
          fetchItems<ResultRow>("/results"),
          fetchItems<ExpenseRow>("/expenses"),
        ]);

        const filteredPatients = patients.filter((row) => inRange(row.created_at, range));
        const filteredInvoices = invoices.filter((row) => inRange(row.issued_at || row.created_at, range));
        const filteredResults = results.filter((row) => inRange(row.ordered_at, range));
        const filteredExpenses = expenses.filter((row) => inRange(row.expense_date, range));

        exportWorkbook(
          [
            {
              name: labels.reportSheet,
              rows: [
                {
                  [locale === "ar" ? "من" : "From"]: range.from || "—",
                  [locale === "ar" ? "إلى" : "To"]: range.to || "—",
                  [locale === "ar" ? "مرضى جدد" : "New Patients"]: filteredPatients.length,
                  [locale === "ar" ? "فواتير" : "Invoices"]: filteredInvoices.length,
                  [locale === "ar" ? "إجمالي الفواتير" : "Invoice Total"]: filteredInvoices.reduce((sum, row) => sum + row.total, 0),
                  [locale === "ar" ? "نتائج" : "Results"]: filteredResults.length,
                  [locale === "ar" ? "المصروفات" : "Expenses"]: filteredExpenses.reduce((sum, row) => sum + row.amount, 0),
                },
              ],
            },
            {
              name: locale === "ar" ? "الفواتير" : "Invoices",
              rows: filteredInvoices.map((row) => ({
                [locale === "ar" ? "رقم الفاتورة" : "Invoice #"]: row.invoice_number,
                [locale === "ar" ? "المريض" : "Patient"]: row.patient_name,
                [locale === "ar" ? "الإجمالي" : "Total"]: row.total,
                [locale === "ar" ? "المدفوع" : "Paid"]: row.paid_amount,
                [locale === "ar" ? "التاريخ" : "Date"]: row.issued_at || row.created_at || "",
              })),
            },
            {
              name: locale === "ar" ? "المصروفات" : "Expenses",
              rows: filteredExpenses.map((row) => ({
                [locale === "ar" ? "رقم المصروف" : "Expense #"]: row.expense_number,
                [locale === "ar" ? "الوصف" : "Description"]: row.description,
                [locale === "ar" ? "المبلغ" : "Amount"]: row.amount,
                [locale === "ar" ? "التاريخ" : "Date"]: row.expense_date,
              })),
            },
            {
              name: locale === "ar" ? "المرضى" : "Patients",
              rows: filteredPatients.map((row) => ({
                [locale === "ar" ? "الكود" : "Code"]: row.patient_code,
                [locale === "ar" ? "الاسم" : "Name"]: locale === "ar" ? row.full_name_ar || row.full_name : row.full_name,
                [locale === "ar" ? "الهاتف" : "Phone"]: row.phone || "",
                [locale === "ar" ? "التاريخ" : "Created"]: row.created_at,
              })),
            },
          ],
          "daily-operations-report.xlsx"
        );
      }

      if (reportId === "monthly") {
        const [invoices, expenses] = await Promise.all([
          fetchItems<InvoiceRow>("/billing/invoices"),
          fetchItems<ExpenseRow>("/expenses"),
        ]);

        const grouped = groupByPeriod([
          ...invoices.filter((row) => inRange(row.issued_at || row.created_at, range)).map((row) => ({
            date: row.issued_at || row.created_at || "",
            revenue: row.total,
            collected: row.paid_amount,
          })),
          ...expenses.filter((row) => inRange(row.expense_date, range)).map((row) => ({
            date: row.expense_date,
            expenses: row.amount,
          })),
        ]);

        exportWorkbook(
          [
            {
              name: labels.reportSheet,
              rows: grouped.map((row) => ({
                [locale === "ar" ? "الشهر" : "Month"]: row.period,
                [locale === "ar" ? "إجمالي الفواتير" : "Invoiced"]: row.revenue,
                [locale === "ar" ? "المحصّل" : "Collected"]: row.collected,
                [locale === "ar" ? "المصروفات" : "Expenses"]: row.expenses,
                [locale === "ar" ? "صافي الربح" : "Net Profit"]: row.net_profit,
              })),
            },
          ],
          "monthly-summary-report.xlsx"
        );
      }

      if (reportId === "profitability") {
        const [invoices, expenses] = await Promise.all([
          fetchItems<InvoiceRow>("/billing/invoices"),
          fetchItems<ExpenseRow>("/expenses"),
        ]);

        const invoiceRows = invoices
          .filter((row) => inRange(row.issued_at || row.created_at, range))
          .map((row) => ({
            date: (row.issued_at || row.created_at || "").slice(0, 10),
            revenue: row.total,
            collected: row.paid_amount,
            expenses: 0,
          }));

        const expenseRows = expenses
          .filter((row) => inRange(row.expense_date, range))
          .map((row) => ({
            date: row.expense_date.slice(0, 10),
            revenue: 0,
            collected: 0,
            expenses: row.amount,
          }));

        const grouped = groupByPeriod([...invoiceRows, ...expenseRows]).map((row) => ({
          ...row,
          margin: row.revenue ? Number(((row.net_profit / row.revenue) * 100).toFixed(2)) : 0,
        }));

        exportWorkbook(
          [
            {
              name: labels.reportSheet,
              rows: grouped.map((row) => ({
                [locale === "ar" ? "الفترة" : "Period"]: row.period,
                [locale === "ar" ? "الفواتير" : "Revenue"]: row.revenue,
                [locale === "ar" ? "المحصّل" : "Collected"]: row.collected,
                [locale === "ar" ? "المصروفات" : "Expenses"]: row.expenses,
                [locale === "ar" ? "صافي الربح" : "Net Profit"]: row.net_profit,
                [locale === "ar" ? "هامش الربح %" : "Margin %"]: row.margin,
              })),
            },
          ],
          "profitability-report.xlsx"
        );
      }

      if (reportId === "inventory") {
        const items = await fetchItems<InventoryRow>("/inventory");
        const filteredItems = items.filter((row) => inRange(row.created_at, range));

        exportWorkbook(
          [
            {
              name: labels.reportSheet,
              rows: filteredItems.map((row) => ({
                SKU: row.sku,
                [locale === "ar" ? "الاسم" : "Name"]: locale === "ar" ? row.name_ar || row.name : row.name,
                [locale === "ar" ? "الفئة" : "Category"]: row.category,
                [locale === "ar" ? "الكمية" : "Quantity"]: row.total_quantity,
                [locale === "ar" ? "تكلفة الوحدة" : "Unit Cost"]: row.unit_cost,
                [locale === "ar" ? "قيمة المخزون" : "Inventory Value"]: row.total_quantity * row.unit_cost,
                [locale === "ar" ? "إعادة الطلب" : "Reorder Level"]: row.reorder_level,
              })),
            },
          ],
          "inventory-valuation-report.xlsx"
        );
      }

      if (reportId === "referrals") {
        const referrals = await fetchItems<ReferralRow>("/referrals");
        const filteredReferrals = referrals.filter((row) => inRange(row.referral_date, range));

        exportWorkbook(
          [
            {
              name: labels.reportSheet,
              rows: filteredReferrals.map((row) => ({
                [locale === "ar" ? "الطبيب" : "Doctor"]: row.doctor_name,
                [locale === "ar" ? "المريض" : "Patient"]: row.patient_name,
                [locale === "ar" ? "التاريخ" : "Date"]: row.referral_date,
                [locale === "ar" ? "ملاحظات" : "Notes"]: row.notes || "",
              })),
            },
          ],
          "doctor-referrals-report.xlsx"
        );
      }

      if (reportId === "patients") {
        const patients = await fetchItems<PatientRow>("/patients");
        const filteredPatients = patients.filter((row) => inRange(row.created_at, range));

        exportWorkbook(
          [
            {
              name: labels.reportSheet,
              rows: [
                {
                  [locale === "ar" ? "عدد المرضى" : "Patients"]: filteredPatients.length,
                  [locale === "ar" ? "ذكور" : "Male"]: filteredPatients.filter((row) => row.gender === "male").length,
                  [locale === "ar" ? "إناث" : "Female"]: filteredPatients.filter((row) => row.gender === "female").length,
                  [locale === "ar" ? "مدن مختلفة" : "Cities"]: new Set(filteredPatients.map((row) => row.city).filter(Boolean)).size,
                },
              ],
            },
            {
              name: locale === "ar" ? "تفاصيل المرضى" : "Patient Details",
              rows: filteredPatients.map((row) => ({
                [locale === "ar" ? "الكود" : "Code"]: row.patient_code,
                [locale === "ar" ? "الاسم" : "Name"]: locale === "ar" ? row.full_name_ar || row.full_name : row.full_name,
                [locale === "ar" ? "المدينة" : "City"]: row.city || "",
                [locale === "ar" ? "النوع" : "Gender"]: row.gender || "",
                [locale === "ar" ? "التاريخ" : "Created"]: row.created_at,
              })),
            },
          ],
          "patient-statistics-report.xlsx"
        );
      }

      if (reportId === "branches") {
        const [branches, invoices, expenses] = await Promise.all([
          fetchItems<BranchRow>("/branches"),
          fetchItems<InvoiceRow>("/billing/invoices"),
          fetchItems<ExpenseRow>("/expenses"),
        ]);

        const filteredBranches = branches.filter((row) => inRange(row.created_at, range));
        const filteredInvoices = invoices.filter((row) => inRange(row.issued_at || row.created_at, range));
        const filteredExpenses = expenses.filter((row) => inRange(row.expense_date, range));

        const rows = filteredBranches.map((branch) => {
          const branchInvoices = filteredInvoices.filter((row) => row.branch_id === branch.id);
          const branchExpenses = filteredExpenses.filter((row) => row.branch_id === branch.id);
          const totalInvoiced = branchInvoices.reduce((sum, row) => sum + row.total, 0);
          const totalCollected = branchInvoices.reduce((sum, row) => sum + row.paid_amount, 0);
          const totalExpenses = branchExpenses.reduce((sum, row) => sum + row.amount, 0);

          return {
            [locale === "ar" ? "الفرع" : "Branch"]: locale === "ar" ? branch.name_ar || branch.name : branch.name,
            [locale === "ar" ? "الكود" : "Code"]: branch.code,
            [locale === "ar" ? "المدينة" : "City"]: branch.city || "",
            [locale === "ar" ? "عدد الفواتير" : "Invoices"]: branchInvoices.length,
            [locale === "ar" ? "إجمالي الفواتير" : "Invoiced"]: totalInvoiced,
            [locale === "ar" ? "المحصّل" : "Collected"]: totalCollected,
            [locale === "ar" ? "المصروفات" : "Expenses"]: totalExpenses,
            [locale === "ar" ? "صافي الربح" : "Net Profit"]: totalCollected - totalExpenses,
          };
        });

        exportWorkbook([{ name: labels.reportSheet, rows }], "branch-performance-report.xlsx");
      }

      toast.success(locale === "ar" ? "تم تجهيز ملف Excel" : "Excel report ready");
    } catch (error) {
      toast.error(getApiError(error));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(locale, "reports")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar" ? "تقارير قابلة للتصفية بالتاريخ مع تصدير Excel فقط" : "Date-filtered reports with Excel-only export"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="text-base">{locale === "ar" ? report.ar : report.en}</CardTitle>
              <CardDescription>{locale === "ar" ? report.descriptionAr : report.descriptionEn}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="date"
                  value={ranges[report.id].from}
                  onChange={(e) => updateRange(report.id, "from", e.target.value)}
                  aria-label={`${report.id}-from`}
                />
                <Input
                  type="date"
                  value={ranges[report.id].to}
                  onChange={(e) => updateRange(report.id, "to", e.target.value)}
                  aria-label={`${report.id}-to`}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => exportReport(report.id)} disabled={loadingId === report.id}>
                {loadingId === report.id ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="me-2 h-4 w-4" />
                )}
                {labels.exportExcel}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
