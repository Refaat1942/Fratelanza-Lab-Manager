"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import { useBrandingStore } from "@/stores/branding-store";
import { BrandingLogo } from "@/components/branding/branding-logo";
import { ReceiptPreview } from "@/components/branding/receipt-preview";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { displayName, type TenantBranding } from "@/lib/branding";
import { toast } from "sonner";
import { Calendar, Loader2, Upload } from "lucide-react";

export default function SettingsPage() {
  const locale = useAuthStore((s) => s.locale);
  const tenantCode = useAuthStore((s) => s.tenantCode);
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  const { setBranding: persistBranding } = useBrandingStore();
  const [form, setForm] = useState<TenantBranding>({
    company_name: "",
    company_name_ar: "",
    logo_url: "",
    primary_color: "#3B82F6",
    secondary_color: "#10B981",
    accent_color: "#8B5CF6",
    report_header_html: "",
    report_footer_html: "",
    renewal_reminder_days: 14,
    renewal_reminder_enabled: true,
    subscription_end_date: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    plan_name?: string | null;
    status?: string | null;
    starts_at?: string | null;
    expires_at?: string | null;
    auto_renew?: boolean | null;
    price_egp?: number | null;
  } | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.get("/settings/branding"),
      api.get("/settings/subscription"),
      api.get("/public/version").catch(() => ({ data: null })),
    ])
      .then(([brandingRes, subscriptionRes, versionRes]) => {
        const data = brandingRes.data;
        setForm({
          ...data,
          subscription_end_date: data.subscription_end_date || "",
        });
        setSubscription(subscriptionRes.data);
        if (versionRes.data?.version) {
          setAppVersion(
            `${versionRes.data.version}${versionRes.data.build ? ` (${versionRes.data.build})` : ""}`
          );
        }
        if (subscriptionRes.data?.expires_at && !data.subscription_end_date) {
          setForm((prev) => ({
            ...prev,
            subscription_end_date: subscriptionRes.data.expires_at.slice(0, 10),
          }));
        }
      })
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
        report_header_html: form.report_header_html || null,
        report_footer_html: form.report_footer_html || null,
        renewal_reminder_days: form.renewal_reminder_days ?? 14,
        renewal_reminder_enabled: form.renewal_reminder_enabled ?? true,
      });
      setForm({ ...data, subscription_end_date: data.subscription_end_date || "" });
      persistBranding(data);
      toast.success(locale === "ar" ? "تم الحفظ" : "Settings saved");
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error(locale === "ar" ? "الحجم الأقصى 5 ميجا" : "Max size is 5 MB");
      return;
    }
    setUploading(true);
    const preview = URL.createObjectURL(file);
    setLogoPreview(preview);
    const body = new FormData();
    body.append("file", file);
    try {
      const { data } = await api.post("/settings/branding/logo", body);
      setForm((prev) => ({ ...prev, logo_url: data.logo_url }));
      persistBranding(data);
      toast.success(locale === "ar" ? "تم رفع الشعار بنجاح" : "Logo uploaded successfully");
    } catch (err) {
      setLogoPreview(null);
      toast.error(getApiError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeLogo = logoPreview || form.logo_url;
  const logoTenantCode = form.tenant_code || tenantCode;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t(locale, "settings")}</h1>
        <p className="text-muted-foreground">
          {locale === "ar"
            ? "إعدادات المختبر والعلامة التجارية والإيصالات"
            : "Laboratory branding, receipts, and preferences"}
        </p>
      </div>

      <Tabs defaultValue="branding">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="branding" className="flex-1 min-w-[120px]">
            {locale === "ar" ? "العلامة التجارية" : "Branding"}
          </TabsTrigger>
          <TabsTrigger value="receipt" className="flex-1 min-w-[120px]">
            {locale === "ar" ? "تصميم الإيصال" : "Receipt"}
          </TabsTrigger>
          <TabsTrigger value="general" className="flex-1 min-w-[120px]">
            {locale === "ar" ? "عام" : "General"}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1 min-w-[120px]">
            {locale === "ar" ? "الإشعارات" : "Notifications"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{locale === "ar" ? "العلامة التجارية" : "Branding"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "اسم المختبر (إنجليزي)" : "Lab Name (EN)"} *</Label>
                    <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "اسم المختبر (عربي)" : "Lab Name (AR)"}</Label>
                    <Input value={form.company_name_ar || ""} onChange={(e) => setForm({ ...form, company_name_ar: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <Label>{locale === "ar" ? "شعار المختبر" : "Lab Logo"}</Label>
                  <div className="flex flex-wrap items-center gap-4">
                    <BrandingLogo
                      logoUrl={activeLogo}
                      alt={displayName(form, locale)}
                      size="lg"
                      className="bg-white ring-border"
                      tenantCode={logoTenantCode}
                      tenantId={tenantId}
                    />
                    <div className="space-y-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadLogo(file);
                        }}
                      />
                      <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Upload className="me-2 h-4 w-4" />}
                        {uploading
                          ? locale === "ar" ? "جاري الرفع..." : "Uploading..."
                          : locale === "ar" ? "رفع شعار جديد" : "Upload new logo"}
                      </Button>
                      <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, SVG — max 5 MB</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {(["primary_color", "secondary_color", "accent_color"] as const).map((key) => (
                    <div key={key} className="space-y-2">
                      <Label>{key === "primary_color" ? (locale === "ar" ? "اللون الأساسي" : "Primary") : key === "secondary_color" ? (locale === "ar" ? "الثانوي" : "Secondary") : (locale === "ar" ? "التمييز" : "Accent")}</Label>
                      <Input type="color" value={form[key] || "#3B82F6"} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="h-10" />
                    </div>
                  ))}
                </div>

                <Button onClick={saveBranding} disabled={saving}>
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                  {t(locale, "save")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{locale === "ar" ? "معاينة الدخول" : "Login Preview"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl p-6 text-center text-white" style={{ background: `linear-gradient(145deg, ${form.primary_color} 0%, #134e4a 100%)` }}>
                  <div className="mx-auto mb-4 flex justify-center">
                    <BrandingLogo logoUrl={activeLogo} alt={displayName(form, locale)} size="lg" className="bg-white/10 ring-white/30" accentColor="#fff" tenantCode={logoTenantCode} tenantId={tenantId} />
                  </div>
                  <p className="text-lg font-bold">{displayName(form, locale)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="receipt">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{locale === "ar" ? "تصميم الإيصال" : "Receipt Design"}</CardTitle>
                <CardDescription>
                  {locale === "ar" ? "يظهر على إيصال PDF للعميل" : "Shown on customer PDF receipt"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "رأس الإيصال" : "Header"}</Label>
                  <Textarea rows={4} value={form.report_header_html || ""} onChange={(e) => setForm({ ...form, report_header_html: e.target.value })} placeholder={displayName(form, locale)} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "تذييل الإيصال" : "Footer"}</Label>
                  <Textarea rows={3} value={form.report_footer_html || ""} onChange={(e) => setForm({ ...form, report_footer_html: e.target.value })} />
                </div>
                <Button onClick={saveBranding} disabled={saving}>
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                  {t(locale, "save")}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{locale === "ar" ? "معاينة الإيصال" : "Receipt Preview"}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center bg-muted/20 py-6">
                <ReceiptPreview branding={{ ...form, logo_url: activeLogo }} tenantCode={logoTenantCode} tenantId={tenantId} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="general">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{locale === "ar" ? "الاشتراك" : "Subscription"}</CardTitle>
                <CardDescription>
                  {locale === "ar"
                    ? "شروط الاشتراك وصلاحيته كما حددها مالك المنصة"
                    : "Your plan and validity period as set by the platform owner"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {subscription?.plan_name ? (
                  <>
                    <div className="flex justify-between gap-4 border-b pb-2">
                      <span className="text-muted-foreground">{locale === "ar" ? "الباقة" : "Plan"}</span>
                      <span className="font-medium">{subscription.plan_name}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b pb-2">
                      <span className="text-muted-foreground">{locale === "ar" ? "الحالة" : "Status"}</span>
                      <span className="font-medium capitalize">{subscription.status || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b pb-2">
                      <span className="text-muted-foreground">{locale === "ar" ? "صالح من" : "Valid from"}</span>
                      <span className="font-medium">
                        {subscription.starts_at
                          ? new Date(subscription.starts_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 border-b pb-2">
                      <span className="text-muted-foreground">{locale === "ar" ? "صالح حتى" : "Valid to"}</span>
                      <span className="font-medium">
                        {subscription.expires_at
                          ? new Date(subscription.expires_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")
                          : "—"}
                      </span>
                    </div>
                    {subscription.price_egp != null && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{locale === "ar" ? "السعر" : "Price"}</span>
                        <span className="font-medium">EGP {subscription.price_egp.toLocaleString()}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {locale === "ar"
                      ? "لا يوجد اشتراك نشط. تواصل مع مالك المنصة."
                      : "No active subscription on file. Contact the platform owner."}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{locale === "ar" ? "الإعدادات العامة" : "General Settings"}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {[
                  { label: locale === "ar" ? "اللغة الافتراضية" : "Default Language", desc: locale === "ar" ? "العربية RTL" : "Arabic RTL" },
                  { label: locale === "ar" ? "المنطقة الزمنية" : "Timezone", desc: "Africa/Cairo" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border p-4">
                    <Label className="text-base">{item.label}</Label>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                    <Switch defaultChecked className="mt-3" />
                  </div>
                ))}
                {appVersion && (
                  <div className="rounded-lg border border-dashed p-4 text-sm">
                    <Label className="text-base">
                      {locale === "ar" ? "إصدار النظام" : "System version"}
                    </Label>
                    <p className="mt-1 font-mono text-muted-foreground">{appVersion}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {locale === "ar"
                        ? "إذا لم ترَ الميزات الجديدة، نفّذ update-production.sh على السيرفر"
                        : "If new features are missing, run update-production.sh on the server"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{locale === "ar" ? "تذكيرات الاشتراك" : "Subscription Reminders"}</CardTitle>
              <CardDescription>
                {locale === "ar" ? "حدد تاريخ انتهاء الاشتراك وموعد التذكير" : "Set subscription end date and reminder timing"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-base">{locale === "ar" ? "تفعيل التذكير" : "Enable Reminder"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {locale === "ar" ? "إرسال تنبيه قبل انتهاء الاشتراك" : "Alert before subscription ends"}
                  </p>
                </div>
                <Switch
                  checked={form.renewal_reminder_enabled ?? true}
                  onCheckedChange={(v) => setForm({ ...form, renewal_reminder_enabled: v })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-lg border p-4">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {locale === "ar" ? "تاريخ انتهاء الاشتراك" : "Subscription End Date"}
                  </Label>
                  <Input
                    type="date"
                    value={
                      subscription?.expires_at?.slice(0, 10) ||
                      form.subscription_end_date ||
                      ""
                    }
                    readOnly
                    className="bg-muted/40"
                  />
                  <p className="text-xs text-muted-foreground">
                    {locale === "ar"
                      ? "يُدار من مالك المنصة"
                      : "Managed by the platform owner"}
                  </p>
                </div>
                <div className="space-y-2 rounded-lg border p-4">
                  <Label>{locale === "ar" ? "التذكير قبل (يوم)" : "Remind Before (days)"}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={form.renewal_reminder_days ?? 14}
                    onChange={(e) => setForm({ ...form, renewal_reminder_days: parseInt(e.target.value) || 14 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {locale === "ar" ? "سيُرسل التنبيه قبل هذا العدد من الأيام" : "Alert will be sent this many days before end date"}
                  </p>
                </div>
              </div>

              {(subscription?.expires_at || form.subscription_end_date) && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  {locale === "ar" ? "تذكير في: " : "Reminder on: "}
                  <strong>
                    {(() => {
                      const end = new Date(
                        subscription?.expires_at || `${form.subscription_end_date}T00:00:00`
                      );
                      end.setDate(end.getDate() - (form.renewal_reminder_days || 14));
                      return end.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB");
                    })()}
                  </strong>
                </div>
              )}

              <Button onClick={saveBranding} disabled={saving}>
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {t(locale, "save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
