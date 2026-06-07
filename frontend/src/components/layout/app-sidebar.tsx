"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Share2,
  FlaskConical,
  FileText,
  Receipt,
  Wallet,
  Package,
  ShoppingCart,
  Truck,
  Contact,
  Megaphone,
  Calculator,
  BarChart3,
  Settings,
  UserCog,
  Building2,
  Microscope,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
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
  const modules = variant === "platform" ? platformModules : labModules;

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Microscope className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-sm font-bold leading-tight">{t(locale, "appName")}</h1>
          {variant === "platform" && (
            <p className="text-xs text-muted-foreground">{t(locale, "platform")}</p>
          )}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {modules.map(({ href, icon: Icon, key }) => (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === href || pathname.startsWith(href + "/")
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(locale, key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
