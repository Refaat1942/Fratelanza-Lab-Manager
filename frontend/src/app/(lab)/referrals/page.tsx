"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { useDateRange } from "@/hooks/use-date-range";
import { api, getApiError } from "@/lib/api";
import { exportModuleExcel } from "@/lib/export";
import { toast } from "sonner";

interface Referral {
  id: string;
  doctor_name: string;
  patient_name: string;
  referral_date: string;
  notes?: string;
}

interface Doctor { id: string; full_name: string; }
interface Patient { id: string; full_name: string; }

export default function ReferralsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [doctorId, setDoctorId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { dateFrom, dateTo, setDateFrom, setDateTo, queryParams, reset } = useDateRange();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/referrals?page_size=100"),
      api.get("/doctors?page_size=100"),
      api.get("/patients?page_size=100"),
    ])
      .then(([ref, doc, pat]) => {
        setReferrals(ref.data.items || []);
        setDoctors(doc.data.items || []);
        setPatients(pat.data.items || []);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/referrals", { doctor_id: doctorId, patient_id: patientId, notes: notes || null });
      toast.success(locale === "ar" ? "تم تسجيل الإحالة" : "Referral created");
      setOpen(false);
      setDoctorId("");
      setPatientId("");
      setNotes("");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<Referral>[] = [
    { accessorKey: "doctor_name", header: locale === "ar" ? "الطبيب" : "Doctor" },
    { accessorKey: "patient_name", header: locale === "ar" ? "المريض" : "Patient" },
    { accessorKey: "referral_date", header: locale === "ar" ? "التاريخ" : "Date", cell: ({ row }) => new Date(row.original.referral_date).toLocaleDateString() },
    { accessorKey: "notes", header: locale === "ar" ? "ملاحظات" : "Notes" },
    {
      id: "del",
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={async () => {
          if (!confirm(locale === "ar" ? "حذف الإحالة؟" : "Delete referral?")) return;
          try {
            await api.delete(`/referrals/${row.original.id}`);
            toast.success("Deleted");
            load();
          } catch (err) { toast.error(getApiError(err)); }
        }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "referrals")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "إحالات الأطباء للمرضى" : "Doctor referrals and patient tracking"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />{t(locale, "create")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{locale === "ar" ? "إحالة جديدة" : "New Referral"}</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label>{locale === "ar" ? "الطبيب" : "Doctor"}</Label>
                <Select value={doctorId} onValueChange={(v) => v && setDoctorId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
                <Label>{locale === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={saving || !doctorId || !patientId}>{t(locale, "save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <DataTable
          columns={columns}
          data={referrals}
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
          onExport={() => exportModuleExcel("referrals", dateFrom, dateTo).catch((e) => toast.error(String(e)))}
        />
      )}
    </div>
  );
}
