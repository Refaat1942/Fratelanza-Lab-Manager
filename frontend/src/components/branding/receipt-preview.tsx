"use client";

import { BrandingLogo } from "@/components/branding/branding-logo";
import { displayName, type TenantBranding } from "@/lib/branding";
import { useAuthStore } from "@/stores/auth-store";

interface ReceiptPreviewProps {
  branding: TenantBranding;
  tenantCode?: string | null;
  tenantId?: string | null;
}

export function ReceiptPreview({ branding, tenantCode, tenantId }: ReceiptPreviewProps) {
  const locale = useAuthStore((s) => s.locale);
  const title = displayName(branding, locale);
  const header = branding.report_header_html || title;
  const footer = branding.report_footer_html || (locale === "ar" ? "شكراً لزيارتكم" : "Thank you for your visit");

  const sampleItems = [
    { name: locale === "ar" ? "تحليل سكر صائم" : "Fasting Blood Sugar", qty: 1, price: 80 },
    { name: locale === "ar" ? "تحليل صورة دم كاملة" : "Complete Blood Count", qty: 1, price: 120 },
  ];
  const subtotal = sampleItems.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="mx-auto w-full max-w-xs rounded-lg border-2 border-dashed border-border bg-white p-4 font-mono text-[11px] leading-relaxed text-black shadow-inner">
      <div className="mb-3 flex justify-center">
        <BrandingLogo logoUrl={branding.logo_url} alt={title} size="sm" className="bg-white ring-border" tenantCode={tenantCode || branding.tenant_code} tenantId={tenantId} />
      </div>
      <div className="whitespace-pre-wrap text-center text-xs font-bold">{header}</div>
      <div className="my-3 border-t border-dashed border-gray-400 pt-2 text-center text-[10px] text-gray-600">
        <p>INV-00042</p>
        <p>{locale === "ar" ? "المريض: أحمد محمد" : "Patient: Ahmed Mohamed"}</p>
        <p>{new Date().toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")}</p>
      </div>
      <table className="mb-3 w-full text-[10px]">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="py-1 text-start">{locale === "ar" ? "البند" : "Item"}</th>
            <th className="py-1 text-center">#</th>
            <th className="py-1 text-end">{locale === "ar" ? "السعر" : "Price"}</th>
          </tr>
        </thead>
        <tbody>
          {sampleItems.map((item) => (
            <tr key={item.name} className="border-b border-gray-100">
              <td className="py-1 text-start">{item.name}</td>
              <td className="py-1 text-center">{item.qty}</td>
              <td className="py-1 text-end">{item.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-1 border-t border-dashed border-gray-400 pt-2 text-[10px]">
        <div className="flex justify-between"><span>{locale === "ar" ? "الإجمالي" : "Total"}</span><span>EGP {subtotal}</span></div>
        <div className="flex justify-between font-bold"><span>{locale === "ar" ? "المدفوع" : "Paid"}</span><span>EGP {subtotal}</span></div>
      </div>
      <div className="mt-4 whitespace-pre-wrap text-center text-[10px] text-gray-600">{footer}</div>
    </div>
  );
}
