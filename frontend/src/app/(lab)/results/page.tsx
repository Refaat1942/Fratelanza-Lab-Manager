"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, CheckCircle, Settings2, FileText, Eye, Download, FlaskConical, Trash2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { ResultFormBuilder, type ResultField } from "@/components/results/result-form-builder";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { useDateRange } from "@/hooks/use-date-range";
import { TestLinesPicker, validTestIds, type TestCatalogItem, type TestLine } from "@/components/tests/test-lines-picker";
import { api, getApiError } from "@/lib/api";
import { exportModuleExcel, printOrderKitLabels, previewResultReport, printResultReport, downloadResultReport } from "@/lib/export";
import { KitLabelPrintMenu } from "@/components/labels/kit-label-print-menu";
import { toast } from "sonner";

interface Result {
  id: string;
  order_id: string;
  order_number: string;
  patient_name: string;
  test_name: string;
  test_code: string;
  test_id?: string;
  status: string;
  order_status: string;
  ordered_at: string;
}

export default function ResultsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [results, setResults] = useState<Result[]>([]);
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [tests, setTests] = useState<TestCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [testLines, setTestLines] = useState<TestLine[]>([{ testId: "" }]);
  const [saving, setSaving] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [enterId, setEnterId] = useState<string | null>(null);
  const [formMeta, setFormMeta] = useState<{ patient_name: string; test_name: string; order_number: string } | null>(null);
  const [fields, setFields] = useState<ResultField[]>([]);
  const [designOpen, setDesignOpen] = useState(false);
  const [designTestId, setDesignTestId] = useState<string | null>(null);
  const [designFields, setDesignFields] = useState<ResultField[]>([]);
  const { dateFrom, dateTo, setDateFrom, setDateTo, queryParams, reset } = useDateRange();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get(`/results${queryParams.replace(/^&/, "?")}`), api.get("/patients?page_size=100"), api.get("/tests?page_size=100")])
      .then(([res, pat, tst]) => {
        setResults(res.data.items || []);
        setPatients(pat.data.items || []);
        setTests(
          (tst.data.items || []).map((t: { id: string; name: string; price: number; cost: number }) => ({
            id: t.id,
            name: t.name,
            price: t.price,
            cost: t.cost ?? 0,
          }))
        );
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, [queryParams]);

  useEffect(() => { load(); }, [load]);

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const testIds = validTestIds(testLines);
    if (!patientId || testIds.length === 0) return;
    setSaving(true);
    try {
      await api.post("/results/orders", { patient_id: patientId, test_ids: testIds });
      toast.success(locale === "ar" ? "تم إنشاء الطلب" : "Order created");
      setOpen(false);
      setTestLines([{ testId: "" }]);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const collectSample = async (orderId: string, testCount: number) => {
    setCollectingId(orderId);
    try {
      await api.post(`/results/orders/${orderId}/collect`);
      toast.success(locale === "ar" ? "تم سحب العينة" : "Sample collected");
      load();
      try {
        await printOrderKitLabels(orderId, testCount > 1 ? "double" : "single");
      } catch {
        /* labels can be re-printed from the row menu */
      }
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setCollectingId(null);
    }
  };

  const deleteOrder = async (orderId: string, orderNumber: string, testCount: number) => {
    const msg =
      locale === "ar"
        ? `حذف الطلب ${orderNumber} وجميع تحاليله (${testCount})؟`
        : `Delete order ${orderNumber} and all ${testCount} test(s)?`;
    if (!confirm(msg)) return;
    try {
      await api.delete(`/results/orders/${orderId}`);
      toast.success(locale === "ar" ? "تم حذف الطلب" : "Order deleted");
      load();
    } catch (err) {
      toast.error(getApiError(err));
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

  const printReport = async (resultId: string) => {
    setPrintingId(resultId);
    try {
      await printResultReport(resultId);
      toast.success(
        locale === "ar"
          ? "تم فتح التقرير — اختر طابعة A4 أو Save as PDF"
          : "Report opened — choose A4 printer or Save as PDF"
      );
    } catch {
      toast.error(locale === "ar" ? "فشل طباعة التقرير" : "Report print failed");
    } finally {
      setPrintingId(null);
    }
  };

  const viewReport = async (resultId: string) => {
    setPrintingId(resultId);
    try {
      await previewResultReport(resultId);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setPrintingId(null);
    }
  };

  const saveReportPdf = async (resultId: string) => {
    try {
      await downloadResultReport(resultId);
      toast.success(locale === "ar" ? "تم تحميل PDF" : "PDF downloaded");
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

  const isReleased = (status: string) => status === "released" || status === "verified";
  const orderTestCounts = results.reduce<Record<string, number>>((acc, row) => {
    acc[row.order_id] = (acc[row.order_id] ?? 0) + 1;
    return acc;
  }, {});

  const columns: ColumnDef<Result>[] = [
    { accessorKey: "order_number", header: "Order #" },
    { accessorKey: "patient_name", header: locale === "ar" ? "المريض" : "Patient" },
    { accessorKey: "test_name", header: locale === "ar" ? "التحليل" : "Test" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant={isReleased(row.original.status) ? "default" : "secondary"}>{row.original.status}</Badge>,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.order_status === "pending" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={collectingId === row.original.order_id}
              onClick={() => collectSample(row.original.order_id, orderTestCounts[row.original.order_id] ?? 1)}
            >
              <FlaskConical className="mr-1 h-3 w-3" />
              {locale === "ar" ? "سحب عينة" : "Collect"}
            </Button>
          )}
          {(row.original.order_status === "collected" || row.original.order_status === "in_lab") && (
            <KitLabelPrintMenu
              locale={locale}
              orderId={row.original.order_id}
              resultId={row.original.id}
            />
          )}
          {isReleased(row.original.status) && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={printingId === row.original.id}
                onClick={() => viewReport(row.original.id)}
                title={locale === "ar" ? "عرض التقرير" : "View report"}
              >
                <Eye className="mr-1 h-3 w-3" />
                {locale === "ar" ? "عرض" : "View"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={printingId === row.original.id}
                onClick={() => printReport(row.original.id)}
              >
                <FileText className="mr-1 h-3 w-3" />
                {locale === "ar" ? "طباعة" : "Print"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveReportPdf(row.original.id)}
                title={locale === "ar" ? "تحميل PDF" : "Download PDF"}
              >
                <Download className="h-3 w-3" />
              </Button>
            </>
          )}
          {row.original.status === "pending" && (
            <Button size="sm" variant="outline" onClick={() => openEnterForm(row.original.id)}>
              <CheckCircle className="mr-1 h-3 w-3" />{locale === "ar" ? "إدخال" : "Enter"}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() =>
                  deleteOrder(
                    row.original.order_id,
                    row.original.order_number,
                    orderTestCounts[row.original.order_id] ?? 1
                  )
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {locale === "ar" ? "حذف الطلب" : "Delete order"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              <Settings2 className="mr-2 h-4 w-4" />
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
                    <SelectTrigger><SelectValue placeholder="Select test" /></SelectTrigger>
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
                <TestLinesPicker
                  locale={locale}
                  tests={tests}
                  lines={testLines}
                  onChange={setTestLines}
                  showLabCost
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || !patientId || validTestIds(testLines).length === 0}
                >
                  {t(locale, "save")}
                </Button>
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
          filterSlot={
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onReset={reset}
            />
          }
          onExport={() => exportModuleExcel("results", dateFrom, dateTo).catch((e) => toast.error(String(e)))}
        />
      )}
    </div>
  );
}
