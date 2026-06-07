"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  phone_secondary?: string;
  national_id?: string;
  gender?: string;
  date_of_birth?: string;
  email?: string;
  address?: string;
  city?: string;
  governorate?: string;
  blood_type?: string;
  notes?: string;
  created_at: string;
}

const emptyPatient = {
  full_name: "", full_name_ar: "", phone: "", phone_secondary: "", national_id: "",
  email: "", address: "", city: "", governorate: "", gender: "", date_of_birth: "",
  blood_type: "", notes: "",
};

const GOVERNORATES = ["Cairo", "Giza", "Alexandria", "Qalyubia", "Sharqia", "Dakahlia", "Beheira", "Monufia", "Gharbia", "Kafr El Sheikh", "Damietta", "Port Said", "Ismailia", "Suez", "Fayoum", "Beni Suef", "Minya", "Assiut", "Sohag", "Qena", "Luxor", "Aswan", "Red Sea", "New Valley", "Matrouh", "North Sinai", "South Sinai"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function PatientsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [viewPatient, setViewPatient] = useState<Patient | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPatient);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/patients?page_size=100")
      .then((res) => setPatients(res.data.items || []))
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const savePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      email: form.email || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      blood_type: form.blood_type || null,
    };
    try {
      if (editId) {
        await api.put(`/patients/${editId}`, payload);
        toast.success(locale === "ar" ? "تم تحديث المريض" : "Patient updated");
      } else {
        await api.post("/patients", payload);
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

  const openEdit = async (patient: Patient) => {
    try {
      const { data } = await api.get(`/patients/${patient.id}`);
      setEditId(patient.id);
      setForm({
        full_name: data.full_name || "",
        full_name_ar: data.full_name_ar || "",
        phone: data.phone || "",
        phone_secondary: data.phone_secondary || "",
        national_id: data.national_id || "",
        email: data.email || "",
        address: data.address || "",
        city: data.city || "",
        governorate: data.governorate || "",
        gender: data.gender || "",
        date_of_birth: data.date_of_birth || "",
        blood_type: data.blood_type || "",
        notes: data.notes || "",
      });
      setOpen(true);
    } catch (err) {
      toast.error(getApiError(err));
    }
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
    { accessorKey: "city", header: locale === "ar" ? "المدينة" : "City" },
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

  const PatientForm = () => (
    <form onSubmit={savePatient} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <Tabs defaultValue="personal">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal">{locale === "ar" ? "شخصي" : "Personal"}</TabsTrigger>
          <TabsTrigger value="contact">{locale === "ar" ? "اتصال" : "Contact"}</TabsTrigger>
          <TabsTrigger value="medical">{locale === "ar" ? "طبي" : "Medical"}</TabsTrigger>
        </TabsList>
        <TabsContent value="personal" className="space-y-4 pt-4">
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
              <Label>{locale === "ar" ? "النوع" : "Gender"}</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v || "" })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{locale === "ar" ? "ذكر" : "Male"}</SelectItem>
                  <SelectItem value="female">{locale === "ar" ? "أنثى" : "Female"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "تاريخ الميلاد" : "Date of Birth"}</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{locale === "ar" ? "الرقم القومي" : "National ID"}</Label>
            <Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} maxLength={14} />
          </div>
        </TabsContent>
        <TabsContent value="contact" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{locale === "ar" ? "الهاتف" : "Phone"}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "هاتف إضافي" : "Secondary Phone"}</Label>
              <Input value={form.phone_secondary} onChange={(e) => setForm({ ...form, phone_secondary: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{locale === "ar" ? "البريد (اختياري)" : "Email (optional)"}</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{locale === "ar" ? "العنوان" : "Address"}</Label>
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{locale === "ar" ? "المدينة" : "City"}</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "المحافظة" : "Governorate"}</Label>
              <Select value={form.governorate} onValueChange={(v) => setForm({ ...form, governorate: v || "" })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {GOVERNORATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="medical" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>{locale === "ar" ? "فصيلة الدم" : "Blood Type"}</Label>
            <Select value={form.blood_type} onValueChange={(v) => setForm({ ...form, blood_type: v || "" })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {BLOOD_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{locale === "ar" ? "ملاحظات" : "Notes"}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} />
          </div>
        </TabsContent>
      </Tabs>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving..." : t(locale, "save")}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "patients")}</h1>
          <p className="text-muted-foreground">{patients.length} {locale === "ar" ? "مريض" : "patients"}</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(emptyPatient); } }}>
          <DialogTrigger render={<Button className="shadow-md" />}>
            <Plus className="mr-2 h-4 w-4" />{t(locale, "create")}
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editId ? (locale === "ar" ? "تعديل مريض" : "Edit Patient") : (locale === "ar" ? "مريض جديد" : "New Patient")}</DialogTitle>
            </DialogHeader>
            <PatientForm />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!viewPatient} onOpenChange={() => setViewPatient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewPatient?.full_name}</DialogTitle>
          </DialogHeader>
          {viewPatient && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Code</dt><dd className="font-medium">{viewPatient.patient_code}</dd></div>
              <div><dt className="text-muted-foreground">{locale === "ar" ? "الهاتف" : "Phone"}</dt><dd>{viewPatient.phone || "—"}</dd></div>
              <div><dt className="text-muted-foreground">{locale === "ar" ? "الرقم القومي" : "National ID"}</dt><dd>{viewPatient.national_id || "—"}</dd></div>
              <div><dt className="text-muted-foreground">{locale === "ar" ? "النوع" : "Gender"}</dt><dd>{viewPatient.gender || "—"}</dd></div>
              <div><dt className="text-muted-foreground">{locale === "ar" ? "المدينة" : "City"}</dt><dd>{viewPatient.city || "—"}</dd></div>
              <div><dt className="text-muted-foreground">{locale === "ar" ? "فصيلة الدم" : "Blood"}</dt><dd>{viewPatient.blood_type || "—"}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground">{locale === "ar" ? "العنوان" : "Address"}</dt><dd>{viewPatient.address || "—"}</dd></div>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable columns={columns} data={patients} searchPlaceholder={t(locale, "search")} />
      )}
    </div>
  );
}
