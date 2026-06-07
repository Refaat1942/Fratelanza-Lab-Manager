"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  total: number;
  paid_amount: number;
  status: string;
  issued_at?: string;
}

interface Patient { id: string; full_name: string; }
interface TestItem { id: string; name: string; price: number; }

export default function BillingPage() {
  const locale = useAuthStore((s) => s.locale);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [testId, setTestId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/billing/invoices"),
      api.get("/patients?page_size=100"),
      api.get("/tests?page_size=100"),
    ])
      .then(([inv, pat, tst]) => {
        setInvoices(inv.data.items || []);
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

  const columns: ColumnDef<Invoice>[] = [
    { accessorKey: "invoice_number", header: "Invoice #" },
    { accessorKey: "patient_name", header: locale === "ar" ? "المريض" : "Patient" },
    { accessorKey: "total", header: "Total", cell: ({ row }) => `EGP ${row.original.total}` },
    { accessorKey: "paid_amount", header: "Paid", cell: ({ row }) => `EGP ${row.original.paid_amount}` },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    {
      id: "pay",
      cell: ({ row }) => row.original.status !== "paid" ? (
        <Button size="sm" variant="outline" onClick={async () => {
          const due = row.original.total - row.original.paid_amount;
          try {
            await api.post(`/billing/invoices/${row.original.id}/payments`, { amount: due });
            toast.success("Payment recorded");
            load();
          } catch (err) { toast.error(getApiError(err)); }
        }}>
          {locale === "ar" ? "دفع" : "Pay"}
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "billing")}</h1>
          <p className="text-muted-foreground">{invoices.length} {locale === "ar" ? "فاتورة" : "invoices"}</p>
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
              <Button type="submit" className="w-full" disabled={saving || !patientId || !testId}>
                {saving ? "..." : t(locale, "save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <DataTable columns={columns} data={invoices} searchPlaceholder={t(locale, "search")} />
      )}
    </div>
  );
}
