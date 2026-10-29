"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FlaskConical, Loader2, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, getApiError } from "@/lib/api";
import { clearSession } from "@/lib/session";
import { useAuthStore } from "@/stores/auth-store";
import { useBrandingStore } from "@/stores/branding-store";

/** Passwordless entry point for demo links: /demo?token=... */
function DemoEntry() {
  const router = useRouter();
  const params = useSearchParams();
  const locale = useAuthStore((s) => s.locale);
  const { setUser, setTenantCode } = useAuthStore();
  const setBranding = useBrandingStore((s) => s.setBranding);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const isAr = locale === "ar";

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = params.get("token");
    if (!token) {
      setError(isAr ? "رابط العرض غير مكتمل" : "This demo link is incomplete");
      return;
    }
    (async () => {
      try {
        clearSession();
        const { data: tokens } = await api.post("/auth/demo-login", { token });
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("refresh_token", tokens.refresh_token);
        const { data: user } = await api.get("/auth/me");
        setUser(user);
        if (user.tenant_id) localStorage.setItem("tenant_id", user.tenant_id);
        try {
          const { data: branding } = await api.get("/settings/branding");
          setBranding(branding);
          if (branding.tenant_code) setTenantCode(branding.tenant_code);
        } catch {
          /* branding is cosmetic */
        }
        router.replace("/dashboard");
      } catch (err) {
        clearSession();
        setError(getApiError(err));
      }
    })();
  }, [params, router, setUser, setTenantCode, setBranding, isAr]);

  return (
    <div className="gradient-hero-animated flex min-h-screen items-center justify-center p-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {error ? <LinkIcon className="h-7 w-7" /> : <FlaskConical className="h-7 w-7" />}
        </div>
        {error ? (
          <>
            <h1 className="text-lg font-semibold">{isAr ? "تعذّر فتح العرض التجريبي" : "Couldn't open the demo"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAr ? "اطلب رابطاً جديداً من مزوّد الخدمة." : "Ask your provider for a new link."}
            </p>
            <Button className="mt-6 w-full" variant="outline" nativeButton={false} render={<Link href="/login" />}>
              {isAr ? "الذهاب لتسجيل الدخول" : "Go to sign in"}
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">{isAr ? "جارٍ فتح العرض التجريبي…" : "Opening your demo…"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isAr ? "لحظات ويتم تجهيز المختبر التجريبي." : "Your demo laboratory will be ready in a moment."}
            </p>
            <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-primary" />
          </>
        )}
      </div>
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense fallback={null}>
      <DemoEntry />
    </Suspense>
  );
}
