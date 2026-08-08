"use client";

import { BrandingLogo } from "@/components/branding/branding-logo";
import { displayName, type TenantBranding } from "@/lib/branding";
import { useAuthStore } from "@/stores/auth-store";

interface ResultReportPreviewProps {
  branding: TenantBranding;
  tenantCode?: string | null;
  tenantId?: string | null;
}

export function ResultReportPreview({ branding, tenantCode, tenantId }: ResultReportPreviewProps) {
  const locale = useAuthStore((s) => s.locale);
  const title = displayName(branding, locale);
  const header = branding.report_header_html || title;
  const footer =
    branding.report_footer_html ||
    (locale === "ar" ? "هذا التقرير للاستخدام الطبي فقط" : "This report is for medical use only");
  const accent = branding.primary_color || "#1565C0";

  const sampleResults = [
    { param: locale === "ar" ? "Hb" : "Hb", value: "14.2", unit: "g/dL", ref: "12 - 16" },
    { param: locale === "ar" ? "RBC" : "RBC", value: "4.8", unit: "M/µL", ref: "4.2 - 5.4" },
    { param: locale === "ar" ? "WBC" : "WBC", value: "7.1", unit: "K/µL", ref: "4.0 - 11.0" },
  ];

  return (
    <div
      className="mx-auto w-full max-w-[210mm] overflow-hidden rounded-lg border bg-white text-[11px] text-black shadow-lg"
      style={{ minHeight: "280mm" }}
    >
      <div className="h-2" style={{ background: accent }} />
      <div className="px-8 pb-6 pt-6">
        <div className="mb-4 flex flex-col items-center gap-3 text-center">
          <BrandingLogo
            logoUrl={branding.logo_url}
            alt={title}
            size="md"
            className="bg-white ring-border"
            tenantCode={tenantCode || branding.tenant_code}
            tenantId={tenantId}
          />
          <div className="whitespace-pre-wrap text-sm font-bold leading-snug">{header}</div>
          <p className="text-xs font-semibold tracking-wide" style={{ color: accent }}>
            {locale === "ar" ? "تقرير نتائج التحاليل — LABORATORY REPORT" : "LABORATORY REPORT — تقرير نتائج التحاليل"}
          </p>
        </div>

        <div
          className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border text-[10px]"
          style={{ borderColor: `${accent}55`, background: `${accent}15` }}
        >
          {[
            [locale === "ar" ? "المريض" : "Patient", locale === "ar" ? "أحمد محمد" : "Ahmed Mohamed"],
            [locale === "ar" ? "رقم الطلب" : "Order #", "ORD-00003"],
            [locale === "ar" ? "كود المريض" : "Patient ID", "P000042"],
            [locale === "ar" ? "تاريخ التقرير" : "Report date", new Date().toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex gap-2 bg-[#F5F9FF] px-3 py-2">
              <span className="min-w-[72px] font-semibold text-gray-700">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>

        <h3 className="mb-2 text-sm font-bold">
          {locale === "ar" ? "صورة دم كاملة — CBC" : "Complete Blood Count — CBC"}
        </h3>

        <table className="mb-6 w-full border-collapse text-[10px]">
          <thead>
            <tr className="text-white" style={{ background: accent }}>
              <th className="px-2 py-2 text-start">{locale === "ar" ? "البند" : "Parameter"}</th>
              <th className="px-2 py-2 text-center">{locale === "ar" ? "النتيجة" : "Result"}</th>
              <th className="px-2 py-2 text-center">{locale === "ar" ? "الوحدة" : "Unit"}</th>
              <th className="px-2 py-2 text-end">{locale === "ar" ? "المعدل" : "Reference"}</th>
            </tr>
          </thead>
          <tbody>
            {sampleResults.map((row, i) => (
              <tr key={row.param} className={i % 2 ? "bg-gray-50" : "bg-white"}>
                <td className="border border-gray-200 px-2 py-1.5">{row.param}</td>
                <td className="border border-gray-200 px-2 py-1.5 text-center font-semibold">{row.value}</td>
                <td className="border border-gray-200 px-2 py-1.5 text-center">{row.unit}</td>
                <td className="border border-gray-200 px-2 py-1.5 text-end">{row.ref}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mb-8 whitespace-pre-wrap text-center text-[10px] text-gray-600">{footer}</p>

        <div className="grid grid-cols-2 gap-8 text-[10px]">
          <div>
            <p className="font-semibold">{locale === "ar" ? "مدير المختبر" : "Lab Director"}</p>
            <div className="mt-6 border-t border-gray-400" />
          </div>
          <div className="text-end">
            <p className="font-semibold">{locale === "ar" ? "التاريخ" : "Date"}</p>
            <p className="mt-2">{new Date().toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
