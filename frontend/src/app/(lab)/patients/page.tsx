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
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";

interface Patient {
  id: string;
  patient_code: string;
  full_name: string;
  full_name_ar?: string;
  phone?: string;
  national_id?: string;
  gender?: string;
  created_at: string;
}

const emptyPatient = {
  full_name: "", full_name_ar: "", phone: "", national_id: "",
  email: "", address: "", city: "", governorate: "",
};

export default function PatientsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPatient);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/patients")
      .then((res) => setPatients(res.data.items || []))
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const savePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/patients/${editId}`, form);
        toast.success(locale === "ar" ? "تم تحديث المريض" : "Patient updated");
      } else {
        await api.post("/patients", form);
        toast.success(locale === "ar" ? "تم إضافة المريض" : "Patient created");
      }
      setOpen(false);
      setEditId(null);
      setForm(emptyPatient);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (patient: Patient) => {
    setEditId(patient.id);
    setForm({
      full_name: patient.full_name,
      full_name_ar: patient.full_name_ar || "",
      phone: patient.phone || "",
      national_id: patient.national_id || "",
      email: "", address: "", city: "", governorate: "",
    });
    setOpen(true);
  };

  const deletePatient = async (id: string) => {
    if (!confirm(locale === "ar" ? "حذف المريض؟" : "Delete patient?")) return;
    try {
      await api.delete(`/patients/${id}`);
      toast.success("Deleted");
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
      cell: ({ row }) => (
        <span className="font-medium">
          {locale === "ar" ? row.original.full_name_ar || row.original.full_name : row.original.full_name}
        </span>
      ),
    },
    { accessorKey: "phone", header: locale === "ar" ? "الهاتف" : "Phone" },
    { accessorKey: "national_id", header: locale === "ar" ? "الرقم القومي" : "National ID" },
    {
      accessorKey: "gender",
      header: locale === "ar" ? "النوع" : "Gender",
      cell: ({ row }) => row.original.gender ? <Badge variant="outline">{row.original.gender}</Badge> : "—",
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
          <h1 className="text-3xl font-bold">{t(locale, "patients")}</h1>
          <p className="text-muted-foreground">{patients.length} {locale === "ar" ? "مريض" : "patients"}</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(emptyPatient); } }}>
          <DialogTrigger render={<Button className="shadow-md" />}>
            <Plus className="mr-2 h-4 w-4" />
            {t(locale, "create")}
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? (locale === "ar" ? "تعديل مريض" : "Edit Patient") : (locale === "ar" ? "مريض جديد" : "New Patient")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={savePatient} className="space-y-4">
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
                  <Label>{locale === "ar" ? "الهاتف" : "Phone"}</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الرقم القومي" : "National ID"}</Label>
                  <Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
          data={patients}
          searchPlaceholder={t(locale, "search")}
          onExport={() => toast.info("Export coming soon")}
        />
      )}
    </div>
  );
}
