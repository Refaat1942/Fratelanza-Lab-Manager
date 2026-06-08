"use client";

import { useEffect, useMemo, useState } from "react";
import { Microscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveLogoUrl } from "@/lib/branding";

interface BrandingLogoProps {
  logoUrl?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  accentColor?: string;
  tenantCode?: string | null;
  tenantId?: string | null;
}

const sizes = {
  sm: { box: "h-9 w-9", icon: "h-5 w-5" },
  md: { box: "h-14 w-14", icon: "h-7 w-7" },
  lg: { box: "h-20 w-20", icon: "h-10 w-10" },
  xl: { box: "h-28 w-28", icon: "h-14 w-14" },
};

export function BrandingLogo({
  logoUrl,
  alt,
  size = "md",
  className,
  accentColor,
  tenantCode,
  tenantId,
}: BrandingLogoProps) {
  const resolved = useMemo(
    () =>
      resolveLogoUrl(logoUrl, { tenantCode, tenantId }) ||
      resolveLogoUrl("/labmaster-logo.svg"),
    [logoUrl, tenantCode, tenantId]
  );
  const [failed, setFailed] = useState(false);
  const s = sizes[size];

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/20",
        s.box,
        className
      )}
      style={{ backgroundColor: accentColor ? `${accentColor}22` : undefined }}
    >
      {resolved && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={resolved}
          src={resolved}
          alt={alt}
          className="h-full w-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        <Microscope className={cn(s.icon, "text-primary")} style={{ color: accentColor }} />
      )}
    </div>
  );
}
