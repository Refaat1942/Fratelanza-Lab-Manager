"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, FlaskConical, Stethoscope, Package, TrendingUp, TrendingDown,
  Receipt, AlertTriangle, Clock, ArrowLeft, ArrowRight, Wallet, Printer,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useBrandingStore } from "@/stores/branding-store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { buildBrandingTemplate, openPrintDocument } from "@/lib/print";
import { resolveAssetUrl } from "@/lib/branding";
import { PageHeader } from "@/components/layout/page-header";
import { AnimatedStagger, AnimatedItem } from "@/components/layout/animated-page";

interface Insights {
  stats: {
    patients: number;
    doctors: number;
    tests: number;
    inventory_items: number;
    low_stock_items: number;
  };
  financial: {
    total_invoiced: number;
    total_collected: number;
    outstanding: number;
    invoice_count: number;
  };
  expenses: { total_expenses: number; expense_count: number };
  orders: { pending_orders: number; in_lab_orders: number; completed_orders: number };
  recent_patients: { id: string; full_name: string; patient_code: string; created_at: string }[];
  recent_invoices: { id: string; invoice_number: string; patient_name: string; total: number; status: string }[];
  low_stock: { id: string; sku: string; name: string; total_quantity: number; reorder_level: number }[];
  net_profit: number;
}

const PIE_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"];

export default function DashboardPage() {
  const locale = useAuthStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const branding = useBrandingStore((s) => s.branding);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const loadInsights = useCallback(() => {
    setLoading(true);
    api.get("/dashboard/insights", {
      params: {
        start_date: fromDate || undefined,
        end_date: toDate || undefined,
      },
    })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const stats = data?.stats;
  const fin = data?.financial;

  const statCards = [
    { title: "Patients", titleAr: "المرضى", value: stats?.patients ?? 0, icon: Users, color: "text-emerald-600", bg: "from-emerald-500/15 to-emerald-500/5" },
    { title: "Doctors", titleAr: "الأطباء", value: stats?.doctors ?? 0, icon: Stethoscope, color: "text-blue-600", bg: "from-blue-500/15 to-blue-500/5" },
    { title: "Tests", titleAr: "التحاليل", value: stats?.tests ?? 0, icon: FlaskConical, color: "text-violet-600", bg: "from-violet-500/15 to-violet-500/5" },
    { title: "Inventory", titleAr: "المخزون", value: stats?.inventory_items ?? 0, icon: Package, color: "text-cyan-600", bg: "from-cyan-500/15 to-cyan-500/5" },
  ];

  const orderChart = data
    ? [
        { name: locale === "ar" ? "معلق" : "Pending", value: data.orders.pending_orders },
        { name: locale === "ar" ? "في المختبر" : "In Lab", value: data.orders.in_lab_orders },
        { name: locale === "ar" ? "مكتمل" : "Done", value: data.orders.completed_orders },
      ]
    : [];

  const financeChart = fin
    ? [
        { name: locale === "ar" ? "محصّل" : "Collected", amount: fin.total_collected },
        { name: locale === "ar" ? "مستحق" : "Outstanding", amount: fin.outstanding },
        { name: locale === "ar" ? "مصروفات" : "Expenses", amount: data?.expenses.total_expenses ?? 0 },
      ]
    : [];
  const ForwardIcon = locale === "ar" ? ArrowLeft : ArrowRight;

  const printOperationsReport = () => {
    if (!data) return;

    const tokens = {
      company_name: locale === "ar" ? branding.company_name_ar || branding.company_name : branding.company_name,
      company_name_ar: branding.company_name_ar || "",
      report_title: locale === "ar" ? "تقرير العمليات" : "Operations Report",
      patient_name: "",
      invoice_number: "",
      date: fromDate && toDate ? `${fromDate} - ${toDate}` : new Date().toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US"),
      printed_at: new Date().toLocaleString(locale === "ar" ? "ar-EG" : "en-US"),
    };
    const logoUrl = resolveAssetUrl(branding.logo_url);

    const body = `
      <div class="print-header">
        <div class="brand-block">
          ${logoUrl ? `<img class="brand-logo" src="${logoUrl}" alt="${tokens.company_name}" />` : ""}
          <div>
            <div style="font-size: 22px; font-weight: 700;">${tokens.company_name}</div>
            <div class="muted">${tokens.report_title}</div>
          </div>
        </div>
        ${buildBrandingTemplate(branding.report_header_html, tokens)}
      </div>

      <div class="print-card">
        <div class="print-grid">
          <div class="print-kpi"><span class="print-kpi-label">${locale === "ar" ? "الفواتير" : "Invoices"}</span><div class="print-kpi-value">${data.financial.invoice_count}</div></div>
          <div class="print-kpi"><span class="print-kpi-label">${locale === "ar" ? "المحصّل" : "Collected"}</span><div class="print-kpi-value">EGP ${data.financial.total_collected.toLocaleString()}</div></div>
          <div class="print-kpi"><span class="print-kpi-label">${locale === "ar" ? "المصروفات" : "Expenses"}</span><div class="print-kpi-value">EGP ${data.expenses.total_expenses.toLocaleString()}</div></div>
          <div class="print-kpi"><span class="print-kpi-label">${locale === "ar" ? "صافي الربح" : "Net Profit"}</span><div class="print-kpi-value">EGP ${data.net_profit.toLocaleString()}</div></div>
        </div>
      </div>

      <div class="print-card">
        <h3 style="margin-top: 0;">${locale === "ar" ? "أحدث المرضى" : "Recent Patients"}</h3>
        <table>
          <thead>
            <tr>
              <th>${locale === "ar" ? "الكود" : "Code"}</th>
              <th>${locale === "ar" ? "الاسم" : "Name"}</th>
              <th>${locale === "ar" ? "التاريخ" : "Date"}</th>
            </tr>
          </thead>
          <tbody>
            ${data.recent_patients
              .map(
                (patient) => `
                  <tr>
                    <td>${patient.patient_code}</td>
                    <td>${patient.full_name}</td>
                    <td>${new Date(patient.created_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="print-card">
        <h3 style="margin-top: 0;">${locale === "ar" ? "أحدث الفواتير" : "Recent Invoices"}</h3>
        <table>
          <thead>
            <tr>
              <th>${locale === "ar" ? "رقم الفاتورة" : "Invoice #"}</th>
              <th>${locale === "ar" ? "المريض" : "Patient"}</th>
              <th>${locale === "ar" ? "الإجمالي" : "Total"}</th>
            </tr>
          </thead>
          <tbody>
            ${data.recent_invoices
              .map(
                (invoice) => `
                  <tr>
                    <td>${invoice.invoice_number}</td>
                    <td>${invoice.patient_name}</td>
                    <td>EGP ${invoice.total.toLocaleString()}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="print-footer">
        ${buildBrandingTemplate(branding.report_footer_html, tokens)}
      </div>
    `;

    openPrintDocument({
      title: "operations-report",
      body,
      branding,
      locale,
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t(locale, "dashboard")}
        description={
          locale === "ar"
            ? `مرحباً ${user?.full_name_ar || user?.full_name} — رؤى وتحليلات المختبر`
            : `Welcome ${user?.full_name} — laboratory insights & analytics`
        }
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full sm:w-40" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full sm:w-40" />
          {(fromDate || toDate) && (
            <Button variant="ghost" onClick={() => { setFromDate(""); setToDate(""); }}>
              {locale === "ar" ? "مسح التاريخ" : "Clear dates"}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={printOperationsReport}>
            <Printer className="me-2 h-4 w-4" />
            {locale === "ar" ? "طباعة تقرير العمليات PDF" : "Print operations PDF"}
          </Button>
        </div>
      </div>

      {/* Financial KPIs */}
      <AnimatedStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnimatedItem>
          <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-500/10 to-transparent shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Receipt className="h-4 w-4 text-emerald-600" />
                {locale === "ar" ? "إجمالي الفواتير" : "Total Invoiced"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-700">EGP {fin?.total_invoiced.toLocaleString() ?? 0}</p>
              <p className="text-xs text-muted-foreground">{fin?.invoice_count} {locale === "ar" ? "فاتورة" : "invoices"}</p>
            </CardContent>
          </Card>
        </AnimatedItem>
        <AnimatedItem>
          <Card className="border-blue-200/60 bg-gradient-to-br from-blue-500/10 to-transparent shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Wallet className="h-4 w-4 text-blue-600" />
                {locale === "ar" ? "المحصّل" : "Collected"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-700">EGP {fin?.total_collected.toLocaleString() ?? 0}</p>
            </CardContent>
          </Card>
        </AnimatedItem>
        <AnimatedItem>
          <Card className="border-amber-200/60 bg-gradient-to-br from-amber-500/10 to-transparent shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4 text-amber-600" />
                {locale === "ar" ? "المستحق" : "Outstanding"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-700">EGP {fin?.outstanding.toLocaleString() ?? 0}</p>
            </CardContent>
          </Card>
        </AnimatedItem>
        <AnimatedItem>
          <Card className={`border shadow-card ${(data?.net_profit ?? 0) >= 0 ? "border-emerald-200/60 bg-gradient-to-br from-emerald-500/10" : "border-red-200/60 bg-gradient-to-br from-red-500/10"} to-transparent`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                {(data?.net_profit ?? 0) >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                {locale === "ar" ? "صافي الربح" : "Net Profit"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${(data?.net_profit ?? 0) >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                EGP {data?.net_profit.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">
                {locale === "ar" ? "محصّل − مصروفات" : "Collected − expenses"}
              </p>
            </CardContent>
          </Card>
        </AnimatedItem>
      </AnimatedStagger>

      {/* Entity stats */}
      <AnimatedStagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <AnimatedItem key={s.title}>
            <Card className={`border bg-gradient-to-br shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-md ${s.bg}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {locale === "ar" ? s.titleAr : s.title}
                </CardTitle>
                <div className={`rounded-xl bg-white/80 p-2 shadow-sm ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              </CardContent>
            </Card>
          </AnimatedItem>
        ))}
      </AnimatedStagger>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AnimatedItem>
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{locale === "ar" ? "الوضع المالي" : "Financial Breakdown"}</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => `EGP ${Number(v ?? 0).toLocaleString()}`} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {financeChart.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </AnimatedItem>

        <AnimatedItem>
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{locale === "ar" ? "حالة الطلبات" : "Order Pipeline"}</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderChart}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {orderChart.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </AnimatedItem>
      </div>

      {/* Lists row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <AnimatedItem>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{locale === "ar" ? "أحدث المرضى" : "Recent Patients"}</CardTitle>
              <Button variant="ghost" size="sm" render={<Link href="/patients" />}>
                <ForwardIcon className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.recent_patients ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{locale === "ar" ? "لا يوجد" : "None yet"}</p>
              ) : (
                data?.recent_patients.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">{p.patient_code}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </AnimatedItem>

        <AnimatedItem>
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{locale === "ar" ? "أحدث الفواتير" : "Recent Invoices"}</CardTitle>
              <Button variant="ghost" size="sm" render={<Link href="/billing" />}>
                <ForwardIcon className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.recent_invoices ?? []).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{inv.patient_name}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-medium">EGP {inv.total.toLocaleString()}</p>
                    <Badge variant="outline" className="text-[10px]">{inv.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </AnimatedItem>

        <AnimatedItem>
          <Card className="shadow-card border-amber-200/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {locale === "ar" ? "تنبيه مخزون" : "Low Stock Alerts"}
              </CardTitle>
              <Button variant="ghost" size="sm" render={<Link href="/inventory" />}>
                <ForwardIcon className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.low_stock ?? []).length === 0 ? (
                <p className="text-sm text-emerald-600">
                  {locale === "ar" ? "✓ المخزون جيد" : "✓ Stock levels OK"}
                </p>
              ) : (
                data?.low_stock.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-amber-200/50 bg-amber-50/50 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                    <Badge variant="outline" className="border-amber-300 text-amber-700">
                      {item.total_quantity} / {item.reorder_level}
                    </Badge>
                  </div>
                ))
              )}
              {(stats?.low_stock_items ?? 0) > 0 && (
                <p className="text-xs text-amber-700">
                  {stats?.low_stock_items} {locale === "ar" ? "صنف منخفض إجمالاً" : "items low overall"}
                </p>
              )}
            </CardContent>
          </Card>
        </AnimatedItem>
      </div>
    </div>
  );
}
