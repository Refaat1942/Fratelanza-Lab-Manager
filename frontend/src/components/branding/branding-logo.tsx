"use client";

import { useEffect, useState } from "react";
import { Microscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/branding";

interface BrandingLogoProps {
  logoUrl?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  accentColor?: string;
}

const sizes = {
  sm: { box: "h-9 w-9", icon: "h-5 w-5", img: 36 },
  md: { box: "h-14 w-14", icon: "h-7 w-7", img: 56 },
  lg: { box: "h-20 w-20", icon: "h-10 w-10", img: 80 },
  xl: { box: "h-28 w-28", icon: "h-14 w-14", img: 112 },
};

export function BrandingLogo({ logoUrl, alt, size = "md", className, accentColor }: BrandingLogoProps) {
  const resolved = resolveAssetUrl(logoUrl || "/labmaster-logo.svg");
  const [failed, setFailed] = useState(false);
  const s = sizes[size];

  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

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
