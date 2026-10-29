"use client";

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { useRouter, usePathname } from "next/navigation";
import { Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useBrandingStore } from "@/stores/branding-store";
import { useFeaturesStore } from "@/stores/features-store";
import { pagePermission, pathnameToModule } from "@/lib/modules";
import { clearSession, getAccessToken } from "@/lib/session";

export function LabAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const { setUser } = useAuthStore();
  const locale = useAuthStore((s) => s.locale);
  const { setBranding } = useBrandingStore();
  const { setFeatures, clearFeatures, isModuleEnabled, loaded: featuresLoaded } = useFeaturesStore();
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Verify the session once per app load — not on every navigation. Each page's own
  // requests still go through the 401/403 handling in lib/api.
  useEffect(() => {
    if (!getAccessToken("lab")) {
      router.replace(`/login?redirect=${encodeURIComponent(pathnameRef.current)}`);
      return;
    }

    setOffline(false);
    api
      .get("/auth/me")
      .then(async (res) => {
        setUser(res.data);
        if (res.data.tenant_id) localStorage.setItem("tenant_id", res.data.tenant_id);
        try {
          const [brandRes, featuresRes] = await Promise.all([
            api.get("/settings/branding"),
            api.get("/settings/features"),
          ]);
          setBranding(brandRes.data);
          setFeatures(featuresRes.data.modules, featuresRes.data.enabled_modules);
        } catch {
          /* optional — don't block app */
        }
        setReady(true);
      })
      .catch((err) => {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        // A dropped connection is not a reason to sign the user out.
        if (status === undefined || status >= 500) {
          setOffline(true);
          return;
        }
        const detail = isAxiosError(err) ? (err.response?.data as { detail?: unknown })?.detail : undefined;
        const blocked = typeof detail === "string" && detail.startsWith("Tenant account is");
        if (blocked) sessionStorage.setItem("login_error", detail);
        clearSession();
        clearFeatures();
        router.replace(blocked ? "/login?suspended=1" : "/login");
      });
  }, [attempt, router, setUser, setBranding, setFeatures, clearFeatures]);

  const hasPermission = useAuthStore((s) => s.hasPermission);
  useEffect(() => {
    if (!ready || !featuresLoaded) return;
    const moduleKey = pathnameToModule(pathname);
    const perm = pagePermission(pathname);
    if ((moduleKey && !isModuleEnabled(moduleKey)) || (perm && !hasPermission(perm))) {
      router.replace("/dashboard");
    }
  }, [ready, featuresLoaded, pathname, isModuleEnabled, hasPermission, router]);

  if (offline) {
    const isAr = locale === "ar";
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center" dir={isAr ? "rtl" : "ltr"}>
        <WifiOff className="h-10 w-10 text-muted-foreground" />
        <p className="font-semibold">{isAr ? "تعذّر الاتصال بالخادم" : "Can't reach the server"}</p>
        <p className="text-sm text-muted-foreground">
          {isAr ? "تحقق من الإنترنت ثم أعد المحاولة." : "Check your internet connection and try again."}
        </p>
        <Button onClick={() => setAttempt((a) => a + 1)}>{isAr ? "إعادة المحاولة" : "Try again"}</Button>
      </div>
    );
  }

  const perm = pagePermission(pathname);
  const forbidden = ready && featuresLoaded && !!perm && !hasPermission(perm);

  // Don't mount a page the user can't open (it would fire requests that 403) while redirecting.
  if (!ready || forbidden) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}

export function PlatformAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setPlatformAdmin = useAuthStore((s) => s.setPlatformAdmin);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!getAccessToken("platform")) {
      router.replace("/platform/login");
      return;
    }

    api
      .get("/auth/platform/me")
      .then((res) => {
        setPlatformAdmin(res.data);
        setReady(true);
      })
      .catch((err) => {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        if (status === undefined || status >= 500) {
          // Transient failure: keep the session and try again shortly.
          setTimeout(() => setAttempt((a) => a + 1), 3000);
          return;
        }
        clearSession();
        router.replace("/platform/login");
      });
  }, [attempt, router, setPlatformAdmin]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
