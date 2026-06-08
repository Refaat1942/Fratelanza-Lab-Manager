"use client";

import type { TenantBranding } from "@/lib/branding";

const DEFAULT_PRINT_CSS = `
  @page { size: A4; margin: 16mm; }
  body {
    font-family: Arial, "Tajawal", sans-serif;
    color: #0f172a;
    margin: 0;
    background: #ffffff;
  }
  .print-shell { max-width: 820px; margin: 0 auto; }
  .print-header, .print-footer { margin-bottom: 16px; }
  .print-card {
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 16px;
  }
  .print-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
  .print-kpi {
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 12px;
    background: #f8fafc;
  }
  .print-kpi-label {
    display: block;
    font-size: 12px;
    color: #64748b;
    margin-bottom: 6px;
  }
  .print-kpi-value {
    font-size: 20px;
    font-weight: 700;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th, td {
    border-bottom: 1px solid #e2e8f0;
    padding: 10px 8px;
    text-align: start;
    vertical-align: top;
  }
  th {
    color: #475569;
    font-weight: 700;
    background: #f8fafc;
  }
  .muted { color: #64748b; }
  .totals { margin-top: 16px; display: grid; gap: 8px; }
  .totals-row { display: flex; justify-content: space-between; gap: 16px; }
  .brand-block {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .brand-logo {
    width: 72px;
    height: 72px;
    border-radius: 16px;
    object-fit: contain;
    border: 1px solid #e2e8f0;
    padding: 6px;
  }
`;

function replaceTokens(template: string, tokens: Record<string, string>) {
  return Object.entries(tokens).reduce((html, [key, value]) => {
    return html.replaceAll(`{{${key}}}`, value);
  }, template);
}

export function buildBrandingTemplate(
  template: string | null | undefined,
  tokens: Record<string, string>
) {
  return replaceTokens(template || "", tokens);
}

export function openPrintDocument({
  title,
  body,
  branding,
  locale,
}: {
  title: string;
  body: string;
  branding?: TenantBranding | null;
  locale: "ar" | "en";
}) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=900");
  if (!printWindow) return;

  const dir = locale === "ar" ? "rtl" : "ltr";
  const html = `
    <!doctype html>
    <html lang="${locale}" dir="${dir}">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>${DEFAULT_PRINT_CSS}</style>
        ${branding?.custom_css ? `<style>${branding.custom_css}</style>` : ""}
      </head>
      <body>
        <div class="print-shell">${body}</div>
        <script>
          window.onload = () => {
            window.print();
            window.onafterprint = () => window.close();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
