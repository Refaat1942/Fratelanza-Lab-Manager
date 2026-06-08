"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { useDateRange } from "@/hooks/use-date-range";
import { api, getApiError } from "@/lib/api";
import { exportModuleExcel } from "@/lib/export";
import { toast } from "sonner";

interface Supplier {
  id: string;
  code: string;
  name: string;
  phone?: string;
  contact_person?: string;
  is_active: boolean;
}

const emptyForm = { name: "", phone: "", contact_person: "" };

export default function SuppliersPage() {
  const locale = useAuthStore((s) => s.locale);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { dateFrom, dateTo, setDateFrom, setDateTo, queryParams, reset } = useDateRange();

  const load = useCallback(() => {
    setLoading(true);
    api.get("/suppliers?page_size=100")
      .then((res) => setSuppliers(res.data.items || []))
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/suppliers/${editId}`, form);
        toast.success(locale === "ar" ? "تم التحديث" : "Supplier updated");
      } else {
        await api.post("/suppliers", form);
        toast.success(locale === "ar" ? "تم الإضافة" : "Supplier created");
      }
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (s: Supplier) => {
    setEditId(s.id);
    setForm({ name: s.name, phone: s.phone || "", contact_person: s.contact_person || "" });
    setOpen(true);
  };

  const columns: ColumnDef<Supplier>[] = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "name", header: locale === "ar" ? "الاسم" : "Name" },
    { accessorKey: "contact_person", header: "Contact" },
    { accessorKey: "phone", header: locale === "ar" ? "الهاتف" : "Phone" },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => <Badge variant={row.original.is_active ? "default" : "secondary"}>{row.original.is_active ? "Active" : "Inactive"}</Badge>,
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
            <DropdownMenuItem className="text-destructive" onClick={async () => {
              if (!confirm(locale === "ar" ? "حذف المورد؟" : "Delete supplier?")) return;
              try {
                await api.delete(`/suppliers/${row.original.id}`);
                toast.success("Deleted");
                load();
              } catch (err) { toast.error(getApiError(err)); }
            }}>
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
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "suppliers")}</h1>
          <p className="text-muted-foreground">{suppliers.length} suppliers</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
          <DialogTrigger render={<Button />}><Plus className="mr-2 h-4 w-4" />{t(locale, "create")}</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit Supplier" : "New Supplier"}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Contact</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={saving}>{t(locale, "save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <DataTable
          columns={columns}
          data={suppliers}
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
          onExport={() => exportModuleExcel("suppliers", dateFrom, dateTo).catch((e) => toast.error(String(e)))}
        />
      )}
    </div>
  );
}
