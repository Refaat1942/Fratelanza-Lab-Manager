"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Eye, Trash2, MoreHorizontal } from "lucide-react";
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
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
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

export default function BillingPage() {
  const locale = useAuthStore((s) => s.locale);
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

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/billing/invoices?page_size=100"),
      api.get("/billing/summary"),
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
  }, []);

  useEffect(() => { load(); }, [load]);

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
        <DataTable columns={columns} data={invoices} searchPlaceholder={t(locale, "search")} />
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.invoice_number} — {detail.patient_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
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
    </div>
  );
}
