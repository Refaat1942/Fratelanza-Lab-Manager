"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface ModuleCatalogItem {
  key: string;
  label_en: string;
  label_ar: string;
  locked?: boolean;
}

interface ModuleTogglesProps {
  locale: string;
  catalog: ModuleCatalogItem[];
  states: Record<string, boolean>;
  onChange: (key: string, enabled: boolean) => void;
}

export function ModuleToggles({ locale, catalog, states, onChange }: ModuleTogglesProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">
        {locale === "ar" ? "الميزات الظاهرة للمختبر" : "Visible features for this lab"}
      </Label>
      <p className="text-xs text-muted-foreground">
        {locale === "ar"
          ? "فعّل أو أخفِ أقسام التطبيق لهذا المختبر. لوحة التحكم والإعدادات دائماً مفعّلة."
          : "Turn sections on or off for this laboratory. Dashboard and Settings are always on."}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {catalog.map((item) => {
          const locked = item.locked || item.key === "dashboard" || item.key === "settings";
          const label = locale === "ar" ? item.label_ar : item.label_en;
          return (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
            >
              <span className="text-sm">{label}</span>
              <Switch
                checked={states[item.key] ?? true}
                disabled={locked}
                onCheckedChange={(v) => onChange(item.key, v)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
