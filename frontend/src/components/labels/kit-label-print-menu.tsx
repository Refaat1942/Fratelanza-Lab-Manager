"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  printOrderKitLabels,
  printResultKitLabel,
  type KitLabelLayout,
} from "@/lib/export";
import { toast } from "sonner";

type Props = {
  locale: string;
  orderId?: string;
  resultId?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
};

export function KitLabelPrintMenu({
  locale,
  orderId,
  resultId,
  size = "sm",
  variant = "outline",
}: Props) {
  const [printing, setPrinting] = useState(false);

  const print = async (scope: "one" | "all", layout: KitLabelLayout) => {
    setPrinting(true);
    try {
      if (scope === "all" && orderId) {
        await printOrderKitLabels(orderId, layout);
      } else if (resultId) {
        await printResultKitLabel(resultId, layout);
      } else if (orderId) {
        await printOrderKitLabels(orderId, layout);
      } else {
        throw new Error("No order or result to print");
      }
      toast.success(
        locale === "ar"
          ? "تم فتح نافذة الطباعة — اختر الطابعة الحرارية"
          : "Print dialog opened — select your thermal printer"
      );
    } catch {
      toast.error(locale === "ar" ? "فشل طباعة الملصق" : "Label print failed");
    } finally {
      setPrinting(false);
    }
  };

  const canPrintAll = Boolean(orderId);
  const canPrintOne = Boolean(resultId);

  if (!canPrintAll && !canPrintOne) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant={variant} size={size} disabled={printing}>
            <Printer className="me-1 h-3.5 w-3.5" />
            {printing
              ? locale === "ar"
                ? "جاري..."
                : "..."
              : locale === "ar"
                ? "ملصق"
                : "Label"}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          {locale === "ar" ? "ملصقات التحاليل 38×25 مم" : "Kit labels 38×25 mm"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canPrintOne && (
          <>
            <DropdownMenuItem onClick={() => print("one", "single")}>
              {locale === "ar" ? "ملصق واحد (صف واحد)" : "One label (single row)"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => print("one", "double")}>
              {locale === "ar" ? "ملصق واحد (صف مزدوج)" : "One label (double row roll)"}
            </DropdownMenuItem>
          </>
        )}
        {canPrintAll && (
          <>
            {canPrintOne && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => print("all", "single")}>
              {locale === "ar" ? "كل التحاليل — ملصق لكل تحليل" : "All tests — one label each"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => print("all", "double")}>
              {locale === "ar" ? "كل التحاليل — اثنان في الصف" : "All tests — two per row"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
