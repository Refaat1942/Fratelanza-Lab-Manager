"use client";

import { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { AnimatedPage } from "./animated-page";
import { SmartAssistant } from "@/components/assistant/smart-assistant";
import { useLocale } from "@/hooks/use-locale";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

export function DashboardLayout({
  children,
  variant = "lab",
}: {
  children: React.ReactNode;
  variant?: "lab" | "platform";
}) {
  const { locale } = useLocale(variant);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const [mobileOpen, setMobileOpen] = useState(false);
  const usingDefaultPassword = useAuthStore(
    (s) => variant === "platform" && Boolean(s.platformAdmin?.using_default_password)
  );

  return (
    <div className="flex h-screen overflow-hidden mesh-bg" dir={dir}>
      {/* Sidebar always visible on desktop */}
      <div className="hidden shrink-0 md:flex">
        <AppSidebar variant={variant} />
      </div>

      {/* Mobile drawer only */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side={dir === "rtl" ? "right" : "left"}
          className="w-64 border-sidebar-border p-0"
          showCloseButton
        >
          <AppSidebar variant={variant} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onMenuClick={() => setMobileOpen(true)} variant={variant} />
        {usingDefaultPassword && (
          <div
            role="alert"
            className="flex items-center gap-2 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200 sm:px-6"
          >
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              {locale === "ar"
                ? "أنت تستخدم كلمة المرور الافتراضية العامة. غيّرها الآن من قائمة الحساب أعلى الصفحة."
                : "You're using the public default password. Change it now from the account menu above."}
            </span>
          </div>
        )}
        <main className="relative flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="animate-float absolute -top-20 end-0 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="animate-float absolute bottom-0 start-0 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl [animation-delay:2s]" />
          </div>
          <div className="relative mx-auto max-w-[1600px]">
            <AnimatedPage>{children}</AnimatedPage>
          </div>
        </main>
      </div>

      {variant === "lab" && <SmartAssistant />}
    </div>
  );
}
