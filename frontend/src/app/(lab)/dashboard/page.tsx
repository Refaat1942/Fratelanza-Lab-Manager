"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FlaskConical, Receipt, TrendingUp } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";

const stats = [
  { title: "Patients Today", titleAr: "مرضى اليوم", value: "24", icon: Users, change: "+12%" },
  { title: "Tests Pending", titleAr: "تحاليل معلقة", value: "18", icon: FlaskConical, change: "-5%" },
  { title: "Revenue Today", titleAr: "إيرادات اليوم", value: "EGP 4,850", icon: Receipt, change: "+8%" },
  { title: "Monthly Growth", titleAr: "نمو شهري", value: "15.3%", icon: TrendingUp, change: "+2.1%" },
];

export default function DashboardPage() {
  const locale = useAuthStore((s) => s.locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(locale, "dashboard")}</h1>
        <p className="text-muted-foreground">{t(locale, "welcome")}</p>
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
              <p className="text-xs text-muted-foreground">{stat.change} from yesterday</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{locale === "ar" ? "آخر النشاطات" : "Recent Activity"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between border-b pb-2">
                <span>New patient registered - P000024</span>
                <span className="text-muted-foreground">2 min ago</span>
              </li>
              <li className="flex justify-between border-b pb-2">
                <span>CBC result verified</span>
                <span className="text-muted-foreground">15 min ago</span>
              </li>
              <li className="flex justify-between border-b pb-2">
                <span>Invoice #INV-1042 paid</span>
                <span className="text-muted-foreground">1 hour ago</span>
              </li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{locale === "ar" ? "تنبيهات المخزون" : "Inventory Alerts"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between text-amber-600">
                <span>EDTA Purple Top Tube - Low stock (8 remaining)</span>
              </li>
              <li className="flex justify-between text-red-600">
                <span>Glucose Reagent - Expiring in 5 days</span>
              </li>
              <li className="flex justify-between text-amber-600">
                <span>Nitrile Gloves - Below reorder level</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
