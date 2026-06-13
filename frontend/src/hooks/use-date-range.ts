"use client";

import { useMemo, useState } from "react";

/** Local calendar date (YYYY-MM-DD) from the user's PC clock. */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatLocalDate(d);
}

function defaultRange(defaultFromDays: number) {
  return {
    from: daysAgo(defaultFromDays),
    to: formatLocalDate(new Date()),
  };
}

/**
 * @param defaultFromDays Days before today for the start date. Use 0 for "today only" (dashboard).
 */
export function useDateRange(defaultFromDays = 30) {
  const [dateFrom, setDateFrom] = useState(() => defaultRange(defaultFromDays).from);
  const [dateTo, setDateTo] = useState(() => defaultRange(defaultFromDays).to);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    const s = p.toString();
    return s ? `&${s}` : "";
  }, [dateFrom, dateTo]);

  const reset = () => {
    const { from, to } = defaultRange(defaultFromDays);
    setDateFrom(from);
    setDateTo(to);
  };

  return { dateFrom, dateTo, setDateFrom, setDateTo, queryParams, reset };
}
