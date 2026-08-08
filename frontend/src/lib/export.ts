import { downloadApiFile, openPdfInNewTab, printApiFile } from "./download";

export type KitLabelLayout = "single" | "double";

function labelPath(orderId: string, layout: KitLabelLayout) {
  const params = new URLSearchParams({ layout });
  return `/results/orders/${orderId}/labels?${params}`;
}

export async function downloadOrderKitLabels(orderId: string, layout: KitLabelLayout = "single") {
  await downloadApiFile(labelPath(orderId, layout), `kit_labels_${layout}_${orderId.slice(0, 8)}.pdf`);
}

/** Auto-print kit labels after patient registration (opens browser print dialog). */
export async function printOrderKitLabels(orderId: string, layout: KitLabelLayout = "single") {
  await printApiFile(labelPath(orderId, layout));
}

export async function printResultKitLabel(resultId: string, layout: KitLabelLayout = "single") {
  const params = new URLSearchParams({ layout });
  await printApiFile(`/results/${resultId}/label?${params}`);
}

export async function printResultReport(resultId: string) {
  await printApiFile(`/results/${resultId}/report`, "application/pdf");
}

export async function previewResultReport(resultId: string) {
  await openPdfInNewTab(`/results/${resultId}/report`);
}

export async function downloadResultReport(resultId: string) {
  await downloadApiFile(
    `/results/${resultId}/report`,
    `lab_result_${resultId.slice(0, 8)}.pdf`,
    "application/pdf"
  );
}

export async function downloadTestsImportTemplate() {
  await downloadApiFile("/tests/import/template", "tests_import_template.xlsx");
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
