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
import { t } from "@/lib/i18n";
import { AppBrand } from "./app-brand";

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
  const modules = variant === "platform" ? platformModules : labModules;

  return (
    <aside
      className={cn(
        "group/sidebar flex h-full flex-col border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out",
        expanded ? "w-64 border-e" : "w-[76px] border-e hover:w-64"
      )}
    >
      {/* Logo — always visible */}
      <div className="relative shrink-0 overflow-hidden border-b border-sidebar-border">
        <div className="absolute inset-x-0 top-0 h-1 gradient-brand animate-pulse-soft" />
        <div className="flex h-[72px] items-center gap-3 px-3 pt-1">
          {variant === "lab" ? (
            <AppBrand
              showName
              size="sm"
              href="/dashboard"
              nameClassName={cn(
                "transition-all duration-300",
                expanded
                  ? "opacity-100"
                  : "w-0 overflow-hidden opacity-0 group-hover/sidebar:w-auto group-hover/sidebar:opacity-100"
              )}
            />
          ) : (
            <Link href="/platform" className="flex items-center gap-3">
              <div className="logo-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-brand text-white">
                <Microscope className="h-5 w-5" />
              </div>
              <p
                className={cn(
                  "truncate text-sm font-bold gradient-brand-text transition-all duration-300",
                  expanded
                    ? "opacity-100"
                    : "w-0 overflow-hidden opacity-0 group-hover/sidebar:w-auto group-hover/sidebar:opacity-100"
                )}
              >
                {t(locale, "appName")}
              </p>
            </Link>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-x-hidden overflow-y-auto p-2">
        <ul className="space-y-1">
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
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span
                    className={cn(
                      "truncate whitespace-nowrap transition-all duration-300",
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
        <div className="h-1.5 rounded-full gradient-brand opacity-80" />
        <p
          className={cn(
            "mt-2 truncate text-[10px] text-muted-foreground transition-opacity duration-200",
            expanded ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100"
          )}
        >
          LabMaster © 2026
        </p>
      </div>
    </aside>
  );
}
