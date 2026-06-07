"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    localStorage.removeItem("is_platform_admin");
    try {
      const { data: tokens } = await api.post("/auth/login", {
        username,
        password,
        tenant_code: tenantCode,
      });
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      const { data: user } = await api.get("/auth/me");
      setUser(user);
      setStoreTenant(tenantCode);
      persistBranding(branding);
      if (user.tenant_id) localStorage.setItem("tenant_id", user.tenant_id);
      toast.success("Welcome back!");
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
    <div className="flex min-h-screen">
      <div
        className="relative hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 text-white overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${accent} 0%, #0f172a 55%, #1e293b 100%)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col items-center text-center max-w-md"
        >
          {loadingBrand ? (
            <Loader2 className="h-12 w-12 animate-spin text-white/70 mb-8" />
          ) : (
            <BrandingLogo
              logoUrl={branding.logo_url}
              alt={name}
              size="xl"
              className="mb-8 bg-white/10 ring-white/30"
              accentColor="#ffffff"
            />
          )}
          <h1 className="text-4xl font-bold tracking-tight">{name}</h1>
          <p className="mt-4 text-lg text-white/80 leading-relaxed">
            {locale === "ar"
              ? "نظام إدارة المختبرات الطبية — ERP و LIMS متكامل"
              : "Medical Laboratory ERP & LIMS — patients, tests, billing & more"}
          </p>
          <p className="mt-8 text-sm text-white/50">Powered by LabMaster Egypt</p>
        </motion.div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-background p-6">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md">
          <Card className="w-full border-0 shadow-xl">
            <CardHeader className="text-center pb-2 lg:hidden">
              <div className="mx-auto mb-3">
                <BrandingLogo logoUrl={branding.logo_url} alt={name} size="md" accentColor={accent} />
              </div>
              <CardTitle className="text-2xl font-semibold tracking-tight">{name}</CardTitle>
              <CardDescription>
                {locale === "ar" ? "تسجيل دخول المختبر" : "Laboratory Sign In"}
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
                    className="h-11"
                    autoComplete="organization"
                    placeholder={locale === "ar" ? "مثال: demo-lab" : "e.g. demo-lab"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">{locale === "ar" ? "اسم المستخدم" : "Username"}</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="h-11"
                    autoComplete="username"
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
                    className="h-11"
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full text-base text-white"
                  disabled={loading}
                  style={{ backgroundColor: accent }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : locale === "ar" ? "دخول" : "Sign In"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <Link href="/platform/login" className="hover:underline" style={{ color: accent }}>
                  {locale === "ar" ? "بوابة مالك المنصة ←" : "Platform admin portal →"}
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
