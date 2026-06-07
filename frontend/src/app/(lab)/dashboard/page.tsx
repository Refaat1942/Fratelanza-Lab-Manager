"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FlaskConical, Receipt, TrendingUp, AlertTriangle, Package } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";

const stats = [
  { title: "Patients Today", titleAr: "مرضى اليوم", value: "24", icon: Users, change: "+12%", color: "text-teal-600", bg: "bg-teal-500/10" },
  { title: "Tests Pending", titleAr: "تحاليل معلقة", value: "18", icon: FlaskConical, change: "5 pending", color: "text-cyan-600", bg: "bg-cyan-500/10" },
  { title: "Revenue Today", titleAr: "إيرادات اليوم", value: "EGP 4,850", icon: Receipt, change: "+8%", color: "text-emerald-600", bg: "bg-emerald-500/10" },
  { title: "Monthly Growth", titleAr: "نمو شهري", value: "15.3%", icon: TrendingUp, change: "+2.1%", color: "text-amber-600", bg: "bg-amber-500/10" },
];

export default function DashboardPage() {
  const locale = useAuthStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">
          {t(locale, "dashboard")}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {locale === "ar" ? `مرحباً ${user?.full_name_ar || user?.full_name}` : `Welcome back, ${user?.full_name}`}
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="gradient-card stat-glow border-0 transition hover:scale-[1.02] hover:shadow-lg">
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
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4 text-primary" />
              {locale === "ar" ? "آخر النشاطات" : "Recent Activity"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {[
                ["New patient registered — P000024", "2 min ago"],
                ["CBC result verified", "15 min ago"],
                ["Invoice #INV-1042 paid — EGP 350", "1 hour ago"],
              ].map(([text, time]) => (
                <li key={text} className="flex justify-between border-b border-border/50 pb-2 last:border-0">
                  <span>{text}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">{time}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {locale === "ar" ? "تنبيهات المخزون" : "Inventory Alerts"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 text-amber-600">
                <Package className="h-4 w-4" />
                EDTA Tube — Low stock (8 remaining)
              </li>
              <li className="flex items-center gap-2 text-red-600">
                <Package className="h-4 w-4" />
                Glucose Reagent — Expiring in 5 days
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
