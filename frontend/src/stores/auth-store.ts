import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/i18n";

interface User {
  id: string;
  username: string;
  email?: string;
  full_name: string;
  full_name_ar?: string;
  is_tenant_admin: boolean;
  tenant_id?: string;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: User | null;
  tenantCode: string | null;
  locale: Locale;
  platformLocale: Locale;
  setUser: (user: User | null) => void;
  setTenantCode: (code: string | null) => void;
  setLocale: (locale: Locale) => void;
  setPlatformLocale: (locale: Locale) => void;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenantCode: null,
      locale: "ar",
      platformLocale: "en",
      setUser: (user) => set({ user }),
      setTenantCode: (tenantCode) => set({ tenantCode }),
      setLocale: (locale) => set({ locale }),
      setPlatformLocale: (platformLocale) => set({ platformLocale }),
      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("tenant_id");
        localStorage.removeItem("is_platform_admin");
        localStorage.removeItem("labmaster-branding");
        set({ user: null, tenantCode: null });
      },
      hasPermission: (perm) => {
        const { user } = get();
        if (!user) return false;
        if (user.is_tenant_admin || user.permissions.includes("*")) return true;
        return user.permissions.includes(perm);
      },
    }),
    {
      name: "labmaster-auth",
      merge: (persisted, current) => ({
        ...current,
        ...(typeof persisted === "object" && persisted !== null ? persisted : {}),
        platformLocale:
          (persisted as Partial<AuthState>)?.platformLocale ?? current.platformLocale,
      }),
    }
  )
);
