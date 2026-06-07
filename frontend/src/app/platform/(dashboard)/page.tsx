"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CreditCard, AlertTriangle, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";

interface Dashboard {
  total_tenants: number;
  active_subscriptions: number;
  monthly_recurring_revenue: number;
  yearly_recurring_revenue: number;
  expiring_soon: number;
  suspended_tenants: number;
}

export default function PlatformDashboardPage() {
  const locale = useAuthStore((s) => s.locale);
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    api.get("/platform/dashboard").then((res) => setData(res.data)).catch(() => {});
  }, []);

  const stats = data
    ? [
        { title: "Total Laboratories", titleAr: "إجمالي المختبرات", value: data.total_tenants, icon: Building2 },
        { title: "Active Subscriptions", titleAr: "اشتراكات نشطة", value: data.active_subscriptions, icon: CreditCard },
        { title: "MRR (EGP)", titleAr: "الإيراد الشهري", value: data.monthly_recurring_revenue.toLocaleString(), icon: TrendingUp },
        { title: "Expiring Soon", titleAr: "تنتهي قريباً", value: data.expiring_soon, icon: AlertTriangle },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(locale, "revenue")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar" ? "لوحة تحكم مالك المنصة" : "SaaS owner revenue and usage dashboard"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {locale === "ar" ? stat.titleAr : stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
