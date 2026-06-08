"use client";

import Link from "next/link";
import { BrandingLogo } from "@/components/branding/branding-logo";
import { useBrandingStore } from "@/stores/branding-store";
import { useAuthStore } from "@/stores/auth-store";
import { displayName } from "@/lib/branding";
import { cn } from "@/lib/utils";

interface AppBrandProps {
  showName?: boolean;
  size?: "sm" | "md";
  href?: string | null;
  className?: string;
  nameClassName?: string;
}

export function AppBrand({
  showName = true,
  size = "md",
  href = "/dashboard",
  className,
  nameClassName,
}: AppBrandProps) {
  const branding = useBrandingStore((s) => s.branding);
  const locale = useAuthStore((s) => s.locale);
  const title = displayName(branding, locale);
  const logoSrc = branding.logo_url || "/labmaster-logo.svg";

  const content = (
    <>
      <BrandingLogo
        logoUrl={logoSrc}
        alt={title}
        size={size === "sm" ? "sm" : "md"}
        className="logo-ring shrink-0 rounded-xl bg-white"
        accentColor={branding.primary_color || "#3b82f6"}
      />
      {showName && (
        <div className={cn("brand-name min-w-0 leading-tight", nameClassName)}>
          <p className="truncate text-sm font-bold gradient-brand-text">{title}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {locale === "ar" ? "نظام إدارة المختبر" : "Laboratory ERP"}
          </p>
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn("flex items-center gap-3 transition-transform hover:scale-[1.02]", className)}>
        {content}
      </Link>
    );
  }

  return <div className={cn("flex items-center gap-3", className)}>{content}</div>;
}
