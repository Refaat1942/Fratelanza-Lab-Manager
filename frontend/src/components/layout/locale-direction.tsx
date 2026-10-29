"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

/** Keep <html lang/dir> in sync so portalled UI (dialogs, menus, toasts) gets the right direction. */
export function LocaleDirection() {
  const pathname = usePathname();
  const labLocale = useAuthStore((s) => s.locale);
  const platformLocale = useAuthStore((s) => s.platformLocale);
  const locale = pathname?.startsWith("/platform") ? platformLocale : labLocale;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  return null;
}
