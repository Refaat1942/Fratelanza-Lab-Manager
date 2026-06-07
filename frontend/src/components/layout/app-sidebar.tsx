"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Stethoscope, Share2, FlaskConical, FileText,
  Receipt, Wallet, Package, ShoppingCart, Truck, Contact, Megaphone,
  Calculator, BarChart3, Settings, UserCog, Building2, Microscope, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useBrandingStore } from "@/stores/branding-store";
import { BrandingLogo } from "@/components/branding/branding-logo";
import { displayName } from "@/lib/branding";
import { t } from "@/lib/i18n";

const labModules = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { href: "/patients", icon: Users, key: "patients" as const },
  { href: "/doctors", icon: Stethoscope, key: "doctors" as const },
  { href: "/referrals", icon: Share2, key: "referrals" as const },
  { href: "/tests", icon: FlaskConical, key: "tests" as const },
  { href: "/results", icon: FileText, key: "results" as const },
  { href: "/billing", icon: Receipt, key: "billing" as const },
  { href: "/expenses", icon: Wallet, key: "expenses" as const },
  { href: "/inventory", icon: Package, key: "inventory" as const },
  { href: "/purchasing", icon: ShoppingCart, key: "purchasing" as const },
  { href: "/suppliers", icon: Truck, key: "suppliers" as const },
  { href: "/crm", icon: Contact, key: "crm" as const },
  { href: "/marketing", icon: Megaphone, key: "marketing" as const },
  { href: "/accounting", icon: Calculator, key: "accounting" as const },
  { href: "/reports", icon: BarChart3, key: "reports" as const },
  { href: "/users", icon: UserCog, key: "users" as const },
  { href: "/branches", icon: Building2, key: "branches" as const },
  { href: "/settings", icon: Settings, key: "settings" as const },
];

const platformModules = [
  { href: "/platform", icon: LayoutDashboard, key: "revenue" as const },
  { href: "/platform/tenants", icon: Microscope, key: "tenants" as const },
  { href: "/platform/subscriptions", icon: CreditCard, key: "subscriptions" as const },
  { href: "/platform/plans", icon: Receipt, key: "plans" as const },
  { href: "/platform/audit", icon: FileText, key: "auditLogs" as const },
];

export function AppSidebar({ variant = "lab" }: { variant?: "lab" | "platform" }) {
  const pathname = usePathname();
  const locale = useAuthStore((s) => s.locale);
  const branding = useBrandingStore((s) => s.branding);
  const modules = variant === "platform" ? platformModules : labModules;
  const labTitle = variant === "lab" ? displayName(branding, locale) : t(locale, "appName");

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground shadow-xl">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        {variant === "lab" ? (
          <BrandingLogo
            logoUrl={branding.logo_url}
            alt={labTitle}
            size="sm"
            className="rounded-lg bg-sidebar-primary ring-0"
            accentColor={branding.primary_color}
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Microscope className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-sm font-bold leading-tight truncate">{labTitle}</h1>
          {variant === "platform" && (
            <p className="text-[10px] text-sidebar-foreground/60">{t(locale, "platform")}</p>
          )}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-0.5">
          {modules.map(({ href, icon: Icon, key }) => {
            const active = pathname === href || (href !== "/platform" && href !== "/dashboard" && pathname.startsWith(href + "/")) || pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(locale, key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-sidebar-border p-4 text-[10px] text-sidebar-foreground/50">
        LabMaster Egypt © 2026
      </div>
    </aside>
  );
}
