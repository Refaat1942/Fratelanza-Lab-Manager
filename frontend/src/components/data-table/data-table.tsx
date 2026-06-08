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
import { Download, Printer, Search } from "lucide-react";
import { exportRowsToExcel, type ExcelColumn } from "@/lib/excel";
import type { Locale } from "@/lib/i18n";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  onExport?: (format: "excel" | "pdf" | "csv") => void;
  onPrint?: () => void;
  locale?: Locale;
  exportFileName?: string;
  exportSheetName?: string;
  exportColumns?: ExcelColumn<TData>[];
  dateFilterKeys?: string[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  onExport,
  onPrint,
  locale = "en",
  exportFileName,
  exportSheetName,
  exportColumns,
  dateFilterKeys,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const dateFilteredData = useMemo(() => {
    if (!dateFilterKeys?.length || (!fromDate && !toDate)) return data;

    const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;

    return data.filter((row) => {
      const matchingDates = dateFilterKeys
        .map((key) => {
          const value = row && typeof row === "object" ? (row as Record<string, unknown>)[key] : undefined;
          if (!value) return null;
          const parsed = new Date(String(value));
          return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
        })
        .filter((value): value is number => value !== null);

      if (!matchingDates.length) return false;
      return matchingDates.some((value) => value >= fromTime && value <= toTime);
    });
  }, [data, dateFilterKeys, fromDate, toDate]);

  const table = useReactTable({
    data: dateFilteredData,
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

  const derivedExportColumns = useMemo<ExcelColumn<TData>[]>(() => {
    if (exportColumns?.length) return exportColumns;

    return columns.flatMap((column) => {
      const accessorKey =
        typeof column === "object" && "accessorKey" in column && typeof column.accessorKey === "string"
          ? column.accessorKey
          : null;
      const header =
        typeof column === "object" && typeof column.header === "string"
          ? column.header
          : accessorKey;

      if (!accessorKey || !header) return [];

      return [
        {
          header,
          value: (row: TData) => {
            const value = row && typeof row === "object" ? (row as Record<string, unknown>)[accessorKey] : "";
            if (value === null || value === undefined) return "";
            if (typeof value === "object") return JSON.stringify(value);
            return String(value);
          },
        },
      ];
    });
  }, [columns, exportColumns]);

  const handleExcelExport = () => {
    if (exportFileName && derivedExportColumns.length) {
      exportRowsToExcel({
        rows: table.getSortedRowModel().rows.map((row) => row.original),
        columns: derivedExportColumns,
        filename: exportFileName,
        sheetName: exportSheetName,
      });
      return;
    }

    onExport?.("excel");
  };

  const showExcelExport = Boolean((exportFileName && derivedExportColumns.length) || onExport);

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="border-border/60 bg-card ps-9 shadow-card"
            />
          </div>
          {dateFilterKeys?.length ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="sm:w-40" />
              <span className="text-xs text-muted-foreground">
                {locale === "ar" ? "إلى" : "to"}
              </span>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="sm:w-40" />
              {(fromDate || toDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); }}>
                  {locale === "ar" ? "مسح التاريخ" : "Clear dates"}
                </Button>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {showExcelExport && (
            <Button variant="outline" size="sm" onClick={handleExcelExport}>
              <Download className="h-4 w-4" />
              {locale === "ar" ? "Excel" : "Excel"}
            </Button>
          )}
          {onPrint && (
            <Button variant="outline" size="sm" onClick={onPrint}>
              <Printer className="h-4 w-4" />
              {locale === "ar" ? "طباعة" : "Print"}
            </Button>
          )}
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
                    {locale === "ar" ? "لا توجد نتائج" : "No results found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {locale === "ar"
            ? `الصفحة ${table.getState().pagination.pageIndex + 1} من ${table.getPageCount()}`
            : `Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            {locale === "ar" ? "السابق" : "Previous"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            {locale === "ar" ? "التالي" : "Next"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
