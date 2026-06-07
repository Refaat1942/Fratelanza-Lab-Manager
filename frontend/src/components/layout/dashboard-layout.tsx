"use client";

import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { useAuthStore } from "@/stores/auth-store";

export function DashboardLayout({
  children,
  variant = "lab",
}: {
  children: React.ReactNode;
  variant?: "lab" | "platform";
}) {
  const locale = useAuthStore((s) => s.locale);
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div className="flex h-screen" dir={dir}>
      <AppSidebar variant={variant} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
