"use client";

import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Lock, Unlock, Ban, CheckCircle, Trash2, RefreshCw, Pencil } from "lucide-react";
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
import { ModuleToggles, type ModuleCatalogItem } from "@/components/platform/module-toggles";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";

interface Tenant {
  id: string;
  code: string;
  name: string;
  email: string;
  status: string;
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
  features?: { modules: Record<string, boolean>; enabled_modules: string[] };
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

export default function TenantsPage() {
  const { locale } = useLocale("platform");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editLimits, setEditLimits] = useState<TenantLimits | null>(null);
  const [moduleCatalog, setModuleCatalog] = useState<ModuleCatalogItem[]>([]);
  const [moduleStates, setModuleStates] = useState<Record<string, boolean>>({});
  const [initialModuleStates, setInitialModuleStates] = useState<Record<string, boolean>>({});
  const [initialAdmin, setInitialAdmin] = useState({ username: "", name: "", name_ar: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/platform/tenants"),
      api.get("/platform/plans"),
      api.get("/platform/modules"),
    ]).then(([tRes, pRes, mRes]) => {
      setTenants(tRes.data);
      setPlans(pRes.data);
      setModuleCatalog(mRes.data);
    }).catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const action = async (tenantId: string, endpoint: string, label: string) => {
    try {
      await api.post(`/platform/tenants/${tenantId}/${endpoint}`);
      toast.success(label);
      load();
    } catch {
      toast.error(`Failed: ${label}`);
    }
  };

  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.plan_id) {
      toast.error(locale === "ar" ? "اختر الباقة" : "Select a subscription plan");
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
      const modules =
        data.features?.modules ||
        Object.fromEntries(moduleCatalog.map((m) => [m.key, true]));
      setModuleStates(modules);
      setInitialModuleStates(modules);
      setInitialAdmin({
        username: data.admin?.username || "",
        name: data.admin?.full_name || "",
        name_ar: data.admin?.full_name_ar || "",
      });
      setEditForm({
        name: data.name || "",
        name_ar: data.name_ar || "",
        email: data.email || "",
        phone: data.phone || "",
        tax_number: data.tax_number || "",
        status: data.status || "active",
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
      const flags = moduleCatalog.map((item) => ({
        feature_key: item.key,
        is_enabled: moduleStates[item.key] ?? true,
        config: {},
      }));
      const featuresChanged = flags.some(
        (f) => (initialModuleStates[f.feature_key] ?? true) !== f.is_enabled
      );
      if (flags.length > 0 && featuresChanged) {
        await api.put(`/platform/tenants/${editId}/features`, flags);
      }

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

      const adminChanged =
        editForm.admin_password ||
        editForm.admin_username.trim() !== initialAdmin.username ||
        editForm.admin_name.trim() !== initialAdmin.name ||
        editForm.admin_name_ar.trim() !== initialAdmin.name_ar;

      if (adminChanged) {
        const adminPayload: Record<string, string> = {};
        if (editForm.admin_username.trim()) adminPayload.username = editForm.admin_username.trim();
        if (editForm.admin_password) adminPayload.password = editForm.admin_password;
        if (editForm.admin_name.trim()) adminPayload.full_name = editForm.admin_name.trim();
        if (editForm.admin_name_ar.trim()) adminPayload.full_name_ar = editForm.admin_name_ar.trim();
        if (Object.keys(adminPayload).length > 0) {
          await api.patch(`/platform/tenants/${editId}/admin`, adminPayload);
        }
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

  const columns: ColumnDef<Tenant>[] = [
    { accessorKey: "code", header: locale === "ar" ? "الكود" : "Code" },
    { accessorKey: "name", header: locale === "ar" ? "الاسم" : "Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "status",
      header: locale === "ar" ? "الحالة" : "Status",
      cell: ({ row }) => {
        const s = row.original.status;
        const variant = s === "active" ? "default" : s === "trial" ? "secondary" : "destructive";
        return <Badge variant={variant}>{s}</Badge>;
      },
    },
    {
      accessorKey: "created_at",
      header: locale === "ar" ? "تاريخ الإنشاء" : "Created",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)} title={locale === "ar" ? "تعديل" : "Edit"}>
            <Pencil className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => action(row.original.id, "activate", "Activated")}>
                <CheckCircle className="mr-2 h-4 w-4" /> {t(locale, "activate")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => action(row.original.id, "suspend", "Suspended")}>
                <Ban className="mr-2 h-4 w-4" /> {t(locale, "suspend")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => action(row.original.id, "renew", "Renewed")}>
                <RefreshCw className="mr-2 h-4 w-4" /> {t(locale, "renew")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => action(row.original.id, "lock", "Locked")}>
                <Lock className="mr-2 h-4 w-4" /> {t(locale, "lock")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => action(row.original.id, "unlock", "Unlocked")}>
                <Unlock className="mr-2 h-4 w-4" /> {t(locale, "unlock")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={async () => {
                  if (confirm(locale === "ar" ? "حذف هذا المختبر؟" : "Delete this laboratory?")) {
                    await api.delete(`/platform/tenants/${row.original.id}`);
                    toast.success(locale === "ar" ? "تم الحذف" : "Deleted");
                    load();
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> {t(locale, "delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t(locale, "tenants")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar"
              ? "إنشاء وتعديل المختبرات وبيانات دخول المدير"
              : "Create, edit laboratories and manage admin login credentials"}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    {["active", "trial", "suspended", "locked", "expired"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-border/60 pt-4">
              <p className="mb-3 text-sm font-semibold">
                {locale === "ar" ? "حدود المستخدمين والفروع" : "User & Branch Limits"}
              </p>
              {editLimits && (
                <p className="mb-3 text-xs text-muted-foreground">
                  {locale === "ar"
                    ? `الاستخدام الحالي: ${editLimits.current_users}/${editLimits.max_users} مستخدم، ${editLimits.current_branches}/${editLimits.max_branches} فرع`
                    : `Current usage: ${editLimits.current_users}/${editLimits.max_users} users, ${editLimits.current_branches}/${editLimits.max_branches} branches`}
                  {editLimits.plan_max_users != null && (
                    <span className="block mt-1">
                      {locale === "ar"
                        ? `حدود الباقة: ${editLimits.plan_max_users} مستخدم، ${editLimits.plan_max_branches} فرع`
                        : `Plan defaults: ${editLimits.plan_max_users} users, ${editLimits.plan_max_branches} branches`}
                    </span>
                  )}
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "حد المستخدمين" : "Max Users"}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.max_users_override}
                    onChange={(e) => setEditForm({ ...editForm, max_users_override: e.target.value })}
                    placeholder={editLimits?.plan_max_users?.toString() || "5"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "حد الفروع" : "Max Branches"}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.max_branches_override}
                    onChange={(e) => setEditForm({ ...editForm, max_branches_override: e.target.value })}
                    placeholder={editLimits?.plan_max_branches?.toString() || "1"}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {locale === "ar"
                  ? "اترك الحقل فارغاً لاستخدام حدود الباقة الافتراضية"
                  : "Leave blank to use subscription plan defaults"}
              </p>
            </div>

            <div className="border-t border-border/60 pt-4">
              <ModuleToggles
                locale={locale}
                catalog={moduleCatalog}
                states={moduleStates}
                onChange={(key, enabled) =>
                  setModuleStates((prev) => ({ ...prev, [key]: enabled }))
                }
              />
            </div>

            <div className="border-t border-border/60 pt-4">
              <p className="mb-3 text-sm font-semibold">
                {locale === "ar" ? "بيانات دخول مدير المختبر" : "Laboratory Admin Login"}
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "اسم المدير" : "Admin Name"}</Label>
                  <Input value={editForm.admin_name} onChange={(e) => setEditForm({ ...editForm, admin_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "اسم المستخدم" : "Username"} *</Label>
                  <Input
                    value={editForm.admin_username}
                    onChange={(e) => setEditForm({ ...editForm, admin_username: e.target.value })}
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "كلمة المرور الجديدة" : "New Password"}</Label>
                  <Input
                    type="password"
                    value={editForm.admin_password}
                    onChange={(e) => setEditForm({ ...editForm, admin_password: e.target.value })}
                    minLength={8}
                    placeholder={locale === "ar" ? "اتركه فارغاً للإبقاء على الحالية" : "Leave blank to keep current"}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving
                ? locale === "ar"
                  ? "جاري الحفظ..."
                  : "Saving..."
                : locale === "ar"
                  ? "حفظ التغييرات"
                  : "Save Changes"}
            </Button>
          </form>
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
