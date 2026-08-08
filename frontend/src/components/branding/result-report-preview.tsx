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
  { paramAr: "هيموجلوبين", param: "Haemoglobin", value: "14.2", unit: "g/dl", ref: "12.5 - 17.5" },
  { paramAr: "عدد كرات الدم الحمراء", param: "RBCs Count", value: "4.85", unit: "10^6/µl", ref: "4.5 - 5.5" },
  { paramAr: "عدد كرات الدم البيضاء", param: "WBCs Count", value: "7.1", unit: "10^3/µl", ref: "4.0 - 11.0" },
  { paramAr: "الصفائح الدموية", param: "Platelets", value: "245", unit: "10^3/µl", ref: "150 - 450" },
];

const SAMPLE_DIFF = [
  { paramAr: "Neutrophils", param: "Neutrophils %", value: "58", unit: " %", ref: "40 - 70" },
  { paramAr: "Lymphocytes", param: "Lymphocytes %", value: "32", unit: " %", ref: "20 - 45" },
];

function ResultsTable({
  rows,
}: {
  rows: typeof SAMPLE_MAIN;
}) {
  return (
    <table className="mb-2 w-full border-collapse text-[10px]">
      <thead>
        <tr className="border-b-2" style={{ backgroundColor: "#E8E8E8", borderColor: "var(--accent, #0F766E)" }}>
          <th className="px-2 py-2 text-center font-bold">التحليل / Test</th>
          <th className="px-2 py-2 text-center font-bold">النتيجة / Result</th>
          <th className="px-2 py-2 text-center font-bold">الوحدة / Unit</th>
          <th className="px-2 py-2 text-center font-bold">المعدل / Reference</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.param} className="border-b border-[#CCCCCC]/60">
            <td className="px-2 py-1.5">
              <div className="font-semibold">{row.paramAr}</div>
              <div className="text-[9px] text-gray-500">{row.param}</div>
            </td>
            <td className="px-2 py-1.5 text-center font-semibold">{row.value}</td>
            <td className="px-2 py-1.5 text-center text-gray-600">{row.unit}</td>
            <td className="px-2 py-1.5 text-center text-gray-700">{row.ref}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InfoCell({ labelAr, labelEn, value }: { labelAr: string; labelEn: string; value: string }) {
  return (
    <div className="border border-[#CCCCCC]/80 bg-[#FAFAFA] p-2">
      <div className="text-[8px] text-gray-500">{labelAr} / {labelEn}</div>
      <div className="text-[10px] font-bold">{value}</div>
    </div>
  );
}

export function ResultReportPreview({ branding, tenantCode, tenantId }: ResultReportPreviewProps) {
  const locale = useAuthStore((s) => s.locale);
  const title = displayName(branding, locale);
  const accent = branding.primary_color || "#0F766E";
  const headerLines = (branding.report_header_html || `${title}\n123 ش التحرير — القاهرة\nTel: 02-12345678`)
    .split("\n")
    .filter(Boolean);
  const footer =
    branding.report_footer_html ||
    (locale === "ar" ? "هذا التقرير للاستخدام الطبي فقط — This report is for medical use only" : "This report is for medical use only");

  return (
    <div
      className="mx-auto w-full max-w-[210mm] overflow-hidden rounded-lg border border-[#CCCCCC] bg-white text-[11px] text-[#111111] shadow-lg"
      style={{ minHeight: "280mm", ["--accent" as string]: accent }}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />
      <div className="px-8 pb-6 pt-6">
        <div className="mb-4 flex items-center gap-4 border-b pb-4" style={{ borderColor: accent }}>
          <BrandingLogo
            logoUrl={branding.logo_url}
            alt={title}
            size="sm"
            className="bg-white ring-border"
            tenantCode={tenantCode || branding.tenant_code}
            tenantId={tenantId}
          />
          <div className="flex-1 text-center">
            {headerLines.map((line, i) => (
              <p key={i} className={i === 0 ? "text-base font-bold leading-snug" : "text-[10px] text-gray-600"}>
                {line}
              </p>
            ))}
            <p className="mt-1 text-[9px] text-gray-500">Medical Laboratory Report — تقرير تحليل طبي</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-0 overflow-hidden rounded border-2" style={{ borderColor: accent }}>
          <InfoCell labelAr="اسم المريض" labelEn="Patient Name" value={locale === "ar" ? "أحمد محمد" : "Ahmed Mohamed"} />
          <InfoCell labelAr="العمر" labelEn="Age" value="40" />
          <InfoCell labelAr="النوع" labelEn="Sex" value={locale === "ar" ? "ذكر / Male" : "Male"} />
          <InfoCell labelAr="رقم الملف" labelEn="Patient ID" value="P000042" />
          <InfoCell labelAr="رقم الطلب" labelEn="Order No." value="ORD-00003" />
          <InfoCell labelAr="رقم الزيارة" labelEn="Visit No." value="V00012" />
          <InfoCell labelAr="تاريخ السحب" labelEn="Sample Date" value="08/08/2026 10:30" />
          <InfoCell labelAr="تاريخ التقرير" labelEn="Report Date" value="08/08/2026 14:00" />
          <InfoCell labelAr="الهاتف" labelEn="Phone" value="01001234567" />
        </div>

        <div className="mb-3 py-2 text-center text-sm font-bold text-white" style={{ backgroundColor: accent }}>
          {locale === "ar" ? "صورة دم كاملة — Complete Blood Picture" : "Complete Blood Picture — صورة دم كاملة"}
        </div>

        <ResultsTable rows={SAMPLE_MAIN} />

        <div className="mb-2 mt-4 bg-[#E8E8E8] px-2 py-1.5 text-center text-[10px] font-bold">
          Differential Count — عدد نووي
        </div>
        <ResultsTable rows={SAMPLE_DIFF} />

        <div className="mt-6 overflow-hidden rounded border border-[#CCCCCC]">
          <p className="bg-[#E8E8E8] px-2 py-1 text-[10px] font-bold">ملاحظات / Comment:</p>
          <p className="px-2 py-2 text-[10px] text-gray-700">
            {locale === "ar" ? "النتائج ضمن المعدلات الطبيعية." : "Results within normal reference ranges."}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8 text-[10px]">
          <div>
            <p className="font-bold">مدير المختبر / Lab Director</p>
            <p className="text-gray-600">التوقيع المعتمد / Authorized Signatory</p>
            <div className="mt-6 border-t border-gray-800" />
          </div>
          <div className="text-end">
            <p className="font-bold">التاريخ / Date</p>
            <p className="mt-2">{new Date().toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")}</p>
          </div>
        </div>

        <div className="mt-10 border-t pt-3 text-center text-[9px] text-gray-500" style={{ borderColor: accent }}>
          {footer}
        </div>
      </div>
    </div>
  );
}
