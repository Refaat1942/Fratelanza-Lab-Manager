import type { ColumnDef } from "@tanstack/react-table";

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}

function escapeXml(value: unknown) {
  const text = value == null ? "" : String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getHeader<TData, TValue>(column: ColumnDef<TData, TValue>, fallback: string) {
  if (typeof column.header === "string") return column.header;
  return fallback;
}

function getAccessorKey<TData, TValue>(column: ColumnDef<TData, TValue>) {
  const possible = column as ColumnDef<TData, TValue> & { accessorKey?: string };
  return possible.accessorKey;
}

function readValue<TData>(row: TData, key: string) {
  const source = row as Record<string, unknown>;
  const value = source[key];
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

export function exportRowsToExcel<TData, TValue>(
  rows: TData[],
  columns: ColumnDef<TData, TValue>[],
  filename: string
) {
  const exportColumns = columns
    .map((column, index) => ({
      key: getAccessorKey(column),
      header: stripHtml(getHeader(column, `Column ${index + 1}`)),
    }))
    .filter((column) => column.key);

  const headerRow = exportColumns
    .map((column) => `<Cell><Data ss:Type="String">${escapeXml(column.header)}</Data></Cell>`)
    .join("");

  const dataRows = rows
    .map((row) => {
      const cells = exportColumns
        .map((column) => `<Cell><Data ss:Type="String">${escapeXml(readValue(row, column.key!))}</Data></Cell>`)
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Export">
  <Table>
   <Row>${headerRow}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function exportPlainRowsToExcel(
  rows: Record<string, unknown>[],
  filename: string,
  headers?: Record<string, string>
) {
  const keys = rows.length ? Object.keys(rows[0]) : Object.keys(headers || {});
  const columns = keys.map((key) => ({
    id: key,
    accessorKey: key,
    header: headers?.[key] || key,
  })) as ColumnDef<Record<string, unknown>, unknown>[];

  exportRowsToExcel(rows, columns, filename);
}
