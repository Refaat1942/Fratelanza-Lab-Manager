export interface ExportColumn {
  key: string;
  header: string;
}

export type ExportRow = Record<string, unknown>;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatValue(value: unknown): string {
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(parsed)) {
      return new Date(value).toLocaleString();
    }
    return value;
  }
  if (value == null) return "";
  return JSON.stringify(value);
}

export function downloadExcelFile(
  filename: string,
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[]
) {
  const safeFilename = filename.toLowerCase().endsWith(".xls") ? filename : `${filename}.xls`;
  const header = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("");
  const body = rows
    .map((row) => (
      `<tr>${columns.map((column) => `<td>${escapeHtml(formatValue(row[column.key]))}</td>`).join("")}</tr>`
    ))
    .join("");
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: start; }
      th { background: #f3f4f6; font-weight: 700; }
    </style>
  </head>
  <body>
    <h2>${escapeHtml(title)}</h2>
    <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
  </body>
</html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function printTableDocument(
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[],
  options: { dir?: "rtl" | "ltr"; subtitle?: string } = {}
) {
  const dir = options.dir || "ltr";
  const header = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("");
  const body = rows
    .map((row) => (
      `<tr>${columns.map((column) => `<td>${escapeHtml(formatValue(row[column.key]))}</td>`).join("")}</tr>`
    ))
    .join("");
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) {
    window.print();
    return;
  }
  win.document.write(`<!doctype html>
<html dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
      h1 { margin: 0 0 6px; font-size: 22px; }
      p { margin: 0 0 16px; color: #4b5563; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 7px 8px; text-align: start; vertical-align: top; }
      th { background: #f3f4f6; font-weight: 700; }
      @media print { button { display: none; } body { margin: 12mm; } }
    </style>
  </head>
  <body>
    <button onclick="window.print()" style="float: ${dir === "rtl" ? "left" : "right"}; margin-bottom: 12px;">Print / Save PDF</button>
    <h1>${escapeHtml(title)}</h1>
    ${options.subtitle ? `<p>${escapeHtml(options.subtitle)}</p>` : ""}
    <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
    <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
  </body>
</html>`);
  win.document.close();
}

