"use client";

import { useAuthStore } from "@/stores/auth-store";
import type { Locale } from "@/lib/i18n";

export function useLocale(variant: "lab" | "platform" = "lab") {
  const locale = useAuthStore((s) => (variant === "platform" ? s.platformLocale : s.locale));
  const setLocale = useAuthStore((s) =>
    variant === "platform" ? s.setPlatformLocale : s.setLocale
  );
  return { locale, setLocale } as { locale: Locale; setLocale: (locale: Locale) => void };
}
