"use client";

import * as XLSX from "xlsx";

export type ExcelPrimitive = string | number | boolean | Date | null | undefined;

export interface ExcelColumn<T> {
  header: string;
  value: (row: T) => ExcelPrimitive;
}

export interface ExcelSheet {
  name: string;
  rows: Record<string, ExcelPrimitive>[];
}

function autosizeColumns(rows: Record<string, ExcelPrimitive>[]) {
  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);
  return headers.map((header) => {
    const maxCellWidth = rows.reduce((max, row) => {
      const value = row[header];
      const text =
        value instanceof Date
          ? value.toISOString().slice(0, 10)
          : value === null || value === undefined
            ? ""
            : String(value);
      return Math.max(max, text.length);
    }, header.length);

    return { wch: Math.min(Math.max(maxCellWidth + 2, 12), 40) };
  });
}

export function exportRowsToExcel<T>({
  rows,
  columns,
  filename,
  sheetName = "Data",
}: {
  rows: T[];
  columns: ExcelColumn<T>[];
  filename: string;
  sheetName?: string;
}) {
  const formattedRows = rows.map((row) =>
    columns.reduce<Record<string, ExcelPrimitive>>((acc, column) => {
      acc[column.header] = column.value(row);
      return acc;
    }, {})
  );

  exportWorkbook([{ name: sheetName, rows: formattedRows }], filename);
}

export function exportWorkbook(sheets: ExcelSheet[], filename: string) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    worksheet["!cols"] = autosizeColumns(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31) || "Sheet");
  });

  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
