"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { useBrandingStore } from "@/stores/branding-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { displayName, resolveAssetUrl } from "@/lib/branding";
import { toast } from "sonner";
import { Printer } from "lucide-react";

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
  const branding = useBrandingStore((s) => s.branding);
  const [billing, setBilling] = useState<FinancialSummary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [operationDate, setOperationDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    Promise.all([api.get("/billing/summary"), api.get("/expenses/summary")])
      .then(([b, e]) => {
        setBilling(b.data);
        setExpenses(e.data);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  const netProfit = billing && expenses ? billing.total_collected - expenses.total_expenses : 0;

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "accounting")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "الإيرادات والمصروفات والأرباح والتدفق النقدي" : "Revenue, expenses, profit, and cash flow overview"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/60 bg-card p-3 shadow-card">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{locale === "ar" ? "تاريخ اليومية" : "Daily operation date"}</Label>
            <Input
              type="date"
              value={operationDate}
              onChange={(event) => setOperationDate(event.target.value)}
              className="h-8"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="me-2 h-4 w-4" />
            {locale === "ar" ? "طباعة PDF اليومية" : "Print Daily PDF"}
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

      <div id="daily-operations-print-root" dir={locale === "ar" ? "rtl" : "ltr"}>
        <div className="daily-operations-paper">
          <div className="daily-operations-header">
            {branding.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveAssetUrl(branding.logo_url) || ""} alt={displayName(branding, locale)} />
            )}
            <h1>{displayName(branding, locale)}</h1>
            <p>{locale === "ar" ? "تقرير العمليات اليومية" : "Daily Operations Report"}</p>
          </div>
          <div className="daily-operations-meta">
            <span>{locale === "ar" ? "التاريخ" : "Date"}: {operationDate}</span>
            <span>{locale === "ar" ? "تاريخ الطباعة" : "Printed at"}: {new Date().toLocaleString()}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>{locale === "ar" ? "البند" : "Metric"}</th>
                <th>{locale === "ar" ? "القيمة" : "Value"}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>{locale === "ar" ? "إجمالي الفواتير" : "Total invoiced"}</td><td>EGP {billing?.total_invoiced.toLocaleString()}</td></tr>
              <tr><td>{locale === "ar" ? "المحصّل" : "Collected"}</td><td>EGP {billing?.total_collected.toLocaleString()}</td></tr>
              <tr><td>{locale === "ar" ? "المستحق" : "Outstanding"}</td><td>EGP {billing?.outstanding.toLocaleString()}</td></tr>
              <tr><td>{locale === "ar" ? "المصروفات" : "Expenses"}</td><td>EGP {expenses?.total_expenses.toLocaleString()}</td></tr>
              <tr><td>{locale === "ar" ? "صافي الربح" : "Net profit"}</td><td>EGP {netProfit.toLocaleString()}</td></tr>
            </tbody>
          </table>
          <div className="daily-operations-footer">
            {locale === "ar" ? "تم إنشاؤه بواسطة LabMaster" : "Generated by LabMaster"}
          </div>
        </div>
      </div>
    </div>
  );
}
