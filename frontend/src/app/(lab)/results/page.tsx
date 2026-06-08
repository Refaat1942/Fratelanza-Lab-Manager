"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, CheckCircle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { ResultFormBuilder, type ResultField } from "@/components/results/result-form-builder";
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
  test_id?: string;
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
  const [saving, setSaving] = useState(false);
  const [enterId, setEnterId] = useState<string | null>(null);
  const [formMeta, setFormMeta] = useState<{ patient_name: string; test_name: string; order_number: string } | null>(null);
  const [fields, setFields] = useState<ResultField[]>([]);
  const [designOpen, setDesignOpen] = useState(false);
  const [designTestId, setDesignTestId] = useState<string | null>(null);
  const [designFields, setDesignFields] = useState<ResultField[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get("/results"), api.get("/patients?page_size=100"), api.get("/tests?page_size=100")])
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

  const openEnterForm = async (resultId: string) => {
    try {
      const { data } = await api.get(`/results/${resultId}/form`);
      setFormMeta({ patient_name: data.patient_name, test_name: data.test_name, order_number: data.order_number });
      setFields(data.fields.map((f: ResultField) => ({ ...f, value: "" })));
      setEnterId(resultId);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const submitResult = async () => {
    if (!enterId) return;
    try {
      await api.post(`/results/${enterId}/enter`, {
        values: fields.map((f) => ({
          parameter_name: f.parameter_name,
          value: f.value || "",
          unit: f.unit,
        })),
      });
      await api.post(`/results/${enterId}/release`);
      toast.success(locale === "ar" ? "تم إصدار النتيجة" : "Result released");
      setEnterId(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const openDesigner = async (testId: string) => {
    try {
      const { data } = await api.get(`/tests/${testId}/result-template`);
      setDesignFields(data.length ? data : [{ parameter_name: "Result", parameter_name_ar: "النتيجة", unit: "", field_type: "numeric", sort_order: 0 }]);
      setDesignTestId(testId);
    } catch {
      setDesignFields([{ parameter_name: "Result", parameter_name_ar: "النتيجة", unit: "", field_type: "numeric", sort_order: 0 }]);
      setDesignTestId(testId);
    }
  };

  const saveTemplate = async () => {
    if (!designTestId) return;
    try {
      await api.put(`/tests/${designTestId}/result-template`, { fields: designFields });
      toast.success(locale === "ar" ? "تم حفظ نموذج النتيجة" : "Result form saved");
      setDesignOpen(false);
      setDesignTestId(null);
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
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.status === "pending" && (
            <Button size="sm" variant="outline" onClick={() => openEnterForm(row.original.id)}>
              <CheckCircle className="me-1 h-3 w-3" />{locale === "ar" ? "إدخال" : "Enter"}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "results")}</h1>
          <p className="text-muted-foreground">{results.length} {locale === "ar" ? "نتيجة" : "results"}</p>
        </div>
        <div className="flex gap-2">
          <Dialog
            open={designOpen}
            onOpenChange={(open) => {
              setDesignOpen(open);
              if (!open) {
                setDesignTestId(null);
                setDesignFields([]);
              }
            }}
          >
            <DialogTrigger render={<Button variant="outline" />}>
              <Settings2 className="me-2 h-4 w-4" />
              {locale === "ar" ? "تصميم النموذج" : "Design Form"}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{locale === "ar" ? "تصميم نموذج النتيجة" : "Design Result Form"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "اختر التحليل" : "Select Test"}</Label>
                  <Select value={designTestId || ""} onValueChange={(v) => v && openDesigner(v)}>
                    <SelectTrigger><SelectValue placeholder={locale === "ar" ? "اختر التحليل" : "Select test"} /></SelectTrigger>
                    <SelectContent>
                      {tests.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {designTestId && (
                  <>
                    <ResultFormBuilder fields={designFields} onChange={setDesignFields} locale={locale} mode="design" />
                    <Button className="w-full" onClick={saveTemplate}>{t(locale, "save")}</Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="me-2 h-4 w-4" />{t(locale, "create")}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{locale === "ar" ? "طلب تحليل جديد" : "New Test Order"}</DialogTitle></DialogHeader>
              <form onSubmit={createOrder} className="space-y-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "المريض" : "Patient"}</Label>
                  <Select value={patientId} onValueChange={(v) => v && setPatientId(v)}>
                    <SelectTrigger><SelectValue placeholder={locale === "ar" ? "اختر" : "Select"} /></SelectTrigger>
                    <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "التحليل" : "Test"}</Label>
                  <Select value={testId} onValueChange={(v) => v && setTestId(v)}>
                    <SelectTrigger><SelectValue placeholder={locale === "ar" ? "اختر" : "Select"} /></SelectTrigger>
                    <SelectContent>{tests.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={saving || !patientId || !testId}>{t(locale, "save")}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={!!enterId} onOpenChange={() => setEnterId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{locale === "ar" ? "إدخال النتيجة" : "Enter Result"}</DialogTitle>
            {formMeta && (
              <p className="text-sm text-muted-foreground">
                {formMeta.patient_name} — {formMeta.test_name} ({formMeta.order_number})
              </p>
            )}
          </DialogHeader>
          <ResultFormBuilder fields={fields} onChange={setFields} locale={locale} mode="entry" />
          <Button className="w-full" onClick={submitResult}>
            {locale === "ar" ? "حفظ وإصدار النتيجة" : "Save & Release Result"}
          </Button>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <DataTable
          columns={columns}
          data={results}
          searchPlaceholder={t(locale, "search")}
          dateAccessor="ordered_at"
          exportFileName="results.xls"
          locale={locale}
        />
      )}
    </div>
  );
}
