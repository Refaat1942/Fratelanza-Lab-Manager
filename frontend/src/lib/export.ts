import { downloadApiFile } from "./download";

export type KitLabelLayout = "single" | "double";

export async function downloadOrderKitLabels(orderId: string, layout: KitLabelLayout = "single") {
  const params = new URLSearchParams({ layout });
  await downloadApiFile(
    `/results/orders/${orderId}/labels?${params}`,
    `kit_labels_${layout}_${orderId.slice(0, 8)}.pdf`
  );
}

export async function downloadResultKitLabel(resultId: string, layout: KitLabelLayout = "single") {
  const params = new URLSearchParams({ layout });
  await downloadApiFile(`/results/${resultId}/label?${params}`, `kit_label_${resultId.slice(0, 8)}.pdf`);
}

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
