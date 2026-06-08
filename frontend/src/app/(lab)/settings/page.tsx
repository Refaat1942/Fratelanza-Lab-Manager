"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import { useBrandingStore } from "@/stores/branding-store";
import { BrandingLogo } from "@/components/branding/branding-logo";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { DEFAULT_BRANDING, displayName, type TenantBranding } from "@/lib/branding";
import { buildBrandingTemplate } from "@/lib/print";
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
    custom_css: "",
    report_header_html: DEFAULT_BRANDING.report_header_html,
    report_footer_html: DEFAULT_BRANDING.report_footer_html,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get("/settings/branding")
      .then((res) => {
        setForm({ ...DEFAULT_BRANDING, ...res.data });
        persistBranding({ ...DEFAULT_BRANDING, ...res.data });
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, [persistBranding]);

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
        custom_css: form.custom_css || null,
        report_header_html: form.report_header_html || null,
        report_footer_html: form.report_footer_html || null,
      });
      setForm({ ...DEFAULT_BRANDING, ...data });
      persistBranding({ ...DEFAULT_BRANDING, ...data });
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
      setForm({ ...DEFAULT_BRANDING, ...data });
      persistBranding({ ...DEFAULT_BRANDING, ...data });
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

  const previewTokens = {
    company_name: displayName(form, locale),
    company_name_ar: form.company_name_ar || "",
    report_title: locale === "ar" ? "إيصال عميل" : "Customer Receipt",
    patient_name: locale === "ar" ? "اسم العميل" : "Customer Name",
    invoice_number: "INV-00042",
    date: new Date().toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US"),
    printed_at: new Date().toLocaleString(locale === "ar" ? "ar-EG" : "en-US"),
  };

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
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="branding">{locale === "ar" ? "العلامة التجارية" : "Branding"}</TabsTrigger>
          <TabsTrigger value="receipt">{locale === "ar" ? "تصميم الإيصال" : "Receipt Design"}</TabsTrigger>
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
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="me-2 h-4 w-4" />
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
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
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

        <TabsContent value="receipt">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{locale === "ar" ? "مصمم الإيصال" : "Receipt Designer"}</CardTitle>
                <CardDescription>
                  {locale === "ar"
                    ? "خصص رأس وتذييل الإيصال باستخدام HTML بسيط. يمكنك استخدام المتغيرات بين أقواس مزدوجة."
                    : "Customize the receipt header and footer with simple HTML. You can use placeholders wrapped in double braces."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-dashed p-4 text-xs leading-6 text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    {locale === "ar" ? "المتغيرات المتاحة" : "Available placeholders"}
                  </p>
                  <p>
                    {"{{company_name}}"}, {"{{company_name_ar}}"}, {"{{report_title}}"}, {"{{patient_name}}"}, {"{{invoice_number}}"}, {"{{date}}"}, {"{{printed_at}}"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{locale === "ar" ? "رأس الإيصال" : "Receipt Header"}</Label>
                  <Textarea
                    value={form.report_header_html || ""}
                    onChange={(e) => setForm({ ...form, report_header_html: e.target.value })}
                    rows={6}
                    placeholder="<div><strong>{{company_name}}</strong></div>"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{locale === "ar" ? "تذييل الإيصال" : "Receipt Footer"}</Label>
                  <Textarea
                    value={form.report_footer_html || ""}
                    onChange={(e) => setForm({ ...form, report_footer_html: e.target.value })}
                    rows={5}
                    placeholder="<div>{{printed_at}}</div>"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{locale === "ar" ? "تنسيق CSS مخصص" : "Custom CSS"}</Label>
                  <Textarea
                    value={form.custom_css || ""}
                    onChange={(e) => setForm({ ...form, custom_css: e.target.value })}
                    rows={6}
                    placeholder=".print-card { border-color: #3b82f6; }"
                  />
                </div>

                <Button onClick={saveBranding} disabled={saving}>
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                  {locale === "ar" ? "حفظ تصميم الإيصال" : "Save receipt design"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{locale === "ar" ? "معاينة الإيصال" : "Receipt Preview"}</CardTitle>
                <CardDescription>
                  {locale === "ar" ? "تظهر نفس المعاينة داخل طباعة إيصال العميل" : "The same styling is used when printing the customer receipt"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <BrandingLogo
                      logoUrl={form.logo_url}
                      alt={displayName(form, locale)}
                      size="md"
                      className="bg-white"
                      accentColor={form.primary_color}
                    />
                    <div>
                      <p className="font-semibold">{displayName(form, locale)}</p>
                      <p className="text-xs text-muted-foreground">{locale === "ar" ? "إيصال عميل" : "Customer receipt"}</p>
                    </div>
                  </div>

                  <div
                    className="space-y-3 text-sm"
                    style={{ color: form.primary_color || undefined }}
                  >
                    <div
                      dangerouslySetInnerHTML={{
                        __html: buildBrandingTemplate(form.report_header_html, previewTokens),
                      }}
                    />
                    <div className="rounded-xl border p-4 text-foreground">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{locale === "ar" ? "رقم الفاتورة" : "Invoice #"}</span>
                        <span>{previewTokens.invoice_number}</span>
                      </div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{locale === "ar" ? "العميل" : "Customer"}</span>
                        <span>{previewTokens.patient_name}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{locale === "ar" ? "الإجمالي" : "Total"}</span>
                        <strong>EGP 450.00</strong>
                      </div>
                    </div>
                    <div
                      className="text-sm text-foreground"
                      dangerouslySetInnerHTML={{
                        __html: buildBrandingTemplate(form.report_footer_html, previewTokens),
                      }}
                    />
                  </div>
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
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border p-4">
                <Label>{locale === "ar" ? "اللغة الافتراضية: العربية" : "Default Language: Arabic"}</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between rounded-xl border p-4">
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
              <div className="flex items-center justify-between rounded-xl border p-4">
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
