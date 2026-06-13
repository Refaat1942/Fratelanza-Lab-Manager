"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CreditCard, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import { api, getApiError } from "@/lib/api";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { toast } from "sonner";

interface Dashboard {
  total_tenants: number;
  active_subscriptions: number;
  monthly_recurring_revenue: number;
  yearly_recurring_revenue: number;
  expiring_soon: number;
  suspended_tenants: number;
}

const emptyDashboard: Dashboard = {
  total_tenants: 0,
  active_subscriptions: 0,
  monthly_recurring_revenue: 0,
  yearly_recurring_revenue: 0,
  expiring_soon: 0,
  suspended_tenants: 0,
};

export default function PlatformDashboardPage() {
  const { locale } = useLocale("platform");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<Dashboard>("/platform/dashboard")
      .then((res) => setData(res.data))
      .catch((err) => {
        const message = getApiError(err);
        setError(message);
        setData(emptyDashboard);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      title: "Total Laboratories",
      titleAr: "إجمالي المختبرات",
      value: data?.total_tenants ?? 0,
      icon: Building2,
    },
    {
      title: "Active Subscriptions",
      titleAr: "اشتراكات نشطة",
      value: data?.active_subscriptions ?? 0,
      icon: CreditCard,
    },
    {
      title: "MRR (EGP)",
      titleAr: "الإيراد الشهري",
      value: (data?.monthly_recurring_revenue ?? 0).toLocaleString(),
      icon: TrendingUp,
    },
    {
      title: "Expiring Soon",
      titleAr: "تنتهي قريباً",
      value: data?.expiring_soon ?? 0,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(locale, "revenue")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar" ? "لوحة تحكم مالك المنصة" : "SaaS owner revenue and usage dashboard"}
        </p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          {locale === "ar" ? "جاري التحميل..." : "Loading dashboard..."}
        </div>
      ) : (
        <>
          {error && (
            <p className="text-sm text-destructive">
              {locale === "ar"
                ? `تعذر تحميل بعض البيانات: ${error}`
                : `Could not refresh dashboard: ${error}`}
            </p>
          )}

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

          {data && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {locale === "ar" ? "إجراءات سريعة" : "Quick Actions"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <a href="/platform/tenants" className="text-sm text-primary hover:underline">
                    {locale === "ar" ? "إدارة المختبرات" : "Manage Laboratories"}
                  </a>
                  <span className="text-muted-foreground">·</span>
                  <a href="/platform/subscriptions" className="text-sm text-primary hover:underline">
                    {locale === "ar" ? "تجديد الاشتراكات" : "Renew Subscriptions"}
                  </a>
                  <span className="text-muted-foreground">·</span>
                  <a href="/platform/plans" className="text-sm text-primary hover:underline">
                    {locale === "ar" ? "تعديل الباقات" : "Edit Plans"}
                  </a>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {locale === "ar" ? "تنبيهات" : "Alerts"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  {data.expiring_soon > 0 && (
                    <p className="text-amber-600">
                      {data.expiring_soon}{" "}
                      {locale === "ar"
                        ? "اشتراك ينتهي خلال 14 يوم"
                        : "subscriptions expiring in 14 days"}
                    </p>
                  )}
                  {data.suspended_tenants > 0 && (
                    <p className="text-red-600">
                      {data.suspended_tenants}{" "}
                      {locale === "ar" ? "مختبر معلق" : "suspended laboratories"}
                    </p>
                  )}
                  {data.yearly_recurring_revenue > 0 && (
                    <p className="text-muted-foreground">
                      {locale === "ar" ? "الإيراد السنوي:" : "Yearly revenue:"}{" "}
                      EGP {data.yearly_recurring_revenue.toLocaleString()}
                    </p>
                  )}
                  {data.expiring_soon === 0 && data.suspended_tenants === 0 && (
                    <p className="text-muted-foreground">
                      {locale === "ar" ? "لا توجد تنبيهات" : "No alerts"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
