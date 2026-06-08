"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";
import { toast } from "sonner";
import { Download } from "lucide-react";

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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/billing/summary", { params: { start_date: fromDate || undefined, end_date: toDate || undefined } }),
      api.get("/expenses/summary", { params: { start_date: fromDate || undefined, end_date: toDate || undefined } }),
    ])
      .then(([b, e]) => {
        setBilling(b.data);
        setExpenses(e.data);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const netProfit = billing && expenses ? billing.total_collected - expenses.total_expenses : 0;

  const exportAccounting = () => {
    exportWorkbook(
      [
        {
          name: locale === "ar" ? "ملخص محاسبي" : "Accounting Summary",
          rows: [
            {
              [locale === "ar" ? "من" : "From"]: fromDate || "—",
              [locale === "ar" ? "إلى" : "To"]: toDate || "—",
              [locale === "ar" ? "إجمالي الفواتير" : "Total Invoiced"]: billing?.total_invoiced || 0,
              [locale === "ar" ? "المحصّل" : "Collected"]: billing?.total_collected || 0,
              [locale === "ar" ? "المستحق" : "Outstanding"]: billing?.outstanding || 0,
              [locale === "ar" ? "المصروفات" : "Expenses"]: expenses?.total_expenses || 0,
              [locale === "ar" ? "صافي الربح" : "Net Profit"]: netProfit,
            },
          ],
        },
      ],
      "accounting-summary.xlsx"
    );
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "accounting")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "الإيرادات والمصروفات والأرباح والتدفق النقدي" : "Revenue, expenses, profit, and cash flow overview"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full sm:w-40" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full sm:w-40" />
          <Button variant="outline" onClick={exportAccounting}>
            <Download className="me-2 h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

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
