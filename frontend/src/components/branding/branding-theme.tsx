"use client";

import { useEffect } from "react";
import { useBrandingStore } from "@/stores/branding-store";

export function BrandingTheme() {
  const branding = useBrandingStore((s) => s.branding);

  useEffect(() => {
    const root = document.documentElement;
    if (branding.primary_color) {
      root.style.setProperty("--primary", branding.primary_color);
      root.style.setProperty("--ring", branding.primary_color);
      root.style.setProperty("--sidebar-primary", branding.primary_color);
    }
    if (branding.accent_color) {
      root.style.setProperty("--accent", branding.accent_color);
    }
    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--accent");
    };
  }, [branding.primary_color, branding.accent_color]);

  return null;
}
