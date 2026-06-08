"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { api, getApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useBrandingStore } from "@/stores/branding-store";
import { BrandingLogo } from "@/components/branding/branding-logo";
import { DEFAULT_BRANDING, displayName, type TenantBranding } from "@/lib/branding";
import { toast } from "sonner";

function LoginPageContent() {
  const locale = useAuthStore((s) => s.locale);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [loadingBrand, setLoadingBrand] = useState(false);
  const { setUser, setTenantCode: setStoreTenant } = useAuthStore();
  const { setBranding: persistBranding } = useBrandingStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const dir = locale === "ar" ? "rtl" : "ltr";

  const fetchBranding = useCallback(async (code: string) => {
    const trimmed = code.trim().toLowerCase();
    if (trimmed.length < 2) {
      setBranding(DEFAULT_BRANDING);
      return;
    }
    setLoadingBrand(true);
    try {
      const { data } = await api.get(`/public/branding/${encodeURIComponent(trimmed)}`);
      setBranding({
        company_name: data.company_name,
        company_name_ar: data.company_name_ar,
        logo_url: data.logo_url || DEFAULT_BRANDING.logo_url,
        primary_color: data.primary_color || DEFAULT_BRANDING.primary_color,
        tenant_code: data.tenant_code,
      });
    } catch {
      setBranding(DEFAULT_BRANDING);
    } finally {
      setLoadingBrand(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchBranding(tenantCode), 400);
    return () => clearTimeout(timer);
  }, [tenantCode, fetchBranding]);

  useEffect(() => {
    const stored = sessionStorage.getItem("login_error");
    if (stored || searchParams.get("suspended")) {
      const msg =
        stored ||
        (locale === "ar"
          ? "تم تعليق حساب المختبر. تواصل مع إدارة المنصة."
          : "This laboratory account is suspended. Contact platform support.");
      toast.error(msg);
      sessionStorage.removeItem("login_error");
    }
  }, [searchParams, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    localStorage.removeItem("is_platform_admin");
    localStorage.removeItem("tenant_id");
    const normalizedTenantCode = tenantCode.trim().toLowerCase();
    try {
      const { data: tokens } = await api.post("/auth/login", {
        username: username.trim(),
        password,
        tenant_code: normalizedTenantCode,
      });
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      const { data: user } = await api.get("/auth/me");
      setUser(user);
      setStoreTenant(normalizedTenantCode);
      persistBranding(branding);
      if (user.tenant_id) localStorage.setItem("tenant_id", user.tenant_id);
      toast.success(locale === "ar" ? "مرحباً بعودتك!" : "Welcome back!");
      router.push(redirect);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const name = displayName(branding, locale);
  const accent = branding.primary_color || DEFAULT_BRANDING.primary_color;

  return (
    <div className="flex min-h-screen bg-background" dir={dir}>
      <div className="gradient-hero-animated relative hidden lg:flex lg:w-[48%] flex-col items-center justify-center overflow-hidden p-12 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -end-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -start-24 h-80 w-80 rounded-full bg-secondary/30 blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex max-w-md flex-col items-center text-center"
        >
          {loadingBrand ? (
            <Loader2 className="mb-8 h-12 w-12 animate-spin text-white/70" />
          ) : (
            <BrandingLogo
              logoUrl={branding.logo_url}
              alt={name}
              size="xl"
              className="mb-8 bg-white/10 ring-white/20"
              accentColor="#ffffff"
            />
          )}
          <h1 className="text-4xl font-bold tracking-tight">{name}</h1>
          <p className="mt-4 text-lg leading-relaxed text-white/85">
            {locale === "ar"
              ? "نظام إدارة المختبرات الطبية — ERP و LIMS متكامل"
              : "Medical Laboratory ERP & LIMS — patients, tests, billing & more"}
          </p>
          <p className="mt-10 text-sm text-white/50">powered by fratelanza2026</p>
        </motion.div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-border/60 shadow-card-lg">
            <CardHeader className="text-center pb-2 lg:hidden">
              <div className="mx-auto mb-3">
                <BrandingLogo logoUrl={branding.logo_url} alt={name} size="md" accentColor={accent} />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">{name}</CardTitle>
              <CardDescription>
                {locale === "ar" ? "تسجيل دخول المختبر" : "Laboratory Sign In"}
              </CardDescription>
            </CardHeader>
            <CardHeader className="hidden pb-2 lg:block">
              <CardTitle className="text-xl font-bold">
                {locale === "ar" ? "تسجيل الدخول" : "Sign In"}
              </CardTitle>
              <CardDescription>
                {locale === "ar" ? "أدخل بيانات حساب المختبر" : "Enter your laboratory credentials"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenant">{locale === "ar" ? "كود المختبر" : "Laboratory Code"}</Label>
                  <Input
                    id="tenant"
                    value={tenantCode}
                    onChange={(e) => setTenantCode(e.target.value)}
                    required
                    className="h-11 bg-background"
                    autoComplete="organization"
                    placeholder="demo-lab"
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {locale === "ar"
                      ? "المعرّف الفريد لمختبرك (أحرف صغيرة، بدون مسافات). اطلبه من مدير النظام."
                      : "Your lab ID (lowercase, no spaces). Ask your system administrator if you do not know it."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">{locale === "ar" ? "اسم المستخدم" : "Username"}</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="h-11 bg-background"
                    autoComplete="username"
                    placeholder="labadmin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{locale === "ar" ? "كلمة المرور" : "Password"}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 bg-background"
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : locale === "ar" ? (
                    "دخول"
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
            powered by fratelanza2026
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
