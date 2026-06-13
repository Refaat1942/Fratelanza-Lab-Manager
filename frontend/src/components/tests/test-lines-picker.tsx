"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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
      {lines.map((line, index) => (
        <div key={index} className="flex gap-2">
          <Select value={line.testId} onValueChange={(v) => v && updateLine(index, v)}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={locale === "ar" ? "اختر تحليلاً" : "Select test"} />
            </SelectTrigger>
            <SelectContent>
              {tests.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} — {locale === "ar" ? "سعر" : "EGP"} {t.price.toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
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
