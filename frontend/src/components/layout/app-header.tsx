"use client";

import { Globe, LogOut, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter, usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { AppBrand } from "./app-brand";
import { t, type TranslationKey } from "@/lib/i18n";

interface AppHeaderProps {
  onMenuClick?: () => void;
  variant?: "lab" | "platform";
}

const pathTitles: Record<string, TranslationKey> = {
  "/dashboard": "dashboard",
  "/patients": "patients",
  "/doctors": "doctors",
  "/referrals": "referrals",
  "/tests": "tests",
  "/results": "results",
  "/billing": "billing",
  "/expenses": "expenses",
  "/inventory": "inventory",
  "/purchasing": "purchasing",
  "/suppliers": "suppliers",
  "/crm": "crm",
  "/marketing": "marketing",
  "/accounting": "accounting",
  "/reports": "reports",
  "/users": "users",
  "/branches": "branches",
  "/settings": "settings",
  "/platform": "revenue",
  "/platform/tenants": "tenants",
  "/platform/subscriptions": "subscriptions",
  "/platform/plans": "plans",
  "/platform/audit": "auditLogs",
};

function resolveTitle(pathname: string): TranslationKey | null {
  if (pathTitles[pathname]) return pathTitles[pathname];
  const match = Object.keys(pathTitles).find((p) => p !== "/dashboard" && pathname.startsWith(p + "/"));
  return match ? pathTitles[match] : null;
}

export function AppHeader({ onMenuClick, variant = "lab" }: AppHeaderProps) {
  const { user, locale, setLocale, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const pageKey = resolveTitle(pathname);

  const handleLogout = () => {
    const isPlatform = localStorage.getItem("is_platform_admin") === "true";
    logout();
    router.push(isPlatform ? "/platform/login" : "/login");
  };

  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "LM";

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-border/60 glass-header px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo always visible in header on desktop + mobile */}
        <AppBrand
          showName={false}
          size="sm"
          href={variant === "platform" ? "/platform" : "/dashboard"}
          className="shrink-0"
        />

        {pageKey && (
          <div className="hidden min-w-0 border-s border-border/60 ps-3 sm:block">
            <p className="truncate text-sm font-semibold text-foreground">
              {t(locale, pageKey)}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-2 border-border/60 bg-card/80" />
            }
          >
            <Globe className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">{locale === "ar" ? "العربية" : "English"}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLocale("ar" as Locale)}>العربية</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLocale("en" as Locale)}>English</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="flex items-center gap-2 rounded-full pe-2 ps-1 hover:bg-muted" />
            }
          >
            <Avatar className="h-9 w-9 ring-2 ring-transparent [background:linear-gradient(135deg,#10b981,#3b82f6,#8b5cf6)] p-[2px]">
              <AvatarFallback className="bg-white text-xs font-bold gradient-brand-text">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
              {user?.full_name}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <User className="h-4 w-4" />
              {user?.username || user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              {locale === "ar" ? "تسجيل الخروج" : "Logout"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
