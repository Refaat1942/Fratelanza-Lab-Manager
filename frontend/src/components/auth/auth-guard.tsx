"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export function LabAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setUser } = useAuthStore();
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
      .then((res) => {
        setUser(res.data);
        if (res.data.tenant_id) localStorage.setItem("tenant_id", res.data.tenant_id);
        localStorage.removeItem("is_platform_admin");
        setReady(true);
      })
      .catch(() => {
        localStorage.clear();
        router.replace("/login");
      });
  }, [router, pathname, setUser]);

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
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return <>{children}</>;
}
