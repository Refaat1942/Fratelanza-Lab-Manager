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
  report_header_html?: string | null;
  report_footer_html?: string | null;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

export const DEFAULT_BRANDING: TenantBranding = {
  company_name: "LabMaster Egypt",
  company_name_ar: "لاب ماستر مصر",
  primary_color: "#3B82F6",
  secondary_color: "#10B981",
  accent_color: "#8B5CF6",
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
    const originApi = `${window.location.origin}/api/v1`;
    if (API_BASE === originApi || API_BASE.startsWith(window.location.origin)) {
      return `${originApi}${uploadPath}`;
    }
  }

  return `${API_BASE}${uploadPath}`;
}

/** Append cache-buster so replaced logos reload immediately after upload */
export function logoUrlWithCache(url: string | null | undefined): string | null {
  const resolved = resolveAssetUrl(url);
  if (!resolved) return null;
  if (url?.includes("/uploads/")) {
    return `${resolved}?t=${Date.now()}`;
  }
  return resolved;
}

export function displayName(branding: TenantBranding, locale: "ar" | "en"): string {
  if (locale === "ar" && branding.company_name_ar) return branding.company_name_ar;
  return branding.company_name;
}
