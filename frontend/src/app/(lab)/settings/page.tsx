"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import { useBrandingStore } from "@/stores/branding-store";
import { BrandingLogo } from "@/components/branding/branding-logo";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { displayName, type TenantBranding } from "@/lib/branding";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

export default function SettingsPage() {
  const locale = useAuthStore((s) => s.locale);
  const { setBranding: persistBranding } = useBrandingStore();
  const [form, setForm] = useState<TenantBranding>({
    company_name: "",
    company_name_ar: "",
    logo_url: "",
    primary_color: "#3B82F6",
    secondary_color: "#10B981",
    accent_color: "#8B5CF6",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get("/settings/branding")
      .then((res) => setForm(res.data))
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  const saveBranding = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/settings/branding", {
        company_name: form.company_name,
        company_name_ar: form.company_name_ar,
        logo_url: form.logo_url || null,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        accent_color: form.accent_color,
      });
      setForm(data);
      persistBranding(data);
      toast.success(locale === "ar" ? "تم حفظ العلامة التجارية" : "Branding saved");
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const { data } = await api.post("/settings/branding/logo", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      localStorage.setItem("logo_upload_version", String(Date.now()));
      setForm(data);
      persistBranding(data);
      toast.success(locale === "ar" ? "تم رفع الشعار" : "Logo uploaded");
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t(locale, "settings")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar"
            ? "إعدادات المختبر والعلامة التجارية — يظهر الشعار واسم المختبر في صفحة الدخول"
            : "Laboratory branding — logo and name appear on the login page"}
        </p>
      </div>

      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">{locale === "ar" ? "العلامة التجارية" : "Branding"}</TabsTrigger>
          <TabsTrigger value="general">{locale === "ar" ? "عام" : "General"}</TabsTrigger>
          <TabsTrigger value="notifications">{locale === "ar" ? "الإشعارات" : "Notifications"}</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{locale === "ar" ? "العلامة التجارية" : "White Label Branding"}</CardTitle>
                <CardDescription>
                  {locale === "ar"
                    ? "اسم المختبر والشعار يظهران على صفحة تسجيل الدخول"
                    : "Lab name and logo are shown on the login front page"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "اسم المختبر (إنجليزي)" : "Lab Name (EN)"} *</Label>
                    <Input
                      value={form.company_name}
                      onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "اسم المختبر (عربي)" : "Lab Name (AR)"}</Label>
                    <Input
                      value={form.company_name_ar || ""}
                      onChange={(e) => setForm({ ...form, company_name_ar: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{locale === "ar" ? "رابط الشعار (اختياري)" : "Logo URL (optional)"}</Label>
                  <Input
                    value={form.logo_url || ""}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>{locale === "ar" ? "رفع شعار" : "Upload Logo"}</Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogo(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {locale === "ar" ? "اختر صورة الشعار" : "Choose logo image"}
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG, SVG — max 5 MB</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "اللون الأساسي" : "Primary Color"}</Label>
                    <Input
                      type="color"
                      value={form.primary_color || "#1e3a5f"}
                      onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "اللون الثانوي" : "Secondary"}</Label>
                    <Input
                      type="color"
                      value={form.secondary_color || "#2d5a87"}
                      onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "لون التمييز" : "Accent"}</Label>
                    <Input
                      type="color"
                      value={form.accent_color || "#c9a227"}
                      onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                      className="h-10"
                    />
                  </div>
                </div>

                <Button onClick={saveBranding} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t(locale, "save")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {locale === "ar" ? "معاينة صفحة الدخول" : "Login Page Preview"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="rounded-xl p-6 text-center text-white"
                  style={{
                    background: `linear-gradient(145deg, ${form.primary_color || "#0F766E"} 0%, #134e4a 100%)`,
                  }}
                >
                  <div className="mx-auto mb-4 flex justify-center">
                    <BrandingLogo
                      logoUrl={form.logo_url}
                      alt={displayName(form, locale)}
                      size="lg"
                      className="bg-white/10 ring-white/30"
                      accentColor="#fff"
                    />
                  </div>
                  <p className="text-lg font-bold">{displayName(form, locale)}</p>
                  <p className="mt-2 text-xs text-white/70">
                    {locale === "ar" ? "تسجيل دخول المختبر" : "Laboratory Sign In"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{locale === "ar" ? "الإعدادات العامة" : "General Settings"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1 text-start">
                    <Label className="text-sm font-semibold">
                      {locale === "ar" ? "اللغة الافتراضية" : "Default Language"}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {locale === "ar" ? "استخدام العربية كشاشة رئيسية للنظام" : "Use Arabic as the main system language"}
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1 text-start">
                    <Label className="text-sm font-semibold">
                      {locale === "ar" ? "المنطقة الزمنية" : "Timezone"}
                    </Label>
                    <p className="text-xs text-muted-foreground">Africa/Cairo</p>
                  </div>
                  <Switch defaultChecked />
                </div>
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
