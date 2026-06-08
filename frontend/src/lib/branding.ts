import { getApiBaseUrl } from "./api-base";

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
  renewal_reminder_days?: number;
  renewal_reminder_enabled?: boolean;
  subscription_end_date?: string | null;
}

export const DEFAULT_BRANDING: TenantBranding = {
  company_name: "LabMaster Egypt",
  company_name_ar: "لاب ماستر مصر",
  primary_color: "#3B82F6",
  secondary_color: "#10B981",
  accent_color: "#8B5CF6",
  logo_url: "/labmaster-logo.svg",
};

export interface LogoResolveOptions {
  tenantCode?: string | null;
  tenantId?: string | null;
}

function isUploadedLogo(path: string | null | undefined): boolean {
  return !!path && (path.includes("/uploads/") || path.includes("uploads/logos"));
}

/**
 * Resolve logo image URL for <img> tags (no auth headers).
 * Uploaded logos use the public API endpoint so they work on login + sidebar.
 */
export function resolveLogoUrl(
  logoUrl: string | null | undefined,
  opts?: LogoResolveOptions
): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) return logoUrl;

  const base = getApiBaseUrl();

  if (isUploadedLogo(logoUrl)) {
    const code = opts?.tenantCode?.trim().toLowerCase();
    if (code) {
      const filename = logoUrl.split("/").pop() || "logo";
      return `${base}/public/branding/${encodeURIComponent(code)}/logo?v=${encodeURIComponent(filename)}`;
    }
    if (opts?.tenantId) {
      const filename = logoUrl.split("/").pop() || "logo";
      return `${base}/public/logo/${opts.tenantId}?v=${encodeURIComponent(filename)}`;
    }
    const uploadPath = logoUrl.startsWith("/uploads") ? logoUrl : `/uploads/${logoUrl}`;
    return `${base}${uploadPath}`;
  }

  if (logoUrl.startsWith("/")) return logoUrl;
  return logoUrl;
}

/** @deprecated Use resolveLogoUrl — kept for non-logo assets */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  return resolveLogoUrl(path);
}

export function displayName(branding: TenantBranding, locale: "ar" | "en"): string {
  if (locale === "ar" && branding.company_name_ar) return branding.company_name_ar;
  return branding.company_name;
}
