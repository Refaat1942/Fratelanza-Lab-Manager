"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Locale } from "@/lib/i18n";

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  locale: Locale;
  className?: string;
}

export function DateRangeFilter({ value, onChange, locale, className }: DateRangeFilterProps) {
  const hasValue = Boolean(value.from || value.to);

  return (
    <div className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t(locale, "dateFrom")}</Label>
          <Input
            type="date"
            value={value.from}
            onChange={(event) => onChange({ ...value, from: event.target.value })}
            className="h-8 min-w-36 bg-card"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t(locale, "dateTo")}</Label>
          <Input
            type="date"
            value={value.to}
            onChange={(event) => onChange({ ...value, to: event.target.value })}
            className="h-8 min-w-36 bg-card"
          />
        </div>
        {hasValue && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ from: "", to: "" })}
          >
            {t(locale, "clear")}
          </Button>
        )}
      </div>
    </div>
  );
}
