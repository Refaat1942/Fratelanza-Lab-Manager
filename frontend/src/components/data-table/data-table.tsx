"use client";

import { motion } from "framer-motion";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Printer, Search, X } from "lucide-react";
import { downloadExcelFile, printTableDocument, type ExportColumn, type ExportRow } from "@/lib/export";

const dateFieldPriority = [
  "created_at",
  "issued_at",
  "expense_date",
  "referral_date",
  "order_date",
  "updated_at",
  "date",
  "date_of_birth",
];

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  exportFilename?: string;
  exportTitle?: string;
  dateFilterField?: keyof TData & string;
  dateFilterLabel?: string;
  locale?: "ar" | "en";
  enableDateFilter?: boolean;
  enableExport?: boolean;
  enablePrint?: boolean;
  onExport?: (format: "excel", rows: TData[]) => void;
  onPrint?: () => void;
}

function getValue(row: unknown, key: string): unknown {
  if (!row || typeof row !== "object") return undefined;
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, row);
}

function isDateLike(value: unknown): boolean {
  if (value instanceof Date) return true;
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

function detectDateField<TData>(rows: TData[]): string | undefined {
  const first = rows.find((row) => row && typeof row === "object") as Record<string, unknown> | undefined;
  if (!first) return undefined;
  const keys = Object.keys(first);
  const priorityMatch = dateFieldPriority.find((key) => keys.includes(key) && isDateLike(first[key]));
  if (priorityMatch) return priorityMatch;
  return keys.find((key) => /date|_at$/i.test(key) && isDateLike(first[key]));
}

function toEndOfDay(date: string): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getColumnKey<TData, TValue>(column: ColumnDef<TData, TValue>): string | undefined {
  const maybeAccessor = column as ColumnDef<TData, TValue> & { accessorKey?: string };
  return typeof maybeAccessor.accessorKey === "string" ? maybeAccessor.accessorKey : undefined;
}

function getHeader<TData, TValue>(column: ColumnDef<TData, TValue>, key: string): string {
  return typeof column.header === "string" ? column.header : key.replaceAll("_", " ");
}

function buildExportRows<TData, TValue>(
  columns: ColumnDef<TData, TValue>[],
  rows: TData[]
): { exportColumns: ExportColumn[]; exportRows: ExportRow[] } {
  const exportColumns = columns
    .map((column) => {
      const key = getColumnKey(column);
      return key ? { key, header: getHeader(column, key) } : null;
    })
    .filter(Boolean) as ExportColumn[];
  return {
    exportColumns,
    exportRows: rows.map((row) => {
      const out: ExportRow = {};
      exportColumns.forEach((column) => {
        out[column.key] = getValue(row, column.key);
      });
      return out;
    }),
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  exportFilename = "feature-export.xls",
  exportTitle = "Feature Export",
  dateFilterField,
  dateFilterLabel,
  locale,
  enableDateFilter = true,
  enableExport = true,
  enablePrint = true,
  onExport,
  onPrint,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const isArabic = locale === "ar" || (typeof document !== "undefined" && document.documentElement.dir === "rtl");
  const activeDateField = useMemo(
    () => dateFilterField || detectDateField(data),
    [data, dateFilterField]
  );
  const filteredData = useMemo(() => {
    if (!enableDateFilter || !activeDateField || (!dateFrom && !dateTo)) return data;
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? toEndOfDay(dateTo) : null;
    return data.filter((row) => {
      const raw = getValue(row, activeDateField);
      if (!isDateLike(raw)) return false;
      const value = raw instanceof Date ? raw : new Date(String(raw));
      if (from && value < from) return false;
      if (to && value > to) return false;
      return true;
    });
  }, [activeDateField, data, dateFrom, dateTo, enableDateFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const visibleRows = table.getFilteredRowModel().rows.map((row) => row.original);
  const exportRows = visibleRows.length ? visibleRows : filteredData;
  const hasDateFilter = enableDateFilter && Boolean(activeDateField);

  const handleExport = () => {
    if (onExport) {
      onExport("excel", exportRows);
      return;
    }
    const { exportColumns, exportRows: rows } = buildExportRows(columns, exportRows);
    downloadExcelFile(exportFilename, exportTitle, exportColumns, rows);
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    const { exportColumns, exportRows: rows } = buildExportRows(columns, exportRows);
    printTableDocument(exportTitle, exportColumns, rows, {
      dir: isArabic ? "rtl" : "ltr",
      subtitle: hasDateFilter && (dateFrom || dateTo)
        ? `${isArabic ? "الفترة" : "Period"}: ${dateFrom || "..."} - ${dateTo || "..."}`
        : undefined,
    });
  };

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="ps-9 bg-card shadow-card border-border/60"
          />
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
          {hasDateFilter && (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/60 bg-card/60 p-2 shadow-sm">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {dateFilterLabel || (isArabic ? "من تاريخ" : "From date")}
                </p>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-36 bg-background" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {isArabic ? "إلى تاريخ" : "To date"}
                </p>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-36 bg-background" />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="icon-sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {enableExport && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" />
                Excel
              </Button>
            )}
            {enablePrint && (
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                {isArabic ? "طباعة" : "Print"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card className="overflow-hidden py-0 shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="cursor-pointer select-none font-semibold text-foreground/80"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {{"asc": " ↑", "desc": " ↓"}[header.column.getIsSorted() as string] ?? ""}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    {isArabic ? "لا توجد نتائج" : "No results found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {isArabic ? "صفحة" : "Page"} {table.getState().pagination.pageIndex + 1} {isArabic ? "من" : "of"} {table.getPageCount() || 1}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            {isArabic ? "السابق" : "Previous"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            {isArabic ? "التالي" : "Next"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
