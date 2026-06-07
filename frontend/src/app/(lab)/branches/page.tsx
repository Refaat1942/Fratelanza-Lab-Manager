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

interface Branch {
  id: string;
  code: string;
  name: string;
  name_ar?: string;
  city?: string;
  governorate?: string;
  phone?: string;
  is_headquarters: boolean;
  is_active: boolean;
}

const emptyBranch = {
  code: "", name: "", name_ar: "", city: "", governorate: "", phone: "",
};

export default function BranchesPage() {
  const locale = useAuthStore((s) => s.locale);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [limits, setLimits] = useState<{ max_branches: number; current_branches: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyBranch);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get("/branches"), api.get("/settings/limits")])
      .then(([branchRes, limitsRes]) => {
        setBranches(branchRes.data || []);
        setLimits(limitsRes.data);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/branches/${editId}`, form);
        toast.success(locale === "ar" ? "تم تحديث الفرع" : "Branch updated");
      } else {
        await api.post("/branches", form);
        toast.success(locale === "ar" ? "تم إضافة الفرع" : "Branch created");
      }
      setOpen(false);
      setEditId(null);
      setForm(emptyBranch);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (branch: Branch) => {
    setEditId(branch.id);
    setForm({
      code: branch.code,
      name: branch.name,
      name_ar: branch.name_ar || "",
      city: branch.city || "",
      governorate: branch.governorate || "",
      phone: branch.phone || "",
    });
    setOpen(true);
  };

  const deleteBranch = async (id: string) => {
    if (!confirm(locale === "ar" ? "حذف الفرع؟" : "Delete branch?")) return;
    try {
      await api.delete(`/branches/${id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const columns: ColumnDef<Branch>[] = [
    { accessorKey: "code", header: "Code" },
    {
      accessorKey: "name",
      header: locale === "ar" ? "الاسم" : "Name",
      cell: ({ row }) => locale === "ar" ? row.original.name_ar || row.original.name : row.original.name,
    },
    { accessorKey: "city", header: locale === "ar" ? "المدينة" : "City" },
    { accessorKey: "governorate", header: locale === "ar" ? "المحافظة" : "Governorate" },
    { accessorKey: "phone", header: locale === "ar" ? "الهاتف" : "Phone" },
    {
      accessorKey: "is_headquarters",
      header: "HQ",
      cell: ({ row }) => row.original.is_headquarters ? <Badge>HQ</Badge> : "—",
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
            <DropdownMenuItem className="text-destructive" onClick={() => deleteBranch(row.original.id)}>
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
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "branches")}</h1>
          <p className="text-muted-foreground">
            {limits
              ? locale === "ar"
                ? `${limits.current_branches} / ${limits.max_branches} فرع`
                : `${limits.current_branches} / ${limits.max_branches} branches`
              : locale === "ar"
                ? "عمليات متعددة الفروع"
                : "Multi-branch operations with separate inventory and revenue"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyBranch); } }}>
          <DialogTrigger
            render={
              <Button
                className="shadow-md"
                disabled={!!limits && limits.current_branches >= limits.max_branches && !editId}
              />
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            {t(locale, "create")}
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? (locale === "ar" ? "تعديل فرع" : "Edit Branch") : (locale === "ar" ? "فرع جديد" : "New Branch")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveBranch} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!editId} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الهاتف" : "Phone"}</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
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
                  <Label>{locale === "ar" ? "المدينة" : "City"}</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "المحافظة" : "Governorate"}</Label>
                  <Input value={form.governorate} onChange={(e) => setForm({ ...form, governorate: e.target.value })} />
                </div>
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
        <DataTable columns={columns} data={branches} searchPlaceholder={t(locale, "search")} />
      )}
    </div>
  );
}
