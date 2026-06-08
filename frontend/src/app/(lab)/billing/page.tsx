"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Eye, Trash2, MoreHorizontal, Printer, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { useBrandingStore } from "@/stores/branding-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { displayName, resolveAssetUrl } from "@/lib/branding";
import { toast } from "sonner";

interface Invoice {
  id: string;
  invoice_number: string;
  patient_name: string;
  subtotal?: number;
  discount?: number;
  total: number;
  paid_amount: number;
  status: string;
  issued_at?: string;
}

interface InvoiceDetail extends Invoice {
  balance: number;
  tax?: number;
  notes?: string;
  items: { description: string; quantity: number; unit_price: number; total: number }[];
  payments: { amount: number; method?: string; paid_at: string }[];
}

interface FinancialSummary {
  total_invoiced: number;
  total_collected: number;
  outstanding: number;
  invoice_count: number;
}

interface Patient { id: string; full_name: string; }
interface TestItem { id: string; name: string; price: number; }
interface ReceiptDesign {
  title: string;
  footer: string;
  width: "80mm" | "A5";
  showLogo: boolean;
  showPayments: boolean;
}

const defaultReceiptDesign: ReceiptDesign = {
  title: "Payment Receipt",
  footer: "Thank you for choosing our laboratory",
  width: "80mm",
  showLogo: true,
  showPayments: true,
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default function BillingPage() {
  const locale = useAuthStore((s) => s.locale);
  const branding = useBrandingStore((s) => s.branding);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [patientId, setPatientId] = useState("");
  const [testId, setTestId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [payAmount, setPayAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [receiptDesignOpen, setReceiptDesignOpen] = useState(false);
  const [receiptDesign, setReceiptDesign] = useState<ReceiptDesign>(defaultReceiptDesign);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page_size: "100" });
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const summaryParams = new URLSearchParams();
    if (dateFrom) summaryParams.set("date_from", dateFrom);
    if (dateTo) summaryParams.set("date_to", dateTo);
    Promise.all([
      api.get(`/billing/invoices?${params}`),
      api.get(`/billing/summary${summaryParams.toString() ? `?${summaryParams}` : ""}`),
      api.get("/patients?page_size=100"),
      api.get("/tests?page_size=100"),
    ])
      .then(([inv, sum, pat, tst]) => {
        setInvoices(inv.data.items || []);
        setSummary(sum.data);
        setPatients(pat.data.items || []);
        setTests(tst.data.items || []);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const saved = localStorage.getItem("receipt_design");
    if (saved) {
      try {
        setReceiptDesign({ ...defaultReceiptDesign, ...JSON.parse(saved) });
      } catch {
        localStorage.removeItem("receipt_design");
      }
    } else if (locale === "ar") {
      setReceiptDesign({
        title: "إيصال دفع",
        footer: "شكراً لاختياركم مختبرنا",
        width: "80mm",
        showLogo: true,
        showPayments: true,
      });
    }
  }, [locale]);

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const test = tests.find((t) => t.id === testId);
    if (!test) return;
    setSaving(true);
    try {
      await api.post("/billing/invoices", {
        patient_id: patientId,
        discount: parseFloat(discount) || 0,
        items: [{ description: test.name, unit_price: test.price, quantity: 1, test_id: test.id }],
      });
      toast.success(locale === "ar" ? "تم إنشاء الفاتورة" : "Invoice created");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const viewDetail = async (id: string) => {
    try {
      const { data } = await api.get(`/billing/invoices/${id}`);
      setDetail(data);
      setPayAmount(String(data.balance || 0));
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const recordPayment = async () => {
    if (!detail) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;
    try {
      await api.post(`/billing/invoices/${detail.id}/payments`, { amount });
      toast.success(locale === "ar" ? "تم تسجيل الدفع" : "Payment recorded");
      viewDetail(detail.id);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm(locale === "ar" ? "إلغاء الفاتورة؟" : "Cancel invoice?")) return;
    try {
      await api.delete(`/billing/invoices/${id}`);
      toast.success(locale === "ar" ? "تم الإلغاء" : "Invoice cancelled");
      setDetail(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const saveReceiptDesign = () => {
    localStorage.setItem("receipt_design", JSON.stringify(receiptDesign));
    setReceiptDesignOpen(false);
    toast.success(locale === "ar" ? "تم حفظ تصميم الإيصال" : "Receipt design saved");
  };

  const printReceipt = (invoice: InvoiceDetail) => {
    const logoUrl = resolveAssetUrl(branding.logo_url || "/labmaster-logo.svg");
    const receiptWidth = receiptDesign.width === "A5" ? "148mm" : "80mm";
    const win = window.open("", "_blank", "width=420,height=720");
    if (!win) return;
    const dir = locale === "ar" ? "rtl" : "ltr";
    const payments = invoice.payments.map((payment) => `
      <tr>
        <td>${escapeHtml(new Date(payment.paid_at).toLocaleString())}</td>
        <td>${escapeHtml(payment.method || "")}</td>
        <td>${escapeHtml(payment.amount.toLocaleString())}</td>
      </tr>
    `).join("");
    const items = invoice.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.quantity)}</td>
        <td>${escapeHtml(item.total ?? item.unit_price * item.quantity)}</td>
      </tr>
    `).join("");
    win.document.write(`<!doctype html>
<html dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(receiptDesign.title)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
      .receipt { width: ${receiptWidth}; margin: 0 auto; padding: 14px; }
      .center { text-align: center; }
      img { max-width: 72px; max-height: 72px; object-fit: contain; }
      h1 { font-size: 18px; margin: 8px 0 4px; }
      h2 { font-size: 14px; margin: 4px 0 12px; color: #374151; }
      table { border-collapse: collapse; width: 100%; margin-top: 10px; font-size: 12px; }
      td, th { border-bottom: 1px solid #e5e7eb; padding: 6px 0; text-align: start; }
      .total { font-size: 14px; font-weight: 700; }
      .muted { color: #6b7280; font-size: 11px; }
      @media print { body { margin: 0; } button { display: none; } }
    </style>
  </head>
  <body>
    <button onclick="window.print()" style="margin: 8px;">Print / Save PDF</button>
    <main class="receipt">
      <section class="center">
        ${receiptDesign.showLogo && logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="logo" />` : ""}
        <h1>${escapeHtml(displayName(branding, locale))}</h1>
        <h2>${escapeHtml(receiptDesign.title)}</h2>
      </section>
      <p class="muted">${escapeHtml(locale === "ar" ? "رقم الفاتورة" : "Invoice")}: ${escapeHtml(invoice.invoice_number)}</p>
      <p class="muted">${escapeHtml(locale === "ar" ? "العميل" : "Customer")}: ${escapeHtml(invoice.patient_name)}</p>
      <p class="muted">${escapeHtml(locale === "ar" ? "التاريخ" : "Date")}: ${escapeHtml(new Date(invoice.issued_at || Date.now()).toLocaleString())}</p>
      <table>
        <thead><tr><th>${escapeHtml(locale === "ar" ? "البند" : "Item")}</th><th>${escapeHtml(locale === "ar" ? "العدد" : "Qty")}</th><th>${escapeHtml(locale === "ar" ? "الإجمالي" : "Total")}</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      <table>
        <tbody>
          <tr><td>${escapeHtml(locale === "ar" ? "الإجمالي قبل الخصم" : "Subtotal")}</td><td>EGP ${escapeHtml(invoice.subtotal?.toLocaleString())}</td></tr>
          <tr><td>${escapeHtml(locale === "ar" ? "الخصم" : "Discount")}</td><td>EGP ${escapeHtml(invoice.discount?.toLocaleString())}</td></tr>
          <tr class="total"><td>${escapeHtml(locale === "ar" ? "الإجمالي" : "Total")}</td><td>EGP ${escapeHtml(invoice.total.toLocaleString())}</td></tr>
          <tr><td>${escapeHtml(locale === "ar" ? "المدفوع" : "Paid")}</td><td>EGP ${escapeHtml(invoice.paid_amount.toLocaleString())}</td></tr>
          <tr><td>${escapeHtml(locale === "ar" ? "المتبقي" : "Balance")}</td><td>EGP ${escapeHtml(invoice.balance.toLocaleString())}</td></tr>
        </tbody>
      </table>
      ${receiptDesign.showPayments && invoice.payments.length ? `
        <table>
          <thead><tr><th>${escapeHtml(locale === "ar" ? "وقت الدفع" : "Paid at")}</th><th>${escapeHtml(locale === "ar" ? "الطريقة" : "Method")}</th><th>${escapeHtml(locale === "ar" ? "المبلغ" : "Amount")}</th></tr></thead>
          <tbody>${payments}</tbody>
        </table>
      ` : ""}
      <p class="center muted" style="margin-top: 16px;">${escapeHtml(receiptDesign.footer)}</p>
    </main>
    <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
  </body>
</html>`);
    win.document.close();
  };

  const columns: ColumnDef<Invoice>[] = [
    { accessorKey: "invoice_number", header: locale === "ar" ? "رقم الفاتورة" : "Invoice #" },
    { accessorKey: "patient_name", header: locale === "ar" ? "المريض" : "Patient" },
    { accessorKey: "total", header: locale === "ar" ? "الإجمالي" : "Total", cell: ({ row }) => `EGP ${row.original.total.toLocaleString()}` },
    { accessorKey: "paid_amount", header: locale === "ar" ? "المدفوع" : "Paid", cell: ({ row }) => `EGP ${row.original.paid_amount.toLocaleString()}` },
    {
      accessorKey: "status",
      header: locale === "ar" ? "الحالة" : "Status",
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => viewDetail(row.original.id)}>
              <Eye className="mr-2 h-4 w-4" />{locale === "ar" ? "عرض" : "View"}
            </DropdownMenuItem>
            {row.original.status !== "paid" && (
              <DropdownMenuItem onClick={async () => {
                const due = row.original.total - row.original.paid_amount;
                try {
                  await api.post(`/billing/invoices/${row.original.id}/payments`, { amount: due });
                  toast.success("Payment recorded");
                  load();
                } catch (err) { toast.error(getApiError(err)); }
              }}>
                {locale === "ar" ? "دفع كامل" : "Pay full"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive" onClick={() => deleteInvoice(row.original.id)}>
              <Trash2 className="mr-2 h-4 w-4" />{t(locale, "delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "billing")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "الفواتير والمدفوعات والملخص المالي" : "Invoices, payments, and financial overview"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />{t(locale, "create")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{locale === "ar" ? "فاتورة جديدة" : "New Invoice"}</DialogTitle></DialogHeader>
            <form onSubmit={createInvoice} className="space-y-4">
              <div className="space-y-2">
                <Label>{locale === "ar" ? "المريض" : "Patient"}</Label>
                <Select value={patientId} onValueChange={(v) => v && setPatientId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "التحليل" : "Test"}</Label>
                <Select value={testId} onValueChange={(v) => v && setTestId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select test" /></SelectTrigger>
                  <SelectContent>
                    {tests.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} — EGP {t.price}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "خصم (جنيه)" : "Discount (EGP)"}</Label>
                <Input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={saving || !patientId || !testId}>
                {saving ? "..." : t(locale, "save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:max-w-xl">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "من تاريخ" : "From date"}</p>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "إلى تاريخ" : "To date"}</p>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{locale === "ar" ? "إجمالي الفواتير" : "Total Invoiced"}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">EGP {summary.total_invoiced.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{locale === "ar" ? "المحصّل" : "Collected"}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-emerald-600">EGP {summary.total_collected.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{locale === "ar" ? "المستحق" : "Outstanding"}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-amber-600">EGP {summary.outstanding.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{locale === "ar" ? "عدد الفواتير" : "Invoices"}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{summary.invoice_count}</p></CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <DataTable
          columns={columns}
          data={invoices}
          searchPlaceholder={t(locale, "search")}
          exportFilename="billing-invoices.xls"
          exportTitle={locale === "ar" ? "الفواتير" : "Invoices"}
          dateFilterField="issued_at"
          locale={locale}
        />
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.invoice_number} — {detail.patient_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => printReceipt(detail)}>
                    <Printer className="h-4 w-4" />
                    {locale === "ar" ? "طباعة إيصال" : "Print receipt"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setReceiptDesignOpen(true)}>
                    <Settings2 className="h-4 w-4" />
                    {locale === "ar" ? "تصميم الإيصال" : "Receipt design"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div><span className="text-muted-foreground">Subtotal</span><p className="font-medium">EGP {detail.subtotal?.toLocaleString()}</p></div>
                  <div><span className="text-muted-foreground">Discount</span><p className="font-medium">EGP {detail.discount?.toLocaleString()}</p></div>
                  <div><span className="text-muted-foreground">Total</span><p className="font-medium">EGP {detail.total.toLocaleString()}</p></div>
                  <div><span className="text-muted-foreground">Balance</span><p className="font-medium text-amber-600">EGP {detail.balance.toLocaleString()}</p></div>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">{locale === "ar" ? "البنود" : "Line Items"}</h4>
                  <div className="rounded-md border">
                    {detail.items.map((item, i) => (
                      <div key={i} className="flex justify-between border-b px-3 py-2 text-sm last:border-0">
                        <span>{item.description} × {item.quantity}</span>
                        <span>EGP {(item.total ?? item.unit_price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {detail.payments.length > 0 && (
                  <div>
                    <h4 className="mb-2 font-medium">{locale === "ar" ? "المدفوعات" : "Payments"}</h4>
                    <div className="rounded-md border">
                      {detail.payments.map((p, i) => (
                        <div key={i} className="flex justify-between border-b px-3 py-2 text-sm last:border-0">
                          <span>{new Date(p.paid_at).toLocaleString()}</span>
                          <span>EGP {p.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {detail.balance > 0 && (
                  <div className="flex gap-2">
                    <Input type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                    <Button onClick={recordPayment}>{locale === "ar" ? "تسجيل دفع" : "Record Payment"}</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={receiptDesignOpen} onOpenChange={setReceiptDesignOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{locale === "ar" ? "تصميم الإيصال" : "Receipt Design"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{locale === "ar" ? "عنوان الإيصال" : "Receipt title"}</Label>
              <Input value={receiptDesign.title} onChange={(e) => setReceiptDesign({ ...receiptDesign, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "نص أسفل الإيصال" : "Footer text"}</Label>
              <Input value={receiptDesign.footer} onChange={(e) => setReceiptDesign({ ...receiptDesign, footer: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "المقاس" : "Size"}</Label>
              <Select value={receiptDesign.width} onValueChange={(value) => setReceiptDesign({ ...receiptDesign, width: value as ReceiptDesign["width"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80mm</SelectItem>
                  <SelectItem value="A5">A5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={receiptDesign.showLogo ? "default" : "outline"}
                onClick={() => setReceiptDesign({ ...receiptDesign, showLogo: !receiptDesign.showLogo })}
              >
                {locale === "ar" ? "إظهار الشعار" : "Show logo"}
              </Button>
              <Button
                type="button"
                variant={receiptDesign.showPayments ? "default" : "outline"}
                onClick={() => setReceiptDesign({ ...receiptDesign, showPayments: !receiptDesign.showPayments })}
              >
                {locale === "ar" ? "إظهار المدفوعات" : "Show payments"}
              </Button>
            </div>
            <Button className="w-full" onClick={saveReceiptDesign}>
              {t(locale, "save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
