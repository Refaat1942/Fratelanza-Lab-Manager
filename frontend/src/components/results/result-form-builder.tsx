"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface ResultField {
  parameter_name: string;
  parameter_name_ar?: string;
  unit?: string;
  field_type: string;
  sort_order: number;
  value?: string;
}

interface ResultFormBuilderProps {
  fields: ResultField[];
  onChange: (fields: ResultField[]) => void;
  locale: "ar" | "en";
  mode?: "design" | "entry";
}

export function ResultFormBuilder({ fields, onChange, locale, mode = "entry" }: ResultFormBuilderProps) {
  const addField = () => {
    onChange([
      ...fields,
      { parameter_name: "", parameter_name_ar: "", unit: "", field_type: "numeric", sort_order: fields.length, value: "" },
    ]);
  };

  const updateField = (index: number, patch: Partial<ResultField>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <div key={index} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
            {mode === "design" && (
              <Button type="button" variant="ghost" size="sm" className="ms-auto text-destructive" onClick={() => removeField(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {mode === "design" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{locale === "ar" ? "اسم الحقل (EN)" : "Field Name (EN)"}</Label>
                <Input value={field.parameter_name} onChange={(e) => updateField(index, { parameter_name: e.target.value })} placeholder="e.g. Glucose" />
              </div>
              <div className="space-y-1">
                <Label>{locale === "ar" ? "اسم الحقل (AR)" : "Field Name (AR)"}</Label>
                <Input value={field.parameter_name_ar || ""} onChange={(e) => updateField(index, { parameter_name_ar: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>{locale === "ar" ? "الوحدة" : "Unit"}</Label>
                <Input value={field.unit || ""} onChange={(e) => updateField(index, { unit: e.target.value })} placeholder="mg/dL" />
              </div>
              <div className="space-y-1">
                <Label>{locale === "ar" ? "نوع الحقل" : "Field Type"}</Label>
                <Select value={field.field_type} onValueChange={(v) => v && updateField(index, { field_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="numeric">Numeric</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="select">Select</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>
                {locale === "ar" ? field.parameter_name_ar || field.parameter_name : field.parameter_name}
                {field.unit ? ` (${field.unit})` : ""}
              </Label>
              <Input
                value={field.value || ""}
                onChange={(e) => updateField(index, { value: e.target.value })}
                placeholder={locale === "ar" ? "أدخل القيمة" : "Enter value"}
              />
            </div>
          )}
        </div>
      ))}

      {mode === "design" && (
        <Button type="button" variant="outline" className="w-full" onClick={addField}>
          <Plus className="me-2 h-4 w-4" />
          {locale === "ar" ? "إضافة حقل" : "Add Field"}
        </Button>
      )}
    </div>
  );
}
