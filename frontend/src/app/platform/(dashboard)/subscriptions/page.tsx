"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Ban, CheckCircle2, CircleDollarSign, Clock, Play, RefreshCw, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { planDisplayName, type PlanLike } from "@/lib/plan-format";

type AccessState = "active" | "grace" | "expired" | "suspended" | "trial";

interface Subscription {
  subscription_id: string;
  tenant_id: string;
  tenant_code: string;
  tenant_name: string;
  plan_name: string;
  plan_tier: string;
  billing_cycle?: string;
  status: string;
  tenant_status: string;
  expires_at: string;
  grace_ends_at?: string;
  auto_renew: boolean;
  amount_paid: number;
  price_egp: number;
  access_state: AccessState;
  days_remaining?: number;
}

interface Plan extends PlanLike {
  id: string;
  is_active?: boolean;
}

type Filter = "all" | "active" | "expiring" | "grace" | "blocked";

const EXPIRING_DAYS = 14;
const DAY_MS = 86_400_000;

export default function SubscriptionsPage() {
  const { locale } = useLocale("platform");
  const isAr = locale === "ar";
  const [items, setItems] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [selling, setSelling] = useState<Subscription | null>(null);
  const [sale, setSale] = useState({ plan_id: "", periods: "1", amount: "" });
  const [saving, setSaving] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState<Subscription | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get("/platform/subscriptions"), api.get("/platform/plans")])
      .then(([sRes, pRes]) => {
        setItems(sRes.data);
        setPlans(pRes.data);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const money = (n: number) => `${n.toLocaleString(isAr ? "ar-EG" : "en-US")} ${isAr ? "ج.م" : "EGP"}`;
  const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString(isAr ? "ar-EG" : "en-GB");
  const cycleLabel = (cycle?: string) =>
    cycle === "yearly" ? (isAr ? "سنوي" : "Yearly") : (isAr ? "شهري" : "Monthly");

  const isExpiring = (s: Subscription) =>
    s.access_state === "active" && (s.days_remaining ?? 0) <= EXPIRING_DAYS;

  // Demos live on their own page; this page is for paying customers.
  const paid = useMemo(() => items.filter((s) => s.tenant_status !== "trial"), [items]);

  const stats = useMemo(() => ({
    active: paid.filter((s) => s.access_state === "active").length,
    expiring: paid.filter(isExpiring).length,
    grace: paid.filter((s) => s.access_state === "grace").length,
    blocked: paid.filter((s) => s.access_state === "expired" || s.access_state === "suspended").length,
    collected: paid.reduce((sum, s) => sum + (s.amount_paid || 0), 0),
  }), [paid]);

  const visible = useMemo(() => {
    switch (filter) {
      case "active": return paid.filter((s) => s.access_state === "active");
      case "expiring": return paid.filter(isExpiring);
      case "grace": return paid.filter((s) => s.access_state === "grace");
      case "blocked": return paid.filter((s) => s.access_state === "expired" || s.access_state === "suspended");
      default: return paid;
    }
  }, [paid, filter]);

  const planById = (id: string) => plans.find((p) => p.id === id);
  const selectedPlan = planById(sale.plan_id);
  const periods = Math.max(1, parseInt(sale.periods, 10) || 1);
  const periodDays = selectedPlan?.billing_cycle === "yearly" ? 365 : 30;
  const suggestedAmount = selectedPlan ? selectedPlan.price_egp * periods : 0;

  const newExpiry = useMemo(() => {
    if (!selling || !selectedPlan) return null;
    const current = new Date(selling.expires_at).getTime();
    const base = Math.max(current, Date.now());
    return new Date(base + periodDays * periods * DAY_MS);
  }, [selling, selectedPlan, periodDays, periods]);

  const openSale = (s: Subscription) => {
    const currentPlan = plans.find((p) => p.name === s.plan_name);
    setSale({ plan_id: currentPlan?.id || plans[0]?.id || "", periods: "1", amount: "" });
    setSelling(s);
  };

  const submitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selling || !selectedPlan) return;
    setSaving(true);
    try {
      await api.post(`/platform/tenants/${selling.tenant_id}/renew`, {
        plan_id: selectedPlan.id,
        days: periodDays * periods,
        amount_paid: sale.amount === "" ? suggestedAmount : Number(sale.amount),
      });
      toast.success(isAr ? `تم تفعيل اشتراك ${selling.tenant_name}` : `${selling.tenant_name} subscription activated`);
      setSelling(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const setAccess = async (s: Subscription, action: "suspend" | "activate") => {
    try {
      await api.post(`/platform/tenants/${s.tenant_id}/${action}`);
      toast.success(
        action === "suspend"
          ? (isAr ? `تم إيقاف ${s.tenant_name}` : `${s.tenant_name} suspended`)
          : (isAr ? `تم تشغيل ${s.tenant_name}` : `${s.tenant_name} activated`)
      );
      setConfirmSuspend(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const accessBadge = (s: Subscription) => {
    const map: Record<AccessState, { label: string; cls: string }> = {
      active: { label: isAr ? "يعمل" : "Active", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
      trial: { label: isAr ? "تجريبي" : "Trial", cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
      grace: { label: isAr ? "فترة سماح" : "Grace period", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
      expired: { label: isAr ? "منتهي — مفصول" : "Expired — cut off", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
      suspended: { label: isAr ? "موقوف" : "Suspended", cls: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
    };
    const m = map[s.access_state] ?? map.active;
    return <Badge className={`border-0 whitespace-nowrap ${m.cls}`}>{m.label}</Badge>;
  };

  const columns: ColumnDef<Subscription>[] = [
    {
      accessorKey: "tenant_name",
      header: isAr ? "المختبر" : "Laboratory",
      cell: ({ row }) => (
        <div className="min-w-[10rem]">
          <div className="font-medium">{row.original.tenant_name}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.original.tenant_code}</div>
        </div>
      ),
    },
    {
      accessorKey: "plan_name",
      header: isAr ? "الباقة" : "Plan",
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <div className="text-sm">{row.original.plan_name}</div>
          <div className="text-xs text-muted-foreground">
            {cycleLabel(row.original.billing_cycle)} · {money(row.original.price_egp)}
          </div>
        </div>
      ),
    },
    {
      id: "access",
      header: isAr ? "الحالة" : "Access",
      cell: ({ row }) => accessBadge(row.original),
    },
    {
      accessorKey: "expires_at",
      header: isAr ? "ينتهي في" : "Expires",
      cell: ({ row }) => {
        const s = row.original;
        const days = s.days_remaining ?? 0;
        let hint = "";
        if (s.access_state === "active") hint = isAr ? `متبقي ${days} يوم` : `${days} days left`;
        if (s.access_state === "grace") hint = isAr ? `يُفصل خلال ${days} يوم` : `Cut off in ${days} days`;
        return (
          <div className="whitespace-nowrap text-sm">
            <div>{fmtDate(s.expires_at)}</div>
            {hint && (
              <div className={`text-xs ${s.access_state === "grace" || days <= 3 ? "text-destructive" : "text-muted-foreground"}`}>
                {hint}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "amount_paid",
      header: isAr ? "المدفوع" : "Paid",
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{money(row.original.amount_paid)}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t(locale, "actions")}</span>,
      cell: ({ row }) => {
        const s = row.original;
        const blocked = s.access_state === "suspended";
        return (
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" onClick={() => openSale(s)}>
              <RefreshCw className="h-3.5 w-3.5" />
              {isAr ? "تجديد / بيع" : "Renew / sell"}
            </Button>
            {blocked ? (
              <Button size="sm" variant="outline" onClick={() => setAccess(s, "activate")}>
                <Play className="h-3.5 w-3.5" /> {isAr ? "تشغيل" : "Activate"}
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmSuspend(s)}>
                <Ban className="h-3.5 w-3.5" /> {isAr ? "فصل" : "Suspend"}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const statCards: { key: Filter; label: string; value: string | number; icon: typeof CheckCircle2; tone: string }[] = [
    { key: "active", label: isAr ? "اشتراكات تعمل" : "Active", value: stats.active, icon: CheckCircle2, tone: "text-emerald-600" },
    { key: "expiring", label: isAr ? `تنتهي خلال ${EXPIRING_DAYS} يوم` : `Expiring in ${EXPIRING_DAYS} days`, value: stats.expiring, icon: Clock, tone: "text-amber-600" },
    { key: "grace", label: isAr ? "في فترة السماح" : "In grace period", value: stats.grace, icon: AlertTriangle, tone: "text-orange-600" },
    { key: "blocked", label: isAr ? "مفصولة / موقوفة" : "Cut off / suspended", value: stats.blocked, icon: Ban, tone: "text-rose-600" },
  ];

  const monthlyPlans = plans.filter((p) => p.billing_cycle !== "yearly");
  const yearlyPlans = plans.filter((p) => p.billing_cycle === "yearly");
  const planOption = (p: Plan) => `${planDisplayName(p, locale)} — ${money(p.price_egp)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "subscriptions")}</h1>
          <p className="mt-1 text-muted-foreground">
            {isAr
              ? "بيع وتجديد الاشتراكات الشهرية والسنوية، وفصل أو تشغيل أي عميل. المعمل يُفصل تلقائياً بعد انتهاء فترة السماح."
              : "Sell and renew monthly or yearly plans, and suspend or activate any customer. Labs are cut off automatically after the grace period."}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm">
          <CircleDollarSign className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">{isAr ? "إجمالي المحصّل" : "Total collected"}</span>
          <span className="font-semibold tabular-nums">{money(stats.collected)}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(filter === c.key ? "all" : c.key)}
            aria-pressed={filter === c.key}
            className="text-start"
          >
            <Card className={`transition-shadow hover:shadow-md ${filter === c.key ? "ring-2 ring-primary" : ""}`}>
              <CardContent className="flex items-center gap-3 p-4">
                <c.icon className={`h-8 w-8 shrink-0 ${c.tone}`} />
                <div>
                  <div className="text-2xl font-bold tabular-nums">{c.value}</div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {filter !== "all" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{isAr ? "تصفية:" : "Filtered:"}</span>
          <Badge variant="secondary">{statCards.find((c) => c.key === filter)?.label}</Badge>
          <Button size="sm" variant="ghost" onClick={() => setFilter("all")}>{isAr ? "عرض الكل" : "Show all"}</Button>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable columns={columns} data={visible} searchPlaceholder={t(locale, "search")} />
      )}

      {/* Sell / renew */}
      <Dialog open={!!selling} onOpenChange={(o) => !o && setSelling(null)}>
        <DialogContent className="sm:max-w-md" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              {isAr ? "بيع / تجديد اشتراك" : "Sell / renew subscription"}
            </DialogTitle>
            <DialogDescription>{selling?.tenant_name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitSale} className="space-y-4">
            <div className="space-y-2">
              <Label>{isAr ? "الباقة" : "Plan"}</Label>
              <Select value={sale.plan_id || undefined} onValueChange={(v) => v && setSale({ ...sale, plan_id: v, amount: "" })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={isAr ? "اختر الباقة" : "Choose a plan"}>
                    {(value: string | null) => {
                      const p = value ? planById(value) : undefined;
                      return p ? `${planOption(p)} / ${cycleLabel(p.billing_cycle)}` : (isAr ? "اختر الباقة" : "Choose a plan");
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {monthlyPlans.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{isAr ? "شهري" : "Monthly"}</SelectLabel>
                      {monthlyPlans.map((p) => <SelectItem key={p.id} value={p.id}>{planOption(p)}</SelectItem>)}
                    </SelectGroup>
                  )}
                  {yearlyPlans.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{isAr ? "سنوي" : "Yearly"}</SelectLabel>
                      {yearlyPlans.map((p) => <SelectItem key={p.id} value={p.id}>{planOption(p)}</SelectItem>)}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sale-periods">
                  {selectedPlan?.billing_cycle === "yearly" ? (isAr ? "عدد السنوات" : "Years") : (isAr ? "عدد الشهور" : "Months")}
                </Label>
                <Input
                  id="sale-periods"
                  type="number"
                  min={1}
                  max={selectedPlan?.billing_cycle === "yearly" ? 5 : 24}
                  value={sale.periods}
                  onChange={(e) => setSale({ ...sale, periods: e.target.value, amount: "" })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-amount">{isAr ? "المبلغ المدفوع (ج.م)" : "Amount paid (EGP)"}</Label>
                <Input
                  id="sale-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={String(suggestedAmount)}
                  value={sale.amount}
                  onChange={(e) => setSale({ ...sale, amount: e.target.value })}
                />
              </div>
            </div>
            {newExpiry && selling && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{isAr ? "ينتهي حالياً" : "Currently expires"}</span>
                  <span>{fmtDate(selling.expires_at)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-2 font-medium">
                  <span>{isAr ? "الانتهاء الجديد" : "New expiry"}</span>
                  <span className="text-primary">{fmtDate(newExpiry)}</span>
                </div>
                {(selling.access_state === "expired" || selling.access_state === "suspended") && (
                  <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                    {isAr ? "سيعود المختبر للعمل فوراً بعد الحفظ." : "The lab regains access immediately after saving."}
                  </p>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={saving || !selectedPlan}>
              {saving
                ? (isAr ? "جارٍ الحفظ…" : "Saving…")
                : (isAr ? `تأكيد — ${money(sale.amount === "" ? suggestedAmount : Number(sale.amount))}` : `Confirm — ${money(sale.amount === "" ? suggestedAmount : Number(sale.amount))}`)}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Suspend confirmation — cutting off a lab stops its daily work, so ask first. */}
      <Dialog open={!!confirmSuspend} onOpenChange={(o) => !o && setConfirmSuspend(null)}>
        <DialogContent className="sm:max-w-md" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isAr ? "فصل المختبر؟" : "Suspend this laboratory?"}</DialogTitle>
            <DialogDescription>
              {isAr
                ? `سيتم تسجيل خروج كل مستخدمي ${confirmSuspend?.tenant_name ?? ""} ولن يستطيعوا الدخول حتى تعيد التشغيل. البيانات لا تُحذف.`
                : `All users of ${confirmSuspend?.tenant_name ?? ""} will be signed out and blocked until you activate it again. No data is deleted.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmSuspend(null)}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button variant="destructive" onClick={() => confirmSuspend && setAccess(confirmSuspend, "suspend")}>
              <Ban className="h-4 w-4" /> {isAr ? "فصل" : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
