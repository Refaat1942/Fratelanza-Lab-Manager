"use client";

import { Calendar, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onReset?: () => void;
  className?: string;
}

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onReset,
  className,
}: DateRangeFilterProps) {
  const locale = useAuthStore((s) => s.locale);

  return (
    <div className={`flex flex-wrap items-end gap-3 ${className ?? ""}`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{locale === "ar" ? "الفترة" : "Period"}</span>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{locale === "ar" ? "من" : "From"}</Label>
        <Input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="h-9 w-[140px]" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{locale === "ar" ? "إلى" : "To"}</Label>
        <Input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className="h-9 w-[140px]" />
      </div>
      {onReset && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset} className="h-9">
          <RotateCcw className="me-1 h-4 w-4" />
          {locale === "ar" ? "إعادة" : "Reset"}
        </Button>
      )}
    </div>
  );
}
