import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TenantBranding } from "@/lib/branding";
import { DEFAULT_BRANDING } from "@/lib/branding";

interface BrandingState {
  branding: TenantBranding;
  setBranding: (branding: TenantBranding) => void;
  clearBranding: () => void;
}

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set) => ({
      branding: DEFAULT_BRANDING,
      setBranding: (branding) => set({ branding }),
      clearBranding: () => set({ branding: DEFAULT_BRANDING }),
    }),
    { name: "labmaster-branding" }
  )
);
