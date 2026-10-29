"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, Copy, Pencil, Link2, CalendarClock, Pause, Play, MessageCircle, Check, KeyRound, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  access_path?: string | null;
}

interface Plan extends PlanLike {
  id: string;
}

type DemoState = "active" | "paused" | "expired";

const emptyCreate = {
  code: "",
  name: "",
  name_ar: "",
  valid_days: "14",
  plan_id: "",
  admin_username: "demo",
  admin_password: "",
  admin_name: "Demo Administrator",
};

const DURATION_PRESETS = [3, 7, 14, 30];

function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function fmtDate(value?: string, locale?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB");
}

function demoState(demo: DemoLink): DemoState {
  if (demo.status === "suspended") return "paused";
  if (!demo.valid_to || new Date(demo.valid_to) <= new Date()) return "expired";
  return "active";
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
  const [editForm, setEditForm] = useState({ valid_to: "", admin_password: "" });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<DemoLink | null>(null);
  const [copied, setCopied] = useState(false);

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

  const instantMessage = (demo: DemoLink) => {
    const url = absoluteUrl(demo.access_path || demo.login_path);
    const until = fmtDate(demo.valid_to, locale);
    return isAr
      ? `جرّب نظام إدارة المختبر مجاناً حتى ${until}:\n${url}\nالرابط يفتح النظام مباشرة بدون كلمة مرور.`
      : `Try the laboratory system free until ${until}:\n${url}\nThe link opens the system directly — no password needed.`;
  };

  const copyText = (text: string, done: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast.success(done),
      () => toast.error(isAr ? "فشل النسخ" : "Copy failed"),
    );

  const copyInstantLink = (demo: DemoLink) => {
    if (!demo.access_path) {
      toast.error(isAr ? "العرض متوقف أو منتهي — فعّله أو مدّده أولاً" : "Demo is paused or expired — resume or extend it first");
      return;
    }
    copyText(absoluteUrl(demo.access_path), isAr ? "تم نسخ الرابط المباشر" : "Instant link copied");
  };

  const copyLoginDetails = (demo: DemoLink) => {
    const url = absoluteUrl(demo.login_path);
    copyText(
      isAr
        ? `رابط الدخول: ${url}\nكود المختبر: ${demo.code}\nالمستخدم: ${demo.admin_username}`
        : `Sign-in link: ${url}\nLab code: ${demo.code}\nUsername: ${demo.admin_username}`,
      isAr ? "تم نسخ بيانات الدخول" : "Sign-in details copied",
    );
  };

  const shareWhatsApp = (demo: DemoLink) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(instantMessage(demo))}`, "_blank", "noopener");
  };

  const createDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post<DemoLink>("/platform/demos", {
        code: createForm.code.trim().toLowerCase(),
        name: createForm.name,
        name_ar: createForm.name_ar || null,
        valid_days: parseInt(createForm.valid_days, 10) || 14,
        plan_id: createForm.plan_id || null,
        admin_username: createForm.admin_username.trim().toLowerCase(),
        admin_password: createForm.admin_password || null,
        admin_name: createForm.admin_name,
      });
      setOpen(false);
      setCreateForm(emptyCreate);
      setCopied(false);
      setCreated(data);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (demo: DemoLink) => {
    setEditId(demo.tenant_id);
    setEditForm({ valid_to: demo.valid_to?.slice(0, 10) || "", admin_password: "" });
    setEditOpen(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (editForm.valid_to) payload.valid_to = new Date(`${editForm.valid_to}T23:59:59Z`).toISOString();
      if (editForm.admin_password) payload.admin_password = editForm.admin_password;
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

  const patchDemo = async (demo: DemoLink, payload: Record<string, unknown>, done: string) => {
    try {
      await api.patch(`/platform/demos/${demo.tenant_id}`, payload);
      toast.success(done);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const stateBadge = (state: DemoState) => {
    const map = {
      active: { label: isAr ? "نشط" : "Active", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
      paused: { label: isAr ? "متوقف" : "Paused", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
      expired: { label: isAr ? "منتهي" : "Expired", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
    }[state];
    return <Badge className={`border-0 ${map.cls}`}>{map.label}</Badge>;
  };

  const columns: ColumnDef<DemoLink>[] = [
    {
      accessorKey: "name",
      header: isAr ? "العرض" : "Demo",
      cell: ({ row }) => (
        <div className="min-w-[10rem]">
          <div className="font-medium">{isAr && row.original.name_ar ? row.original.name_ar : row.original.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.original.code}</div>
        </div>
      ),
    },
    {
      id: "state",
      header: isAr ? "الحالة" : "Status",
      cell: ({ row }) => stateBadge(demoState(row.original)),
    },
    {
      id: "validity",
      header: isAr ? "الصلاحية" : "Valid until",
      cell: ({ row }) => {
        const state = demoState(row.original);
        const days = row.original.days_remaining ?? 0;
        return (
          <div className="whitespace-nowrap text-sm">
            <div>{fmtDate(row.original.valid_to, locale)}</div>
            {state === "active" && (
              <div className={`text-xs ${days <= 3 ? "text-destructive" : "text-muted-foreground"}`}>
                {isAr ? `متبقي ${days} يوم` : `${days} day${days === 1 ? "" : "s"} left`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "plan",
      header: isAr ? "الباقة" : "Plan",
      cell: ({ row }) => <span className="text-sm whitespace-nowrap">{row.original.plan_name || "—"}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{isAr ? "إجراءات" : "Actions"}</span>,
      cell: ({ row }) => {
        const demo = row.original;
        const state = demoState(demo);
        return (
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" onClick={() => copyInstantLink(demo)} disabled={state !== "active"}>
              <Zap className="h-3.5 w-3.5" />
              {isAr ? "نسخ الرابط" : "Copy link"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => shareWhatsApp(demo)}
              disabled={state !== "active"}
              aria-label="WhatsApp"
              title="WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" variant="ghost" aria-label={isAr ? "المزيد" : "More"} />}>
                ⋯
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => patchDemo(demo, { valid_days: 7 }, isAr ? "تم التمديد 7 أيام" : "Extended by 7 days")}>
                  <CalendarClock className="h-4 w-4" /> {isAr ? "تمديد 7 أيام من اليوم" : "Extend 7 days from today"}
                </DropdownMenuItem>
                {state === "paused" ? (
                  <DropdownMenuItem onClick={() => patchDemo(demo, { status: "trial" }, isAr ? "تم تفعيل العرض" : "Demo resumed")}>
                    <Play className="h-4 w-4" /> {isAr ? "استئناف العرض" : "Resume demo"}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => patchDemo(demo, { status: "suspended" }, isAr ? "تم إيقاف العرض" : "Demo paused")}>
                    <Pause className="h-4 w-4" /> {isAr ? "إيقاف العرض" : "Pause demo"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => copyLoginDetails(demo)}>
                  <KeyRound className="h-4 w-4" /> {isAr ? "نسخ بيانات الدخول" : "Copy sign-in details"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEdit(demo)}>
                  <Pencil className="h-4 w-4" /> {isAr ? "تعديل" : "Edit"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const activeCount = demos.filter((d) => demoState(d) === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Link2 className="h-8 w-8 text-primary" />
            {isAr ? "روابط العرض التجريبي" : "Demo Links"}
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {isAr
              ? "أرسل للعميل رابطاً يفتح النظام مباشرة بدون كلمة مرور، ويتوقف تلقائياً عند انتهاء المدة."
              : "Send prospects a link that opens the system instantly — no password — and stops working when it expires."}
          </p>
          {!loading && demos.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {isAr ? `${activeCount} نشط من ${demos.length}` : `${activeCount} active of ${demos.length}`}
            </p>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="shadow-md" />}>
            <Plus className="h-4 w-4" />
            {isAr ? "عرض تجريبي جديد" : "New demo link"}
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir={isAr ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle>{isAr ? "إنشاء رابط عرض تجريبي" : "Create demo link"}</DialogTitle>
              <DialogDescription>
                {isAr ? "يُنشأ مختبر تجريبي مستقل ببياناته الخاصة." : "Creates a separate trial laboratory with its own data."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createDemo} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="demo-name">{isAr ? "اسم العميل / المعمل" : "Prospect / lab name"} *</Label>
                  <Input
                    id="demo-name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder={isAr ? "معمل النور" : "Al Nour Lab"}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-code">{isAr ? "كود المختبر" : "Lab code"} *</Label>
                  <Input
                    id="demo-code"
                    dir="ltr"
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.replace(/\s+/g, "-") })}
                    placeholder="demo-alnour"
                    pattern="[A-Za-z0-9_\-]{2,50}"
                    title={isAr ? "حروف إنجليزية وأرقام و - فقط" : "Letters, numbers and - only"}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-name-ar">{isAr ? "الاسم بالعربي (اختياري)" : "Arabic name (optional)"}</Label>
                <Input id="demo-name-ar" value={createForm.name_ar} onChange={(e) => setCreateForm({ ...createForm, name_ar: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{isAr ? "مدة الصلاحية" : "Valid for"} *</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {DURATION_PRESETS.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={createForm.valid_days === String(d) ? "default" : "outline"}
                      onClick={() => setCreateForm({ ...createForm, valid_days: String(d) })}
                    >
                      {isAr ? `${d} يوم` : `${d} days`}
                    </Button>
                  ))}
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    className="w-24"
                    aria-label={isAr ? "عدد الأيام" : "Days"}
                    value={createForm.valid_days}
                    onChange={(e) => setCreateForm({ ...createForm, valid_days: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{isAr ? "باقة العرض" : "Demo plan"}</Label>
                <Select
                  value={createForm.plan_id || undefined}
                  onValueChange={(v) => setCreateForm({ ...createForm, plan_id: v || "" })}
                  items={plans.map((p) => ({ value: p.id, label: planSelectLabel(p, locale) }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={isAr ? "افتراضي: Professional Monthly" : "Default: Professional Monthly"} />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.filter((p) => p.tier === "professional" || p.tier === "enterprise").map((p) => (
                      <SelectItem key={p.id} value={p.id} title={planSelectDescription(p, locale)}>
                        {planSelectLabel(p, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <details className="rounded-lg border p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  {isAr ? "الدخول بكلمة مرور (اختياري)" : "Password sign-in (optional)"}
                </summary>
                <p className="mt-2 text-muted-foreground">
                  {isAr
                    ? "الرابط المباشر يكفي. أضف كلمة مرور فقط لو العميل سيدخل من صفحة تسجيل الدخول."
                    : "The instant link is enough. Add a password only if the prospect should also sign in from the login page."}
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="demo-user">{isAr ? "اسم المستخدم" : "Username"}</Label>
                    <Input id="demo-user" dir="ltr" value={createForm.admin_username} onChange={(e) => setCreateForm({ ...createForm, admin_username: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="demo-pass">{isAr ? "كلمة المرور" : "Password"}</Label>
                    <Input
                      id="demo-pass"
                      type="password"
                      autoComplete="new-password"
                      value={createForm.admin_password}
                      onChange={(e) => setCreateForm({ ...createForm, admin_password: e.target.value })}
                      minLength={8}
                      placeholder={isAr ? "بدون كلمة مرور" : "No password"}
                    />
                  </div>
                </div>
              </details>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (isAr ? "جارٍ الإنشاء…" : "Creating…") : (isAr ? "إنشاء الرابط" : "Create demo link")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Shown right after creation: the link is the whole point, so put it front and center. */}
      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-lg" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isAr ? "الرابط جاهز للإرسال" : "Your demo link is ready"}</DialogTitle>
            <DialogDescription>
              {created &&
                (isAr
                  ? `يفتح النظام مباشرة بدون كلمة مرور حتى ${fmtDate(created.valid_to, locale)}.`
                  : `Opens the system without a password until ${fmtDate(created.valid_to, locale)}.`)}
            </DialogDescription>
          </DialogHeader>
          {created?.access_path && (
            <div className="space-y-3">
              <div dir="ltr" className="break-all rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                {absoluteUrl(created.access_path)}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  onClick={() => {
                    copyInstantLink(created);
                    setCopied(true);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? (isAr ? "تم النسخ" : "Copied") : (isAr ? "نسخ الرابط" : "Copy link")}
                </Button>
                <Button variant="outline" onClick={() => shareWhatsApp(created)}>
                  <MessageCircle className="h-4 w-4" /> {isAr ? "إرسال واتساب" : "Send on WhatsApp"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditId(null); }}>
        <DialogContent dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isAr ? "تعديل العرض" : "Edit demo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-valid">{isAr ? "صالح حتى" : "Valid until"}</Label>
              <Input id="edit-valid" type="date" value={editForm.valid_to} onChange={(e) => setEditForm({ ...editForm, valid_to: e.target.value })} required />
              <p className="text-xs text-muted-foreground">
                {isAr ? "تغيير التاريخ يُنشئ رابطاً جديداً بالصلاحية الجديدة." : "Changing the date issues a new link with the new validity."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pass">{isAr ? "كلمة مرور جديدة (اختياري)" : "New password (optional)"}</Label>
              <Input id="edit-pass" type="password" autoComplete="new-password" value={editForm.admin_password} onChange={(e) => setEditForm({ ...editForm, admin_password: e.target.value })} minLength={8} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>{isAr ? "حفظ" : "Save"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : demos.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center">
          <Link2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">{isAr ? "لا توجد عروض تجريبية بعد" : "No demo links yet"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAr ? "أنشئ أول رابط وأرسله للعميل في ثوانٍ." : "Create your first link and send it to a prospect in seconds."}
          </p>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {isAr ? "عرض تجريبي جديد" : "New demo link"}
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} data={demos} searchPlaceholder={isAr ? "بحث..." : "Search..."} />
      )}
    </div>
  );
}
