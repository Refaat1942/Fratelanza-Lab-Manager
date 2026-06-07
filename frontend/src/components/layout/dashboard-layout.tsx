"use client";

import { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { useAuthStore } from "@/stores/auth-store";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function DashboardLayout({
  children,
  variant = "lab",
}: {
  children: React.ReactNode;
  variant?: "lab" | "platform";
}) {
  const locale = useAuthStore((s) => s.locale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir={dir}>
      <div className="hidden md:block shrink-0">
        <AppSidebar variant={variant} />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side={dir === "rtl" ? "right" : "left"}
          className="w-60 p-0 border-sidebar-border"
          showCloseButton={false}
        >
          <AppSidebar variant={variant} expanded onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 animate-fade-up">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
