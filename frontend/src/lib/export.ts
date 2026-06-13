import { downloadApiFile } from "./download";

export async function exportModuleExcel(
  module: string,
  dateFrom?: string,
  dateTo?: string
) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  await downloadApiFile(`/export/${module}/excel${qs ? `?${qs}` : ""}`, `${module}_export.xlsx`);
}

export async function exportReportExcel(
  reportType: string,
  dateFrom?: string,
  dateTo?: string
) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  await downloadApiFile(`/reports/${reportType}/excel${qs ? `?${qs}` : ""}`, `${reportType}_report.xlsx`);
}

export async function downloadInvoiceReceipt(invoiceId: string) {
  await downloadApiFile(`/billing/invoices/${invoiceId}/receipt`, `receipt_${invoiceId}.pdf`);
}
