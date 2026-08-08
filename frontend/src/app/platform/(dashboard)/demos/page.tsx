"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Copy, Pencil, Link2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useLocale } from "@/hooks/use-locale";
import { api, getApiError } from "@/lib/api";
import { planSelectDescription, planSelectLabel, type PlanLike } from "@/lib/plan-format";
import { toast } from "sonner";

interface DemoLink {
  tenant_id: string;
  code: string;
  name: string;
  name_ar?: string;
  admin_username: string;
  plan_name?: string;
  plan_tier?: string;
  valid_from?: string;
  valid_to?: string;
  days_remaining?: number;
  status: string;
  login_path: string;
}

interface Plan extends PlanLike {
  id: string;
}

const emptyCreate = {
  code: "",
  name: "",
  name_ar: "",
  valid_days: "14",
  plan_id: "",
  admin_username: "demo",
  admin_password: "Demo@123",
  admin_name: "Demo Administrator",
};

function demoFullUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function fmtDate(value?: string, locale?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB");
}

export default function DemoLinksPage() {
  const { locale } = useLocale("platform");
  const isAr = locale === "ar";
  const [demos, setDemos] = useState<DemoLink[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState({ valid_to: "", valid_days: "14", admin_password: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get("/platform/demos"), api.get("/platform/plans")])
      .then(([dRes, pRes]) => {
        setDemos(dRes.data || []);
        setPlans(pRes.data || []);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyLink = (demo: DemoLink) => {
    const url = demoFullUrl(demo.login_path);
    const text = isAr
      ? `رابط العرض: ${url}\nكود المختبر: ${demo.code}\nالمستخدم: ${demo.admin_username}`
      : `Demo link: ${url}\nLab code: ${demo.code}\nUsername: ${demo.admin_username}`;
    navigator.clipboard.writeText(text).then(
      () => toast.success(isAr ? "تم نسخ رابط العرض وبيانات الدخول" : "Demo link and login details copied"),
      () => toast.error(isAr ? "فشل النسخ" : "Copy failed"),
    );
  };

  const createDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/platform/demos", {
        code: createForm.code.trim().toLowerCase(),
        name: createForm.name,
        name_ar: createForm.name_ar || null,
        valid_days: parseInt(createForm.valid_days, 10) || 14,
        plan_id: createForm.plan_id || null,
        admin_username: createForm.admin_username.trim().toLowerCase(),
        admin_password: createForm.admin_password,
        admin_name: createForm.admin_name,
      });
      toast.success(isAr ? "تم إنشاء رابط العرض" : "Demo link created");
      setOpen(false);
      setCreateForm(emptyCreate);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (demo: DemoLink) => {
    setEditId(demo.tenant_id);
    setEditForm({
      valid_to: demo.valid_to?.slice(0, 10) || "",
      valid_days: "14",
      admin_password: "",
    });
    setEditOpen(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (editForm.valid_to) {
        payload.valid_to = new Date(`${editForm.valid_to}T23:59:59Z`).toISOString();
      }
      if (editForm.admin_password) {
        payload.admin_password = editForm.admin_password;
      }
      await api.patch(`/platform/demos/${editId}`, payload);
      toast.success(isAr ? "تم تحديث العرض" : "Demo updated");
      setEditOpen(false);
      setEditId(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const extendDemo = async (demo: DemoLink, days: number) => {
    try {
      await api.patch(`/platform/demos/${demo.tenant_id}`, { valid_days: days });
      toast.success(isAr ? `تم تمديد العرض ${days} يوماً` : `Extended demo by ${days} days`);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const columns: ColumnDef<DemoLink>[] = [
    { accessorKey: "code", header: isAr ? "الكود" : "Code" },
    {
      accessorKey: "name",
      header: isAr ? "اسم العرض" : "Demo name",
      cell: ({ row }) => (isAr && row.original.name_ar ? row.original.name_ar : row.original.name),
    },
    {
      id: "plan",
      header: isAr ? "الباقة" : "Plan",
      cell: ({ row }) => (
        <div className="text-sm">
          <div>{row.original.plan_name || "—"}</div>
          {row.original.plan_tier && (
            <div className="text-xs text-muted-foreground capitalize">{row.original.plan_tier}</div>
          )}
        </div>
      ),
    },
    {
      id: "validity",
      header: isAr ? "صلاحية العرض" : "Demo validity",
      cell: ({ row }) => (
        <div className="text-sm whitespace-nowrap">
          {fmtDate(row.original.valid_from, locale)} → {fmtDate(row.original.valid_to, locale)}
          {row.original.days_remaining != null && (
            <Badge variant={row.original.days_remaining <= 3 ? "destructive" : "secondary"} className="ml-2">
              {row.original.days_remaining} {isAr ? "يوم" : "days"}
            </Badge>
          )}
        </div>
      ),
    },
    { accessorKey: "admin_username", header: isAr ? "المستخدم" : "Username" },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => copyLink(row.original)}>
            <Copy className="mr-1 h-3 w-3" />
            {isAr ? "نسخ" : "Copy"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => extendDemo(row.original, 7)} title={isAr ? "تمديد 7 أيام" : "Extend 7 days"}>
            +7d
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Link2 className="h-8 w-8 text-primary" />
            {isAr ? "روابط العرض التجريبي" : "Demo Links"}
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {isAr
              ? "أنشئ روابط تجريبية للعملاء مع مدة صلاحية مستقلة — منفصلة عن شاشة إنشاء المختبرات الدائمة."
              : "Create time-limited demo links for prospects — separate from permanent laboratory setup."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="shadow-md" />}>
            <Plus className="mr-2 h-4 w-4" />
            {isAr ? "عرض تجريبي جديد" : "New demo link"}
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isAr ? "إنشاء رابط عرض تجريبي" : "Create demo link"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={createDemo} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isAr ? "كود المختبر" : "Lab code"} *</Label>
                  <Input
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                    placeholder="demo-clinic"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "يُستخدم في الرابط: /login?lab=..." : "Used in link: /login?lab=..."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{isAr ? "مدة العرض (يوم)" : "Demo duration (days)"} *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={createForm.valid_days}
                    onChange={(e) => setCreateForm({ ...createForm, valid_days: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{isAr ? "اسم العرض (إنجليزي)" : "Demo name (EN)"} *</Label>
                <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>{isAr ? "اسم العرض (عربي)" : "Demo name (AR)"}</Label>
                <Input value={createForm.name_ar} onChange={(e) => setCreateForm({ ...createForm, name_ar: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{isAr ? "باقة العرض" : "Demo plan"}</Label>
                <Select value={createForm.plan_id} onValueChange={(v) => setCreateForm({ ...createForm, plan_id: v || "" })}>
                  <SelectTrigger><SelectValue placeholder={isAr ? "افتراضي: Professional Monthly" : "Default: Professional Monthly"} /></SelectTrigger>
                  <SelectContent>
                    {plans.filter((p) => p.tier === "professional" || p.tier === "enterprise").map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div>
                          <div>{planSelectLabel(p, locale)}</div>
                          <div className="text-xs text-muted-foreground">{planSelectDescription(p, locale)}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <CalendarClock className="mb-1 inline h-4 w-4" />
                {isAr
                  ? " سيحصل العميل على باقة Professional افتراضياً مع كل الوحدات المناسبة للعرض."
                  : " Customer gets Professional plan features by default — ideal for demos."}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isAr ? "اسم المدير" : "Admin name"} *</Label>
                  <Input value={createForm.admin_name} onChange={(e) => setCreateForm({ ...createForm, admin_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>{isAr ? "اسم المستخدم" : "Username"} *</Label>
                  <Input value={createForm.admin_username} onChange={(e) => setCreateForm({ ...createForm, admin_username: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{isAr ? "كلمة المرور" : "Password"} *</Label>
                <Input type="password" value={createForm.admin_password} onChange={(e) => setCreateForm({ ...createForm, admin_password: e.target.value })} required minLength={8} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {isAr ? "إنشاء الرابط" : "Create demo link"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAr ? "تعديل صلاحية العرض" : "Edit demo validity"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>{isAr ? "صالح حتى" : "Valid until"}</Label>
              <Input type="date" value={editForm.valid_to} onChange={(e) => setEditForm({ ...editForm, valid_to: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{isAr ? "كلمة مرور جديدة (اختياري)" : "New password (optional)"}</Label>
              <Input type="password" value={editForm.admin_password} onChange={(e) => setEditForm({ ...editForm, admin_password: e.target.value })} minLength={8} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>{isAr ? "حفظ" : "Save"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable columns={columns} data={demos} searchPlaceholder={isAr ? "بحث..." : "Search..."} />
      )}
    </div>
  );
}
