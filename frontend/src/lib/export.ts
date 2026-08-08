import { downloadApiFile, openPdfInNewTab, printApiFile } from "./download";

export type KitLabelLayout = "single" | "double";

export type KitLabelOverrides = {
  lab_name?: string;
  patient_name?: string;
  test_name?: string;
  collection_date?: string;
  barcode?: string;
  width_mm?: number;
  height_mm?: number;
};

function labelQuery(layout: KitLabelLayout, overrides?: KitLabelOverrides) {
  const params = new URLSearchParams({ layout });
  if (overrides?.width_mm) params.set("width_mm", String(overrides.width_mm));
  if (overrides?.height_mm) params.set("height_mm", String(overrides.height_mm));
  if (overrides?.lab_name) params.set("lab_name", overrides.lab_name);
  if (overrides?.patient_name) params.set("patient_name", overrides.patient_name);
  if (overrides?.test_name) params.set("test_name", overrides.test_name);
  if (overrides?.collection_date) params.set("collection_date", overrides.collection_date);
  if (overrides?.barcode) params.set("barcode", overrides.barcode);
  return params;
}

function labelPath(orderId: string, layout: KitLabelLayout, overrides?: KitLabelOverrides) {
  return `/results/orders/${orderId}/labels?${labelQuery(layout, overrides)}`;
}

export async function downloadOrderKitLabels(orderId: string, layout: KitLabelLayout = "single") {
  await downloadApiFile(labelPath(orderId, layout), `kit_labels_${layout}_${orderId.slice(0, 8)}.pdf`);
}

/** Auto-print kit labels after patient registration (opens browser print dialog). */
export async function printOrderKitLabels(
  orderId: string,
  layout: KitLabelLayout = "single",
  overrides?: KitLabelOverrides,
) {
  await printApiFile(labelPath(orderId, layout, overrides));
}

export async function printResultKitLabel(
  resultId: string,
  layout: KitLabelLayout = "single",
  overrides?: KitLabelOverrides,
) {
  await printApiFile(`/results/${resultId}/label?${labelQuery(layout, overrides)}`);
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
