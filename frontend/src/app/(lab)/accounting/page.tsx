"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";
import { downloadExcelFile, printTableDocument } from "@/lib/export";

interface FinancialSummary {
  total_invoiced: number;
  total_collected: number;
  outstanding: number;
  invoice_count: number;
}

interface ExpenseSummary {
  total_expenses: number;
  expense_count: number;
}

export default function AccountingPage() {
  const locale = useAuthStore((s) => s.locale);
  const [billing, setBilling] = useState<FinancialSummary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const suffix = params.toString() ? `?${params}` : "";
    Promise.all([api.get(`/billing/summary${suffix}`), api.get(`/expenses/summary${suffix}`)])
      .then(([b, e]) => {
        setBilling(b.data);
        setExpenses(e.data);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const netProfit = billing && expenses ? billing.total_collected - expenses.total_expenses : 0;
  const rows = [
    { metric: locale === "ar" ? "إجمالي الإيرادات" : "Total Revenue", value: billing?.total_invoiced ?? 0 },
    { metric: locale === "ar" ? "المحصّل نقداً" : "Cash Collected", value: billing?.total_collected ?? 0 },
    { metric: locale === "ar" ? "المستحق" : "Outstanding", value: billing?.outstanding ?? 0 },
    { metric: locale === "ar" ? "إجمالي المصروفات" : "Total Expenses", value: expenses?.total_expenses ?? 0 },
    { metric: locale === "ar" ? "صافي الربح" : "Net Profit", value: netProfit },
  ];
  const columns = [
    { key: "metric", header: locale === "ar" ? "البند" : "Item" },
    { key: "value", header: locale === "ar" ? "القيمة" : "Value" },
  ];

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t(locale, "accounting")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar" ? "الإيرادات والمصروفات والأرباح والتدفق النقدي" : "Revenue, expenses, profit, and cash flow overview"}
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "من تاريخ" : "From date"}</p>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "إلى تاريخ" : "To date"}</p>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => downloadExcelFile("accounting-summary.xls", t(locale, "accounting"), columns, rows)}>
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => printTableDocument(t(locale, "accounting"), columns, rows, {
                dir: locale === "ar" ? "rtl" : "ltr",
                subtitle: dateFrom || dateTo ? `${dateFrom || "..."} - ${dateTo || "..."}` : undefined,
              })}
            >
              <Printer className="h-4 w-4" />
              {locale === "ar" ? "طباعة" : "Print"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "ar" ? "إجمالي الإيرادات" : "Total Revenue (Invoiced)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">EGP {billing?.total_invoiced.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{billing?.invoice_count} {locale === "ar" ? "فاتورة" : "invoices"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "ar" ? "المحصّل نقداً" : "Cash Collected"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">EGP {billing?.total_collected.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {locale === "ar" ? "مستحق" : "Outstanding"}: EGP {billing?.outstanding.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "ar" ? "إجمالي المصروفات" : "Total Expenses"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">EGP {expenses?.total_expenses.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{expenses?.expense_count} {locale === "ar" ? "مصروف" : "expenses"}</p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {locale === "ar" ? "صافي الربح (المحصّل − المصروفات)" : "Net Profit (Collected − Expenses)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              EGP {netProfit.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
