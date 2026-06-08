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
import { DateRangeFilter, type DateRange } from "@/components/filters/date-range-filter";
import { exportRowsToExcel } from "@/lib/table-export";
import { t, type Locale } from "@/lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Printer, Search } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  onExport?: (format: "excel" | "pdf" | "csv") => void;
  onPrint?: () => void;
  exportFileName?: string;
  dateAccessor?: keyof TData | string | ((row: TData) => string | Date | null | undefined);
  locale?: Locale;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search...",
  onExport,
  onPrint,
  exportFileName,
  dateAccessor,
  locale = "en",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });

  const filteredData = useMemo(() => {
    if (!dateAccessor || (!dateRange.from && !dateRange.to)) return data;

    const from = dateRange.from ? new Date(`${dateRange.from}T00:00:00`) : null;
    const to = dateRange.to ? new Date(`${dateRange.to}T23:59:59`) : null;

    return data.filter((row) => {
      const rawDate =
        typeof dateAccessor === "function"
          ? dateAccessor(row)
          : (row as Record<string, unknown>)[String(dateAccessor)];

      if (!rawDate) return false;

      const date = rawDate instanceof Date ? rawDate : new Date(String(rawDate));
      if (Number.isNaN(date.getTime())) return false;
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  }, [data, dateAccessor, dateRange]);

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

  const handleExport = () => {
    if (onExport) {
      onExport("excel");
      return;
    }

    if (!exportFileName) return;
    exportRowsToExcel(filteredData, columns, exportFileName);
  };

  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {dateAccessor && (
        <DateRangeFilter
          value={dateRange}
          onChange={setDateRange}
          locale={locale}
          className="rounded-xl border border-border/60 bg-card p-3 shadow-card"
        />
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="ps-9 bg-card shadow-card border-border/60"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(onExport || exportFileName) && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t(locale, "exportExcel")}
            </Button>
          )}
          {onPrint && (
            <Button variant="outline" size="sm" onClick={onPrint}>
              <Printer className="h-4 w-4" />
              {t(locale, "print")}
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
                    {t(locale, "noResults")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t(locale, "page")} {Math.min(table.getState().pagination.pageIndex + 1, pageCount)} {t(locale, "of")} {pageCount}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            {t(locale, "previous")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            {t(locale, "next")}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
