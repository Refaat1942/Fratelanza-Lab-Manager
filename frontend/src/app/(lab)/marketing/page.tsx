"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";

interface Campaign {
  id: string;
  name: string;
  name_ar?: string;
  channel?: string;
  status: string;
  budget?: number;
  description?: string;
  created_at: string;
}

const emptyForm = { name: "", name_ar: "", channel: "", budget: "", description: "" };

export default function MarketingPage() {
  const locale = useAuthStore((s) => s.locale);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/crm/campaigns?page_size=100")
      .then((res) => setCampaigns(res.data.items || []))
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/crm/campaigns", {
        name: form.name,
        name_ar: form.name_ar || null,
        channel: form.channel || null,
        budget: form.budget ? parseFloat(form.budget) : null,
        description: form.description || null,
      });
      toast.success(locale === "ar" ? "تم إنشاء الحملة" : "Campaign created");
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<Campaign>[] = [
    { accessorKey: "name", header: locale === "ar" ? "الحملة" : "Campaign", cell: ({ row }) => locale === "ar" && row.original.name_ar ? row.original.name_ar : row.original.name },
    { accessorKey: "channel", header: locale === "ar" ? "القناة" : "Channel" },
    {
      accessorKey: "status",
      header: locale === "ar" ? "الحالة" : "Status",
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    { accessorKey: "budget", header: locale === "ar" ? "الميزانية" : "Budget", cell: ({ row }) => row.original.budget ? `EGP ${row.original.budget.toLocaleString()}` : "—" },
    { accessorKey: "created_at", header: locale === "ar" ? "تاريخ الإنشاء" : "Created", cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString() },
    {
      id: "del",
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={async () => {
          if (!confirm(locale === "ar" ? "حذف الحملة؟" : "Delete campaign?")) return;
          try {
            await api.delete(`/crm/campaigns/${row.original.id}`);
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
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "marketing")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "حملات التسويق وتتبع التواصل" : "Marketing campaigns and outreach tracking"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="me-2 h-4 w-4" />{t(locale, "create")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{locale === "ar" ? "حملة جديدة" : "New Campaign"}</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الاسم (إنجليزي)" : "Name (EN)"} *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الاسم (عربي)" : "Name (AR)"}</Label>
                  <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "القناة" : "Channel"}</Label>
                  <Input value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} placeholder="social, sms, email" />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الميزانية" : "Budget (EGP)"}</Label>
                  <Input type="number" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "الوصف" : "Description"}</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
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
          data={campaigns}
          searchPlaceholder={t(locale, "search")}
          dateAccessor="created_at"
          exportFileName="marketing-campaigns.xls"
          locale={locale}
        />
      )}
    </div>
  );
}
