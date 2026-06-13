"use client";

import { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { AnimatedPage } from "./animated-page";
import { SmartAssistant } from "@/components/assistant/smart-assistant";
import { useLocale } from "@/hooks/use-locale";
import { Sheet, SheetContent } from "@/components/ui/sheet";

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
