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

interface AppSidebarProps {
  variant?: "lab" | "platform";
  expanded?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ variant = "lab", expanded = false, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const locale = useAuthStore((s) => s.locale);
  const branding = useBrandingStore((s) => s.branding);
  const modules = variant === "platform" ? platformModules : labModules;
  const labTitle = variant === "lab" ? displayName(branding, locale) : t(locale, "appName");

  return (
    <aside
      className={cn(
        "group/sidebar flex h-full flex-col border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out",
        expanded ? "w-60 border-e" : "w-[72px] border-e hover:w-60"
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 overflow-hidden border-b border-sidebar-border px-3">
        {variant === "lab" ? (
          <BrandingLogo
            logoUrl={branding.logo_url}
            alt={labTitle}
            size="sm"
            className="shrink-0 rounded-lg ring-1 ring-border/50"
            accentColor="#0f766e"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Microscope className="h-4 w-4" />
          </div>
        )}
        <div
          className={cn(
            "min-w-0 transition-opacity duration-200",
            expanded ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100"
          )}
        >
          <h1 className="truncate text-sm font-bold text-foreground">{labTitle}</h1>
          {variant === "platform" && (
            <p className="truncate text-[10px] text-muted-foreground">{t(locale, "platform")}</p>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-x-hidden overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {modules.map(({ href, icon: Icon, key }) => {
            const active =
              pathname === href ||
              (href !== "/platform" && href !== "/dashboard" && pathname.startsWith(href + "/"));
            const label = t(locale, key);

            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  title={!expanded ? label : undefined}
                  className={cn(
                    "sidebar-nav-item",
                    active ? "sidebar-nav-item-active" : "sidebar-nav-item-inactive",
                    !expanded && "justify-center px-2.5 group-hover/sidebar:justify-start group-hover/sidebar:px-3"
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
                  <span
                    className={cn(
                      "truncate whitespace-nowrap transition-all duration-200",
                      expanded
                        ? "opacity-100"
                        : "w-0 overflow-hidden opacity-0 group-hover/sidebar:w-auto group-hover/sidebar:opacity-100"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <p
          className={cn(
            "truncate text-[10px] text-muted-foreground transition-opacity duration-200",
            expanded ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100"
          )}
        >
          LabMaster © 2026
        </p>
      </div>
    </aside>
  );
}
