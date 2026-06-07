"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FlaskConical, Stethoscope, Package, TrendingUp } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";

interface Stats {
  patients: number;
  doctors: number;
  tests: number;
  inventory_items: number;
}

export default function DashboardPage() {
  const locale = useAuthStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get("/dashboard/stats").then((res) => setStats(res.data)).catch(() => {});
  }, []);

  const cards = [
    { title: "Patients", titleAr: "المرضى", value: stats?.patients ?? "—", icon: Users, tint: "bg-teal-50 text-primary" },
    { title: "Doctors", titleAr: "الأطباء", value: stats?.doctors ?? "—", icon: Stethoscope, tint: "bg-emerald-50 text-emerald-700" },
    { title: "Tests", titleAr: "التحاليل", value: stats?.tests ?? "—", icon: FlaskConical, tint: "bg-cyan-50 text-cyan-700" },
    { title: "Inventory", titleAr: "المخزون", value: stats?.inventory_items ?? "—", icon: Package, tint: "bg-slate-50 text-slate-700" },
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="border-border/60 shadow-card hover:shadow-card-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {locale === "ar" ? stat.titleAr : stat.title}
                </CardTitle>
                <div className={`rounded-xl p-2.5 ${stat.tint}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="border-border/60 shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">
              {locale === "ar" ? "ملخص سريع" : "Quick Overview"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          {locale === "ar"
            ? "استخدم القائمة الجانبية للوصول إلى المرضى والتحاليل والفواتير والمخزون. جميع الوحدات متصلة بقاعدة بيانات المختبر."
            : "Use the sidebar to access patients, tests, billing, and inventory. All modules are connected to your laboratory database."}
        </CardContent>
      </Card>
    </div>
  );
}
