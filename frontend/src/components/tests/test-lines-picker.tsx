"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface TestCatalogItem {
  id: string;
  name: string;
  price: number;
  cost: number;
}

export interface TestLine {
  testId: string;
}

interface TestLinesPickerProps {
  locale: string;
  tests: TestCatalogItem[];
  lines: TestLine[];
  onChange: (lines: TestLine[]) => void;
  showLabCost?: boolean;
}

function TestSearchSelect({
  locale,
  tests,
  value,
  onChange,
  usedElsewhere,
}: {
  locale: string;
  tests: TestCatalogItem[];
  value: string;
  onChange: (testId: string) => void;
  usedElsewhere: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const selected = tests.find((t) => t.id === value);

  const options = useMemo(
    () => tests.filter((t) => t.id === value || !usedElsewhere.has(t.id)),
    [tests, usedElsewhere, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between font-normal"
          />
        }
      >
        {selected
          ? `${selected.name} — EGP ${selected.price.toLocaleString()}`
          : locale === "ar"
            ? "ابحث عن تحليل..."
            : "Search test..."}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={locale === "ar" ? "ابحث بالاسم..." : "Search by name..."}
          />
          <CommandList>
            <CommandEmpty>
              {locale === "ar" ? "لا توجد تحاليل" : "No tests found"}
            </CommandEmpty>
            <CommandGroup>
              {options.map((test) => (
                <CommandItem
                  key={test.id}
                  value={`${test.name} ${test.id}`}
                  onSelect={() => {
                    onChange(test.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === test.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {test.name} — EGP {test.price.toLocaleString()}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TestLinesPicker({
  locale,
  tests,
  lines,
  onChange,
  showLabCost = true,
}: TestLinesPickerProps) {
  const selectedTests = lines
    .map((l) => tests.find((t) => t.id === l.testId))
    .filter(Boolean) as TestCatalogItem[];

  const totalPrice = selectedTests.reduce((s, t) => s + (t.price || 0), 0);
  const totalCost = selectedTests.reduce((s, t) => s + (t.cost || 0), 0);

  const addLine = () => onChange([...lines, { testId: "" }]);

  const updateLine = (index: number, testId: string) => {
    const next = [...lines];
    next[index] = { testId };
    onChange(next);
  };

  const removeLine = (index: number) => onChange(lines.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{locale === "ar" ? "التحاليل" : "Tests"} *</Label>
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="mr-1 h-4 w-4" />
          {locale === "ar" ? "إضافة سطر" : "Add line"}
        </Button>
      </div>
      {lines.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {locale === "ar" ? "أضف تحليلاً واحداً على الأقل" : "Add at least one test"}
        </p>
      )}
      {lines.map((line, index) => {
        const usedElsewhere = new Set(
          lines
            .map((l, i) => (i !== index && l.testId ? l.testId : null))
            .filter(Boolean) as string[]
        );
        return (
          <div key={index} className="flex gap-2">
            <TestSearchSelect
              locale={locale}
              tests={tests}
              value={line.testId}
              onChange={(testId) => updateLine(index, testId)}
              usedElsewhere={usedElsewhere}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      })}
      {lines.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex justify-between font-medium">
            <span>{locale === "ar" ? "إجمالي السعر (للمريض)" : "Total price (customer)"}</span>
            <span>EGP {totalPrice.toLocaleString()}</span>
          </div>
          {showLabCost && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>{locale === "ar" ? "تكلفة المختبر" : "Lab cost (internal)"}</span>
                <span>EGP {totalCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>{locale === "ar" ? "الهامش" : "Margin"}</span>
                <span>EGP {(totalPrice - totalCost).toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function validTestIds(lines: TestLine[]): string[] {
  return lines.map((l) => l.testId).filter(Boolean);
}
