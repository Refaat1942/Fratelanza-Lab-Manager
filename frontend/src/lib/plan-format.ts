import type { Locale } from "@/lib/i18n";

export interface PlanLike {
  name: string;
  name_ar?: string;
  tier: string;
  billing_cycle: string;
  price_egp: number;
  max_users: number;
  max_branches: number;
  features?: { modules?: string[] };
}

const TIER_SUMMARY: Record<string, { en: string; ar: string }> = {
  starter: {
    en: "Patients, tests, results, billing — small lab",
    ar: "مرضى، تحاليل، نتائج، فواتير — مختبر صغير",
  },
  professional: {
    en: "Starter + doctors, inventory, expenses, reports, users, branches",
    ar: "الأساسية + أطباء، مخزون، مصروفات، تقارير، مستخدمين، فروع",
  },
  enterprise: {
    en: "All modules — multi-branch labs",
    ar: "كل الوحدات — مختبرات متعددة الفروع",
  },
};

export function planDisplayName(plan: PlanLike, locale: Locale) {
  return locale === "ar" && plan.name_ar ? plan.name_ar : plan.name;
}

export function planTierSummary(tier: string, locale: Locale) {
  const key = tier.toLowerCase();
  const item = TIER_SUMMARY[key];
  if (!item) return tier;
  return locale === "ar" ? item.ar : item.en;
}

export function planSelectLabel(plan: PlanLike, locale: Locale) {
  const cycle = plan.billing_cycle === "yearly"
    ? (locale === "ar" ? "سنوي" : "year")
    : (locale === "ar" ? "شهر" : "mo");
  const tier = plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1);
  return `${planDisplayName(plan, locale)} · ${tier} · ${plan.max_users} ${locale === "ar" ? "مستخدم" : "users"} · ${plan.max_branches} ${locale === "ar" ? "فرع" : "branches"} · EGP ${plan.price_egp.toLocaleString()}/${cycle}`;
}

export function planSelectDescription(plan: PlanLike, locale: Locale) {
  return planTierSummary(plan.tier, locale);
}
