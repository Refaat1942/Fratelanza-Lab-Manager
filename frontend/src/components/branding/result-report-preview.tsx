"use client";

import { BrandingLogo } from "@/components/branding/branding-logo";
import { displayName, type TenantBranding } from "@/lib/branding";
import { useAuthStore } from "@/stores/auth-store";

interface ResultReportPreviewProps {
  branding: TenantBranding;
  tenantCode?: string | null;
  tenantId?: string | null;
}

const SAMPLE_MAIN = [
  { param: "Haemoglobin", value: "14.2", unit: "g/dl", ref: "12.5 - 17.5" },
  { param: "RBCs Count", value: "4.85", unit: "10^6/µl", ref: "4.5 - 5.5" },
  { param: "WBCs Count", value: "7.1", unit: "10^3/µl", ref: "4.0 - 11.0" },
  { param: "Platelets", value: "245", unit: "10^3/µl", ref: "150 - 450" },
];

const SAMPLE_DIFF = [
  { param: "Neutrophils %", value: "58", unit: " %", ref: "40 - 70" },
  { param: "Lymphocytes %", value: "32", unit: " %", ref: "20 - 45" },
];

function ResultsTable({
  rows,
  locale,
}: {
  rows: typeof SAMPLE_MAIN;
  locale: string;
}) {
  return (
    <table className="mb-2 w-full border-collapse text-[10px]">
      <thead>
        <tr className="bg-[#E8E8E8]">
          <th className="px-2 py-2 text-start font-bold">{locale === "ar" ? "التحليل" : "Test"}</th>
          <th className="px-2 py-2 text-center font-bold">{locale === "ar" ? "النتيجة" : "Result"}</th>
          <th className="px-2 py-2 text-center font-bold">{locale === "ar" ? "الوحدة" : "Unit"}</th>
          <th className="px-2 py-2 text-center font-bold">{locale === "ar" ? "المعدل الطبيعي" : "Reference Range"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.param} className="border-b border-[#CCCCCC]/60">
            <td className="px-2 py-1.5">{row.param}</td>
            <td className="px-2 py-1.5 text-center font-semibold">{row.value}</td>
            <td className="px-2 py-1.5 text-center text-gray-600">{row.unit}</td>
            <td className="px-2 py-1.5 text-center text-gray-700">{row.ref}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ResultReportPreview({ branding, tenantCode, tenantId }: ResultReportPreviewProps) {
  const locale = useAuthStore((s) => s.locale);
  const title = displayName(branding, locale);
  const header = branding.report_header_html || title;
  const footer =
    branding.report_footer_html ||
    (locale === "ar" ? "هذا التقرير للاستخدام الطبي فقط" : "This report is for medical use only");

  return (
    <div
      className="mx-auto w-full max-w-[210mm] overflow-hidden rounded-lg border border-[#CCCCCC] bg-white text-[11px] text-[#111111] shadow-lg"
      style={{ minHeight: "280mm" }}
    >
      <div className="px-8 pb-6 pt-8">
        <div className="mb-4 flex items-start justify-between gap-6 border-b border-[#CCCCCC] pb-4">
          <div className="flex flex-col gap-2">
            <BrandingLogo
              logoUrl={branding.logo_url}
              alt={title}
              size="sm"
              className="bg-white ring-border"
              tenantCode={tenantCode || branding.tenant_code}
              tenantId={tenantId}
            />
            <div className="whitespace-pre-wrap text-sm font-bold leading-snug">{header}</div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 text-[10px]">
            <span className="text-gray-600">{locale === "ar" ? "المريض" : "Name"}</span>
            <span>{locale === "ar" ? "أحمد محمد" : "Ahmed Mohamed"}</span>
            <span className="text-gray-600">{locale === "ar" ? "العمر" : "Age"}</span>
            <span>40</span>
            <span className="text-gray-600">{locale === "ar" ? "كود المريض" : "Patient ID"}</span>
            <span>P000042</span>
            <span className="text-gray-600">{locale === "ar" ? "الطلب" : "Order"}</span>
            <span>ORD-00003</span>
            <span className="text-gray-600">{locale === "ar" ? "تاريخ التقرير" : "Report"}</span>
            <span>{new Date().toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")}</span>
          </div>
        </div>

        <div className="mb-3 bg-[#E8E8E8] py-2 text-center text-sm font-bold">
          {locale === "ar" ? "صورة دم كاملة" : "Complete Blood Picture"}
        </div>

        <ResultsTable rows={SAMPLE_MAIN} locale={locale} />

        <div className="mb-2 mt-4 bg-[#E8E8E8] px-2 py-1.5 text-[10px] font-bold">
          {locale === "ar" ? "عدد نووي" : "Differential Count"}
        </div>
        <ResultsTable rows={SAMPLE_DIFF} locale={locale} />

        <div className="mt-6 border-t border-[#CCCCCC] pt-4">
          <p className="mb-1 text-[10px] font-bold">{locale === "ar" ? "ملاحظات:" : "Comment:"}</p>
          <p className="text-[10px] text-gray-700">
            {locale === "ar" ? "النتائج ضمن المعدلات الطبيعية." : "Results within normal reference ranges."}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8 text-[10px]">
          <div>
            <p className="font-bold">{locale === "ar" ? "مدير المختبر" : "Lab Director"}</p>
            <p className="text-gray-600">{locale === "ar" ? "التوقيع المعتمد" : "Authorized Signatory"}</p>
            <div className="mt-6 border-t border-gray-800" />
          </div>
          <div className="text-end">
            <p className="font-bold">{locale === "ar" ? "التاريخ" : "Date"}</p>
            <p className="mt-2">{new Date().toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")}</p>
          </div>
        </div>

        <div className="mt-10 border-t border-[#CCCCCC] pt-3 text-center text-[9px] text-gray-500">
          {footer}
        </div>
      </div>
    </div>
  );
}
