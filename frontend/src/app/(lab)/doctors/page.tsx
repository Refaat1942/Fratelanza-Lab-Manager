"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { useDateRange } from "@/hooks/use-date-range";
import { api, getApiError } from "@/lib/api";
import { exportModuleExcel } from "@/lib/export";
import { toast } from "sonner";

interface Doctor {
  id: string;
  code: string;
  full_name: string;
  full_name_ar?: string;
  specialty?: string;
  phone?: string;
  commission_rate: number;
  is_active: boolean;
}

const emptyDoctor = {
  full_name: "", full_name_ar: "", specialty: "", phone: "", commission_rate: "0",
};

export default function DoctorsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyDoctor);
  const [saving, setSaving] = useState(false);
  const { dateFrom, dateTo, setDateFrom, setDateTo, queryParams, reset } = useDateRange();

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/doctors?page_size=100${queryParams}`)
      .then((res) => setDoctors(res.data.items || []))
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, [queryParams]);

  useEffect(() => { load(); }, [load]);

  const saveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, commission_rate: parseFloat(form.commission_rate) || 0 };
    try {
      if (editId) {
        await api.put(`/doctors/${editId}`, payload);
        toast.success(locale === "ar" ? "تم تحديث الطبيب" : "Doctor updated");
      } else {
        await api.post("/doctors", payload);
        toast.success(locale === "ar" ? "تم إضافة الطبيب" : "Doctor created");
      }
      setOpen(false);
      setEditId(null);
      setForm(emptyDoctor);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (doctor: Doctor) => {
    try {
      const { data } = await api.get(`/doctors/${doctor.id}`);
      setEditId(doctor.id);
      setForm({
        full_name: data.full_name || "",
        full_name_ar: data.full_name_ar || "",
        specialty: data.specialty || "",
        phone: data.phone || "",
        commission_rate: String(data.commission_rate ?? 0),
      });
      setOpen(true);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const deleteDoctor = async (id: string) => {
    if (!confirm(locale === "ar" ? "حذف الطبيب؟" : "Delete doctor?")) return;
    try {
      await api.delete(`/doctors/${id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const columns: ColumnDef<Doctor>[] = [
    { accessorKey: "code", header: locale === "ar" ? "الكود" : "Code" },
    {
      accessorKey: "full_name",
      header: locale === "ar" ? "الاسم" : "Name",
      cell: ({ row }) => locale === "ar" ? row.original.full_name_ar || row.original.full_name : row.original.full_name,
    },
    { accessorKey: "specialty", header: locale === "ar" ? "التخصص" : "Specialty" },
    { accessorKey: "phone", header: locale === "ar" ? "الهاتف" : "Phone" },
    {
      accessorKey: "commission_rate",
      header: locale === "ar" ? "العمولة %" : "Commission %",
      cell: ({ row }) => `${row.original.commission_rate}%`,
    },
    {
      accessorKey: "is_active",
      header: locale === "ar" ? "الحالة" : "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />{t(locale, "edit")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => deleteDoctor(row.original.id)}>
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
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "doctors")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "قاعدة بيانات الأطباء والعمولات" : "Doctor database, commissions, and referrals"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyDoctor); } }}>
          <DialogTrigger render={<Button className="shadow-md" />}>
            <Plus className="mr-2 h-4 w-4" />
            {t(locale, "create")}
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? (locale === "ar" ? "تعديل طبيب" : "Edit Doctor") : (locale === "ar" ? "طبيب جديد" : "New Doctor")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveDoctor} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الاسم (إنجليزي)" : "Name (EN)"} *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الاسم (عربي)" : "Name (AR)"}</Label>
                  <Input value={form.full_name_ar} onChange={(e) => setForm({ ...form, full_name_ar: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "التخصص" : "Specialty"}</Label>
                  <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الهاتف" : "Phone"}</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "نسبة العمولة %" : "Commission %"}</Label>
                <Input type="number" min="0" max="100" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : t(locale, "save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={doctors}
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
          onExport={() => exportModuleExcel("doctors", dateFrom, dateTo).catch((e) => toast.error(String(e)))}
        />
      )}
    </div>
  );
}
