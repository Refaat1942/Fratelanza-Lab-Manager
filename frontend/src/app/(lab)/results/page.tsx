"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, CheckCircle } from "lucide-react";
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

interface Result {
  id: string;
  order_number: string;
  patient_name: string;
  test_name: string;
  test_code: string;
  status: string;
  ordered_at: string;
}

export default function ResultsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [results, setResults] = useState<Result[]>([]);
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [tests, setTests] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [testId, setTestId] = useState("");
  const [resultValue, setResultValue] = useState("");
  const [enterOpen, setEnterOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/results"),
      api.get("/patients?page_size=100"),
      api.get("/tests?page_size=100"),
    ])
      .then(([res, pat, tst]) => {
        setResults(res.data.items || []);
        setPatients(pat.data.items || []);
        setTests(tst.data.items || []);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/results/orders", { patient_id: patientId, test_ids: [testId] });
      toast.success(locale === "ar" ? "تم إنشاء الطلب" : "Order created");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const enterResult = async (resultId: string) => {
    try {
      await api.post(`/results/${resultId}/enter`, {
        values: [{ parameter_name: "Result", value: resultValue }],
      });
      await api.post(`/results/${resultId}/release`);
      toast.success("Result released");
      setEnterOpen(null);
      setResultValue("");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const columns: ColumnDef<Result>[] = [
    { accessorKey: "order_number", header: "Order #" },
    { accessorKey: "patient_name", header: locale === "ar" ? "المريض" : "Patient" },
    { accessorKey: "test_name", header: locale === "ar" ? "التحليل" : "Test" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant={row.original.status === "released" ? "default" : "secondary"}>{row.original.status}</Badge>,
    },
    {
      id: "actions",
      cell: ({ row }) => row.original.status === "pending" ? (
        <Button size="sm" variant="outline" onClick={() => setEnterOpen(row.original.id)}>
          <CheckCircle className="mr-1 h-3 w-3" />
          {locale === "ar" ? "إدخال" : "Enter"}
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "results")}</h1>
          <p className="text-muted-foreground">{results.length} {locale === "ar" ? "نتيجة" : "results"}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />{t(locale, "create")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{locale === "ar" ? "طلب تحليل جديد" : "New Test Order"}</DialogTitle></DialogHeader>
            <form onSubmit={createOrder} className="space-y-4">
              <div className="space-y-2">
                <Label>{locale === "ar" ? "المريض" : "Patient"}</Label>
                <Select value={patientId} onValueChange={(v) => v && setPatientId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "التحليل" : "Test"}</Label>
                <Select value={testId} onValueChange={(v) => v && setTestId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{tests.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={saving || !patientId || !testId}>{t(locale, "save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!enterOpen} onOpenChange={() => setEnterOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{locale === "ar" ? "إدخال النتيجة" : "Enter Result"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{locale === "ar" ? "القيمة" : "Value"}</Label>
              <Input value={resultValue} onChange={(e) => setResultValue(e.target.value)} placeholder="e.g. 95 mg/dL" />
            </div>
            <Button className="w-full" onClick={() => enterOpen && enterResult(enterOpen)} disabled={!resultValue}>
              {locale === "ar" ? "حفظ وإصدار" : "Save & Release"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <DataTable columns={columns} data={results} searchPlaceholder={t(locale, "search")} />
      )}
    </div>
  );
}
