"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function LocaleDirection() {
  const locale = useAuthStore((s) => s.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  return null;
}
