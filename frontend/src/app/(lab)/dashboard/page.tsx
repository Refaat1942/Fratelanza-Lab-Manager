"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FlaskConical, Stethoscope, Package } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";

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
    { title: "Patients", titleAr: "المرضى", value: stats?.patients ?? "—", icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { title: "Doctors", titleAr: "الأطباء", value: stats?.doctors ?? "—", icon: Stethoscope, color: "text-primary", bg: "bg-primary/10" },
    { title: "Tests", titleAr: "التحاليل", value: stats?.tests ?? "—", icon: FlaskConical, color: "text-accent-foreground", bg: "bg-accent/20" },
    { title: "Inventory Items", titleAr: "أصناف المخزون", value: stats?.inventory_items ?? "—", icon: Package, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">{t(locale, "dashboard")}</h1>
        <p className="mt-1 text-muted-foreground">
          {locale === "ar" ? `مرحباً ${user?.full_name_ar || user?.full_name}` : `Welcome back, ${user?.full_name}`}
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="gradient-card stat-glow border-0 transition hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {locale === "ar" ? stat.titleAr : stat.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
