"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";

interface Contact {
  id: string;
  full_name: string;
  organization?: string;
  phone?: string;
  email?: string;
  contact_type: string;
  source?: string;
  notes?: string;
  created_at?: string;
}

const emptyForm = { full_name: "", organization: "", phone: "", email: "", contact_type: "lead", source: "", notes: "" };
const TYPES = ["lead", "customer", "partner", "vendor"];

export default function CrmPage() {
  const locale = useAuthStore((s) => s.locale);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/crm/contacts?page_size=100")
      .then((res) => setContacts(res.data.items || []))
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, email: form.email || null };
    try {
      if (editId) {
        await api.put(`/crm/contacts/${editId}`, payload);
        toast.success(locale === "ar" ? "تم التحديث" : "Contact updated");
      } else {
        await api.post("/crm/contacts", payload);
        toast.success(locale === "ar" ? "تم الإضافة" : "Contact created");
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

  const openEdit = (c: Contact) => {
    setEditId(c.id);
    setForm({
      full_name: c.full_name,
      organization: c.organization || "",
      phone: c.phone || "",
      email: c.email || "",
      contact_type: c.contact_type,
      source: c.source || "",
      notes: c.notes || "",
    });
    setOpen(true);
  };

  const deleteContact = async (id: string) => {
    if (!confirm(locale === "ar" ? "حذف جهة الاتصال؟" : "Delete contact?")) return;
    try {
      await api.delete(`/crm/contacts/${id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const columns: ColumnDef<Contact>[] = [
    { accessorKey: "full_name", header: locale === "ar" ? "الاسم" : "Name" },
    { accessorKey: "organization", header: locale === "ar" ? "المنظمة" : "Organization" },
    {
      accessorKey: "contact_type",
      header: locale === "ar" ? "النوع" : "Type",
      cell: ({ row }) => <Badge variant="outline">{row.original.contact_type}</Badge>,
    },
    { accessorKey: "phone", header: locale === "ar" ? "الهاتف" : "Phone" },
    { accessorKey: "source", header: locale === "ar" ? "المصدر" : "Source" },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="me-2 h-4 w-4" />{t(locale, "edit")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => deleteContact(row.original.id)}>
              <Trash2 className="me-2 h-4 w-4" />{t(locale, "delete")}
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
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "crm")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "إدارة علاقات العملاء وتتبع العملاء المحتملين" : "Customer relationship management and lead tracking"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
          <DialogTrigger render={<Button />}>
            <Plus className="me-2 h-4 w-4" />{t(locale, "create")}
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? (locale === "ar" ? "تعديل جهة اتصال" : "Edit Contact") : (locale === "ar" ? "جهة اتصال جديدة" : "New Contact")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الاسم" : "Name"} *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "المنظمة" : "Organization"}</Label>
                  <Input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الهاتف" : "Phone"}</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "النوع" : "Type"}</Label>
                  <Select value={form.contact_type} onValueChange={(v) => v && setForm({ ...form, contact_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "المصدر" : "Source"}</Label>
                  <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="walk-in, referral, web" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
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
          data={contacts}
          searchPlaceholder={t(locale, "search")}
          dateAccessor="created_at"
          exportFileName="crm-contacts.xls"
          locale={locale}
        />
      )}
    </div>
  );
}
