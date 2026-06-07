"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, getApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useBrandingStore } from "@/stores/branding-store";

export function LabAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setUser } = useAuthStore();
  const { setBranding } = useBrandingStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const isPlatform = localStorage.getItem("is_platform_admin") === "true";

    if (!token || isPlatform) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    api
      .get("/auth/me")
      .then(async (res) => {
        setUser(res.data);
        if (res.data.tenant_id) localStorage.setItem("tenant_id", res.data.tenant_id);
        localStorage.removeItem("is_platform_admin");
        try {
          const brandRes = await api.get("/settings/branding");
          setBranding(brandRes.data);
        } catch {
          /* branding optional — don't block app */
        }
        setReady(true);
      })
      .catch((err) => {
        const msg = getApiError(err);
        if (msg.startsWith("Tenant account is")) {
          sessionStorage.setItem("login_error", msg);
        }
        localStorage.clear();
        router.replace(msg.startsWith("Tenant account is") ? "/login?suspended=1" : "/login");
      });
  }, [router, pathname, setUser, setBranding]);

  if (!ready) {
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const isPlatform = localStorage.getItem("is_platform_admin") === "true";

    if (!token || !isPlatform) {
      router.replace("/platform/login");
      return;
    }

    api
      .get("/auth/platform/me")
      .then(() => setReady(true))
      .catch(() => {
        localStorage.clear();
        router.replace("/platform/login");
      });
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
