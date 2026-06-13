"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import { TestLinesPicker, validTestIds, type TestCatalogItem, type TestLine } from "@/components/tests/test-lines-picker";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { useDateRange } from "@/hooks/use-date-range";
import { api, getApiError } from "@/lib/api";
import { exportModuleExcel } from "@/lib/export";
import { toast } from "sonner";

interface Patient {
  id: string;
  patient_code: string;
  full_name: string;
  phone?: string;
  age?: number;
  created_at: string;
}

const emptyVisit = { full_name: "", phone: "", age: "" };
const emptyEdit = { full_name: "", phone: "", age: "" };

export default function PatientsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tests, setTests] = useState<TestCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewPatient, setViewPatient] = useState<Patient | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [visitForm, setVisitForm] = useState(emptyVisit);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [testLines, setTestLines] = useState<TestLine[]>([{ testId: "" }]);
  const [discount, setDiscount] = useState("0");
  const [saving, setSaving] = useState(false);
  const { dateFrom, dateTo, setDateFrom, setDateTo, queryParams, reset } = useDateRange();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/patients?page_size=100${queryParams}`),
      api.get("/tests?page_size=100"),
    ])
      .then(([patRes, testsRes]) => {
        setPatients(patRes.data.items || []);
        setTests(
          (testsRes.data.items || []).map((t: { id: string; name: string; price: number; cost: number }) => ({
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

  const resetVisitForm = () => {
    setVisitForm(emptyVisit);
    setTestLines([{ testId: "" }]);
    setDiscount("0");
  };

  const saveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    const testIds = validTestIds(testLines);
    if (!visitForm.full_name.trim() || !visitForm.phone.trim() || testIds.length === 0) {
      toast.error(locale === "ar" ? "أكمل الاسم والهاتف واختر تحليلاً واحداً على الأقل" : "Enter name, phone, and at least one test");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/patients/quick-visit", {
        full_name: visitForm.full_name.trim(),
        phone: visitForm.phone.trim(),
        age: visitForm.age ? parseInt(visitForm.age, 10) : null,
        test_ids: testIds,
        discount: parseFloat(discount) || 0,
      });
      toast.success(
        locale === "ar"
          ? `تم التسجيل — ${data.test_count} تحليل — EGP ${data.total_price.toLocaleString()}`
          : `Registered — ${data.test_count} test(s) — EGP ${data.total_price.toLocaleString()}`
      );
      setOpen(false);
      resetVisitForm();
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (patient: Patient) => {
    try {
      const { data } = await api.get(`/patients/${patient.id}`);
      setEditId(patient.id);
      setEditForm({
        full_name: data.full_name || "",
        phone: data.phone || "",
        age: data.age != null ? String(data.age) : "",
      });
      setEditOpen(true);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      await api.put(`/patients/${editId}`, {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim(),
        notes: editForm.age ? `Age: ${editForm.age}` : null,
      });
      toast.success(locale === "ar" ? "تم تحديث المريض" : "Patient updated");
      setEditOpen(false);
      setEditId(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const deletePatient = async (id: string) => {
    if (!confirm(locale === "ar" ? "حذف المريض؟" : "Delete patient?")) return;
    try {
      await api.delete(`/patients/${id}`);
      toast.success(locale === "ar" ? "تم الحذف" : "Deleted");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const columns: ColumnDef<Patient>[] = [
    { accessorKey: "patient_code", header: locale === "ar" ? "الكود" : "Code" },
    {
      accessorKey: "full_name",
      header: locale === "ar" ? "الاسم" : "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.full_name}</span>,
    },
    { accessorKey: "phone", header: locale === "ar" ? "الهاتف" : "Phone", cell: ({ row }) => row.original.phone || "—" },
    {
      accessorKey: "age",
      header: locale === "ar" ? "العمر" : "Age",
      cell: ({ row }) => (row.original.age != null ? row.original.age : "—"),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setViewPatient(row.original)}>
              <Eye className="mr-2 h-4 w-4" />{locale === "ar" ? "عرض" : "View"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />{t(locale, "edit")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => deletePatient(row.original.id)}>
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
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "patients")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar"
              ? "تسجيل مريض مع التحاليل والسعر تلقائياً"
              : "Register patient with tests — price calculated automatically"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetVisitForm(); }}>
          <DialogTrigger render={<Button className="shadow-md" />}>
            <Plus className="mr-2 h-4 w-4" />
            {locale === "ar" ? "مريض وتحاليل" : "New Patient & Tests"}
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{locale === "ar" ? "تسجيل مريض جديد" : "New Patient Visit"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveVisit} className="space-y-4">
              <div className="space-y-2">
                <Label>{locale === "ar" ? "الاسم" : "Name"} *</Label>
                <Input
                  value={visitForm.full_name}
                  onChange={(e) => setVisitForm({ ...visitForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الهاتف" : "Phone"} *</Label>
                  <Input
                    value={visitForm.phone}
                    onChange={(e) => setVisitForm({ ...visitForm, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "العمر" : "Age"}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="150"
                    value={visitForm.age}
                    onChange={(e) => setVisitForm({ ...visitForm, age: e.target.value })}
                  />
                </div>
              </div>
              <TestLinesPicker
                locale={locale}
                tests={tests}
                lines={testLines}
                onChange={setTestLines}
                showLabCost
              />
              <div className="space-y-2">
                <Label>{locale === "ar" ? "خصم (جنيه)" : "Discount (EGP)"}</Label>
                <Input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving
                  ? locale === "ar" ? "جاري الحفظ..." : "Saving..."
                  : locale === "ar" ? "تسجيل وإنشاء الفاتورة" : "Register & Create Invoice"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{locale === "ar" ? "تعديل المريض" : "Edit Patient"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>{locale === "ar" ? "الاسم" : "Name"} *</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{locale === "ar" ? "الهاتف" : "Phone"}</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "العمر" : "Age"}</Label>
                <Input
                  type="number"
                  min="0"
                  max="150"
                  value={editForm.age}
                  onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {t(locale, "save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewPatient} onOpenChange={() => setViewPatient(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{viewPatient?.full_name}</DialogTitle>
          </DialogHeader>
          {viewPatient && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{locale === "ar" ? "الكود" : "Code"}</dt>
                <dd className="font-medium">{viewPatient.patient_code}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{locale === "ar" ? "الهاتف" : "Phone"}</dt>
                <dd>{viewPatient.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{locale === "ar" ? "العمر" : "Age"}</dt>
                <dd>{viewPatient.age != null ? viewPatient.age : "—"}</dd>
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={patients}
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
          onExport={() => exportModuleExcel("patients", dateFrom, dateTo).catch((e) => toast.error(String(e)))}
        />
      )}
    </div>
  );
}
