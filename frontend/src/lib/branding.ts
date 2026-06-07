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

export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/") && !path.startsWith("/uploads")) return path;
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function displayName(branding: TenantBranding, locale: "ar" | "en"): string {
  if (locale === "ar" && branding.company_name_ar) return branding.company_name_ar;
  return branding.company_name;
}
