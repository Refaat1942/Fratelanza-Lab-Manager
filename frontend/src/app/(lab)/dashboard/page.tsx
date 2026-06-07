"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FlaskConical, Stethoscope, Package, TrendingUp } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { AnimatedStagger, AnimatedItem } from "@/components/layout/animated-page";
import { AppBrand } from "@/components/layout/app-brand";

interface Stats {
  patients: number;
  doctors: number;
  tests: number;
  inventory_items: number;
}

const cardStyles = [
  "from-emerald-500/15 to-emerald-500/5 border-emerald-200/60 text-emerald-700",
  "from-blue-500/15 to-blue-500/5 border-blue-200/60 text-blue-700",
  "from-violet-500/15 to-violet-500/5 border-violet-200/60 text-violet-700",
  "from-cyan-500/15 to-cyan-500/5 border-cyan-200/60 text-cyan-700",
];

export default function DashboardPage() {
  const locale = useAuthStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get("/dashboard/stats").then((res) => setStats(res.data)).catch(() => {});
  }, []);

  const cards = [
    { title: "Patients", titleAr: "المرضى", value: stats?.patients ?? "—", icon: Users },
    { title: "Doctors", titleAr: "الأطباء", value: stats?.doctors ?? "—", icon: Stethoscope },
    { title: "Tests", titleAr: "التحاليل", value: stats?.tests ?? "—", icon: FlaskConical },
    { title: "Inventory", titleAr: "المخزون", value: stats?.inventory_items ?? "—", icon: Package },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t(locale, "dashboard")}
        description={
          locale === "ar"
            ? `مرحباً ${user?.full_name_ar || user?.full_name} — نظرة عامة على المختبر`
            : `Welcome back, ${user?.full_name} — laboratory overview`
        }
      />

      <Card className="overflow-hidden border-0 p-0 shadow-card-md">
        <div className="gradient-brand-soft flex flex-col items-center justify-between gap-4 p-6 sm:flex-row sm:p-8">
          <AppBrand showName size="md" href={null} className="pointer-events-none" />
          <p className="max-w-md text-center text-sm text-muted-foreground sm:text-end">
            {locale === "ar"
              ? "لوحة تحكم حديثة بألوان متدرجة — أخضر وأزرق وبنفسجي"
              : "Modern gradient dashboard — green, blue & violet"}
          </p>
        </div>
      </Card>

      <AnimatedStagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((stat, i) => (
          <AnimatedItem key={stat.title}>
            <Card className={`border bg-gradient-to-br shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-lg ${cardStyles[i]}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium opacity-80">
                  {locale === "ar" ? stat.titleAr : stat.title}
                </CardTitle>
                <div className="rounded-xl bg-white/70 p-2.5 shadow-sm">
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
              </CardContent>
            </Card>
          </AnimatedItem>
        ))}
      </AnimatedStagger>

      <AnimatedItem>
        <Card className="border-gradient shadow-card-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl gradient-brand p-2.5 text-white shadow-glow">
                <TrendingUp className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">
                {locale === "ar" ? "ملخص سريع" : "Quick Overview"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            {locale === "ar"
              ? "استخدم القائمة الجانبية للوصول إلى المرضى والتحاليل والفواتير والمخزون. الشعار يظهر في الأعلى والقائمة الجانبية."
              : "Use the sidebar for patients, tests, billing, and inventory. Your logo appears in the header and sidebar."}
          </CardContent>
        </Card>
      </AnimatedItem>
    </div>
  );
}
