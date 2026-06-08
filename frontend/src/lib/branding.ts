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
  primary_color: "#3B82F6",
  secondary_color: "#10B981",
  accent_color: "#8B5CF6",
  logo_url: "/labmaster-logo.svg",
};

function apiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
}

/** Resolve logo/upload URLs against the configured API host so split frontend/backend deployments work. */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Static assets in /public (e.g. /labmaster-logo.svg)
  if (path.startsWith("/") && !path.startsWith("/uploads")) return path;

  const uploadPath = path.startsWith("/uploads") ? path : `/uploads/${path}`;

  return `${apiBaseUrl()}${uploadPath}`;
}

export function displayName(branding: TenantBranding, locale: "ar" | "en"): string {
  if (locale === "ar" && branding.company_name_ar) return branding.company_name_ar;
  return branding.company_name;
}
