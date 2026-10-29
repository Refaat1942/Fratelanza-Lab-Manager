import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/i18n";
import { clearSession } from "@/lib/session";

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

export interface PlatformAdminProfile {
  username: string;
  full_name: string;
  using_default_password?: boolean;
}

interface AuthState {
  user: User | null;
  platformAdmin: PlatformAdminProfile | null;
  setPlatformAdmin: (admin: PlatformAdminProfile | null) => void;
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
      platformAdmin: null,
      setPlatformAdmin: (platformAdmin) => set({ platformAdmin }),
      tenantCode: null,
      locale: "ar",
      platformLocale: "en",
      setUser: (user) => set({ user }),
      setTenantCode: (tenantCode) => set({ tenantCode }),
      setLocale: (locale) => set({ locale }),
      setPlatformLocale: (platformLocale) => set({ platformLocale }),
      logout: () => {
        clearSession();
        // Keep tenantCode so the login screen pre-fills the same laboratory next time.
        set({ user: null, platformAdmin: null });
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
