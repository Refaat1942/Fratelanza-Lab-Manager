export interface TenantBranding {
  tenant_code?: string;
  company_name: string;
  company_name_ar?: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  custom_domain?: string | null;
}

export const DEFAULT_BRANDING: TenantBranding = {
  company_name: "LabMaster Egypt",
  company_name_ar: "لاب ماستر مصر",
  primary_color: "#1e3a5f",
  logo_url: "/labmaster-logo.svg",
};

/** Resolve logo/upload URLs — uses same-origin API path in browser so images work in production */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Static assets in /public (e.g. /labmaster-logo.svg)
  if (path.startsWith("/") && !path.startsWith("/uploads")) return path;

  const uploadPath = path.startsWith("/uploads") ? path : `/uploads/${path}`;

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/v1${uploadPath}`;
  }

  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
  return `${base}${uploadPath}`;
}

export function displayName(branding: TenantBranding, locale: "ar" | "en"): string {
  if (locale === "ar" && branding.company_name_ar) return branding.company_name_ar;
  return branding.company_name;
}
