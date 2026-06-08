"use client";

import { useMemo, useState } from "react";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

export function useDateRange(defaultFromDays = 30) {
  const defaults = useMemo(
    () => ({ from: daysAgo(defaultFromDays), to: formatDate(new Date()) }),
    [defaultFromDays]
  );
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    const s = p.toString();
    return s ? `&${s}` : "";
  }, [dateFrom, dateTo]);

  const reset = () => {
    setDateFrom(defaults.from);
    setDateTo(defaults.to);
  };

  return { dateFrom, dateTo, setDateFrom, setDateTo, queryParams, reset };
}
