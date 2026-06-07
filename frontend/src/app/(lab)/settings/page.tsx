"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";

export default function SettingsPage() {
  const locale = useAuthStore((s) => s.locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(locale, "settings")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar" ? "إعدادات المختبر والعلامة التجارية" : "Laboratory and white-label branding settings"}
        </p>
      </div>

      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">{locale === "ar" ? "العلامة التجارية" : "Branding"}</TabsTrigger>
          <TabsTrigger value="general">{locale === "ar" ? "عام" : "General"}</TabsTrigger>
          <TabsTrigger value="notifications">{locale === "ar" ? "الإشعارات" : "Notifications"}</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>{locale === "ar" ? "العلامة التجارية" : "White Label Branding"}</CardTitle>
              <CardDescription>
                {locale === "ar" ? "تخصيص الشعار والألوان واسم الشركة" : "Customize logo, colors, and company name"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "اسم الشركة (إنجليزي)" : "Company Name (EN)"}</Label>
                  <Input defaultValue="Demo Medical Laboratory" />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "اسم الشركة (عربي)" : "Company Name (AR)"}</Label>
                  <Input defaultValue="مختبر العرض الطبي" />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "اللون الأساسي" : "Primary Color"}</Label>
                  <Input type="color" defaultValue="#0F766E" className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "النطاق المخصص" : "Custom Domain"}</Label>
                  <Input placeholder="lab.example.com" />
                </div>
              </div>
              <Button>{t(locale, "save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{locale === "ar" ? "الإعدادات العامة" : "General Settings"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{locale === "ar" ? "اللغة الافتراضية: العربية" : "Default Language: Arabic"}</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label>{locale === "ar" ? "المنطقة الزمنية: Africa/Cairo" : "Timezone: Africa/Cairo"}</Label>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{locale === "ar" ? "تذكيرات الاشتراك" : "Subscription Reminders"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{locale === "ar" ? "تذكير التجديد (14 يوم)" : "Renewal Reminder (14 days)"}</Label>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
