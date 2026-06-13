"use client";

import { useCallback, useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, MoreHorizontal, Ban, CheckCircle, Trash2, RefreshCw, Pencil, RotateCcw, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";

type LifecycleFilter = "active" | "suspended" | "deleted";

interface Tenant {
  id: string;
  code: string;
  name: string;
  email: string;
  status: string;
  deleted_at?: string | null;
  created_at: string;
}

interface Plan {
  id: string;
  name: string;
  tier: string;
  price_egp: number;
}

interface TenantAdmin {
  id: string;
  username: string;
  full_name: string;
  full_name_ar?: string;
  is_active: boolean;
}

interface TenantLimits {
  max_users: number;
  max_branches: number;
  current_users: number;
  current_branches: number;
  plan_max_users?: number;
  plan_max_branches?: number;
  max_users_override?: number;
  max_branches_override?: number;
}

interface TenantDetail {
  id: string;
  code: string;
  name: string;
  name_ar?: string;
  email?: string;
  phone?: string;
  tax_number?: string;
  status: string;
  max_users_override?: number;
  max_branches_override?: number;
  admin?: TenantAdmin;
  limits?: TenantLimits;
}

const emptyForm = {
  code: "", name: "", name_ar: "", email: "", phone: "",
  plan_id: "", admin_username: "", admin_password: "", admin_name: "",
};

const emptyEditForm = {
  name: "", name_ar: "", email: "", phone: "", tax_number: "", status: "active",
  admin_username: "", admin_password: "", admin_name: "", admin_name_ar: "",
  max_users_override: "", max_branches_override: "",
};

const FILTER_TABS: { key: LifecycleFilter; labelEn: string; labelAr: string }[] = [
  { key: "active", labelEn: "Active", labelAr: "نشطة" },
  { key: "suspended", labelEn: "Suspended", labelAr: "معلقة" },
  { key: "deleted", labelEn: "Deleted", labelAr: "محذوفة" },
];

export default function TenantsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [lifecycle, setLifecycle] = useState<LifecycleFilter>("active");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<Tenant | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editLimits, setEditLimits] = useState<TenantLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/platform/tenants?lifecycle=${lifecycle}`),
      api.get("/platform/plans"),
    ]).then(([tRes, pRes]) => {
      setTenants(tRes.data);
      setPlans(pRes.data);
    }).catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, [lifecycle]);

  useEffect(() => { load(); }, [load]);

  const action = async (tenantId: string, endpoint: string, label: string) => {
    try {
      await api.post(`/platform/tenants/${tenantId}/${endpoint}`);
      toast.success(label);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const softDelete = async (tenant: Tenant) => {
    const msg = locale === "ar"
      ? `حذف المختبر "${tenant.code}"؟ يمكن استعادته أو إعادة استخدام الكود لاحقاً.`
      : `Delete laboratory "${tenant.code}"? You can restore it or reuse the code later.`;
    if (!confirm(msg)) return;
    try {
      await api.delete(`/platform/tenants/${tenant.id}`);
      toast.success(locale === "ar" ? "تم الحذف" : "Moved to deleted");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const permanentDelete = async () => {
    if (!purgeTarget) return;
    try {
      await api.post(`/platform/tenants/${purgeTarget.id}/permanent-delete`, {
        confirm_code: purgeConfirm.trim(),
      });
      toast.success(locale === "ar" ? "تم الحذف النهائي" : "Permanently deleted");
      setPurgeOpen(false);
      setPurgeTarget(null);
      setPurgeConfirm("");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.plan_id) {
      toast.error(locale === "ar" ? "اختر الباقة" : "Select a plan");
      return;
    }
    try {
      await api.post("/platform/tenants", {
        ...form,
        code: form.code.trim().toLowerCase(),
        admin_username: form.admin_username.trim().toLowerCase(),
      });
      toast.success(locale === "ar" ? "تم إنشاء المختبر" : "Laboratory created");
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const openEdit = async (tenant: Tenant) => {
    try {
      const { data } = await api.get<TenantDetail>(`/platform/tenants/${tenant.id}`);
      setEditId(tenant.id);
      setEditCode(data.code);
      setEditLimits(data.limits || null);
      setEditForm({
        name: data.name || "",
        name_ar: data.name_ar || "",
        email: data.email || "",
        phone: data.phone || "",
        tax_number: data.tax_number || "",
        status: data.status === "suspended" ? "suspended" : "active",
        admin_username: data.admin?.username || "",
        admin_password: "",
        admin_name: data.admin?.full_name || "",
        admin_name_ar: data.admin?.full_name_ar || "",
        max_users_override: data.max_users_override?.toString() || "",
        max_branches_override: data.max_branches_override?.toString() || "",
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
      await api.patch(`/platform/tenants/${editId}`, {
        name: editForm.name,
        name_ar: editForm.name_ar || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        tax_number: editForm.tax_number || null,
        status: editForm.status,
        max_users_override: editForm.max_users_override ? Number(editForm.max_users_override) : null,
        max_branches_override: editForm.max_branches_override ? Number(editForm.max_branches_override) : null,
      });

      const adminPayload: Record<string, string> = {};
      if (editForm.admin_username.trim()) adminPayload.username = editForm.admin_username.trim();
      if (editForm.admin_password) adminPayload.password = editForm.admin_password;
      if (editForm.admin_name.trim()) adminPayload.full_name = editForm.admin_name.trim();
      if (editForm.admin_name_ar.trim()) adminPayload.full_name_ar = editForm.admin_name_ar.trim();

      if (Object.keys(adminPayload).length > 0) {
        await api.patch(`/platform/tenants/${editId}/admin`, adminPayload);
      }

      toast.success(locale === "ar" ? "تم تحديث المختبر" : "Laboratory updated");
      setEditOpen(false);
      setEditId(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (tenant: Tenant) => {
    if (tenant.deleted_at) {
      return <Badge variant="destructive">{locale === "ar" ? "محذوف" : "deleted"}</Badge>;
    }
    if (tenant.status === "suspended") {
      return <Badge variant="secondary">{locale === "ar" ? "معلق" : "suspended"}</Badge>;
    }
    return <Badge variant="default">{locale === "ar" ? "نشط" : "active"}</Badge>;
  };

  const columns: ColumnDef<Tenant>[] = [
    { accessorKey: "code", header: locale === "ar" ? "الكود" : "Code" },
    { accessorKey: "name", header: locale === "ar" ? "الاسم" : "Name" },
    { accessorKey: "email", header: "Email" },
    {
      id: "status",
      header: locale === "ar" ? "الحالة" : "Status",
      cell: ({ row }) => statusBadge(row.original),
    },
    {
      accessorKey: "created_at",
      header: locale === "ar" ? "تاريخ الإنشاء" : "Created",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const tenant = row.original;
        const isDeleted = lifecycle === "deleted";

        return (
          <div className="flex items-center gap-1">
            {!isDeleted && (
              <Button variant="ghost" size="sm" onClick={() => openEdit(tenant)} title={locale === "ar" ? "تعديل" : "Edit"}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isDeleted ? (
                  <>
                    <DropdownMenuItem onClick={() => action(tenant.id, "restore", locale === "ar" ? "تمت الاستعادة" : "Restored")}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {locale === "ar" ? "استعادة" : "Restore"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setPurgeTarget(tenant);
                        setPurgeConfirm("");
                        setPurgeOpen(true);
                      }}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      {locale === "ar" ? "حذف نهائي" : "Permanent delete"}
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {lifecycle !== "active" && (
                      <DropdownMenuItem onClick={() => action(tenant.id, "activate", locale === "ar" ? "تم التفعيل" : "Activated")}>
                        <CheckCircle className="mr-2 h-4 w-4" /> {t(locale, "activate")}
                      </DropdownMenuItem>
                    )}
                    {lifecycle !== "suspended" && (
                      <DropdownMenuItem onClick={() => action(tenant.id, "suspend", locale === "ar" ? "تم التعليق" : "Suspended")}>
                        <Ban className="mr-2 h-4 w-4" /> {t(locale, "suspend")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => action(tenant.id, "renew", locale === "ar" ? "تم التجديد" : "Renewed")}>
                      <RefreshCw className="mr-2 h-4 w-4" /> {t(locale, "renew")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => softDelete(tenant)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {locale === "ar" ? "حذف (ناعم)" : "Delete"}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t(locale, "tenants")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar"
              ? "إدارة دورة حياة المختبرات: نشطة، معلقة، محذوفة"
              : "Manage laboratory lifecycle: active, suspended, deleted"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            {t(locale, "create")}
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{locale === "ar" ? "مختبر جديد" : "New Laboratory"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={createTenant} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الباقة" : "Plan"} *</Label>
                  <Select value={form.plan_id} onValueChange={(v) => v && setForm({ ...form, plan_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — EGP {p.price_egp}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Name (EN) *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Name (AR)</Label>
                <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Admin Name *</Label>
                <Input value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Admin Username *</Label>
                <Input value={form.admin_username} onChange={(e) => setForm({ ...form, admin_username: e.target.value })} required minLength={2} />
              </div>
              <div className="space-y-2">
                <Label>Admin Password *</Label>
                <Input type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} required minLength={8} />
              </div>
              <Button type="submit" className="w-full">{t(locale, "create")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={lifecycle === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setLifecycle(tab.key)}
          >
            {locale === "ar" ? tab.labelAr : tab.labelEn}
          </Button>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {locale === "ar" ? "تعديل المختبر" : "Edit Laboratory"}
              {editCode ? ` — ${editCode}` : ""}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
              {locale === "ar"
                ? `كود المختبر: ${editCode} (لا يمكن تغييره)`
                : `Lab code: ${editCode} (cannot be changed)`}
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "الاسم (إنجليزي)" : "Name (EN)"} *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "الاسم (عربي)" : "Name (AR)"}</Label>
              <Input value={editForm.name_ar} onChange={(e) => setEditForm({ ...editForm, name_ar: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "الهاتف" : "Phone"}</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{locale === "ar" ? "الرقم الضريبي" : "Tax Number"}</Label>
                <Input value={editForm.tax_number} onChange={(e) => setEditForm({ ...editForm, tax_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "الحالة" : "Status"}</Label>
                <Select value={editForm.status} onValueChange={(v) => v && setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{locale === "ar" ? "نشط" : "Active"}</SelectItem>
                    <SelectItem value="suspended">{locale === "ar" ? "معلق" : "Suspended"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border-t border-border/60 pt-4">
              <p className="mb-3 text-sm font-semibold">
                {locale === "ar" ? "بيانات دخول مدير المختبر" : "Laboratory Admin Login"}
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "اسم المستخدم" : "Username"} *</Label>
                  <Input value={editForm.admin_username} onChange={(e) => setEditForm({ ...editForm, admin_username: e.target.value })} required minLength={2} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "كلمة المرور الجديدة" : "New Password"}</Label>
                  <Input type="password" value={editForm.admin_password} onChange={(e) => setEditForm({ ...editForm, admin_password: e.target.value })} minLength={8} />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "..." : locale === "ar" ? "حفظ التغييرات" : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {locale === "ar" ? "حذف نهائي" : "Permanent Delete"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {locale === "ar"
              ? `سيتم حذف جميع بيانات المختبر "${purgeTarget?.code}" نهائياً ولا يمكن التراجع. اكتب الكود للتأكيد.`
              : `All data for "${purgeTarget?.code}" will be permanently removed. Type the lab code to confirm.`}
          </p>
          <div className="space-y-2">
            <Label>{locale === "ar" ? "كود المختبر" : "Laboratory code"}</Label>
            <Input
              value={purgeConfirm}
              onChange={(e) => setPurgeConfirm(e.target.value)}
              placeholder={purgeTarget?.code}
            />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            disabled={purgeConfirm.trim().toLowerCase() !== purgeTarget?.code.toLowerCase()}
            onClick={permanentDelete}
          >
            {locale === "ar" ? "حذف نهائياً" : "Delete permanently"}
          </Button>
        </DialogContent>
      </Dialog>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DataTable columns={columns} data={tenants} searchPlaceholder={t(locale, "search")} />
      )}
    </div>
  );
}
