"use client";

import { useState } from "react";
import { Pencil, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  type KitLabelOverrides,
} from "@/lib/export";
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";

type Props = {
  locale: string;
  orderId?: string;
  resultId?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
};

type LabelForm = {
  lab_name: string;
  patient_name: string;
  test_name: string;
  collection_date: string;
  barcode: string;
  width_mm: string;
  height_mm: string;
};

const emptyForm: LabelForm = {
  lab_name: "",
  patient_name: "",
  test_name: "",
  collection_date: "",
  barcode: "",
  width_mm: "38",
  height_mm: "25",
};

export function KitLabelPrintMenu({
  locale,
  orderId,
  resultId,
  size = "sm",
  variant = "outline",
}: Props) {
  const [printing, setPrinting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLayout, setEditLayout] = useState<KitLabelLayout>("single");
  const [editScope, setEditScope] = useState<"one" | "all">("one");
  const [form, setForm] = useState<LabelForm>(emptyForm);

  const overridesFromForm = (): KitLabelOverrides => ({
    lab_name: form.lab_name || undefined,
    patient_name: form.patient_name || undefined,
    test_name: form.test_name || undefined,
    collection_date: form.collection_date || undefined,
    barcode: form.barcode || undefined,
    width_mm: parseFloat(form.width_mm) || 38,
    height_mm: parseFloat(form.height_mm) || 25,
  });

  const print = async (scope: "one" | "all", layout: KitLabelLayout, overrides?: KitLabelOverrides) => {
    setPrinting(true);
    try {
      if (scope === "all" && orderId) {
        await printOrderKitLabels(orderId, layout, overrides);
      } else if (resultId) {
        await printResultKitLabel(resultId, layout, overrides);
      } else if (orderId) {
        await printOrderKitLabels(orderId, layout, overrides);
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

  const openEditor = async (scope: "one" | "all", layout: KitLabelLayout) => {
    if (!resultId) {
      await print(scope, layout, overridesFromForm());
      return;
    }
    setEditScope(scope);
    setEditLayout(layout);
    try {
      const { data } = await api.get(`/results/${resultId}/label-preview`);
      setForm({
        lab_name: data.lab_name || "",
        patient_name: data.patient_name || "",
        test_name: data.test_name || "",
        collection_date: data.collection_date || "",
        barcode: data.barcode || "",
        width_mm: form.width_mm,
        height_mm: form.height_mm,
      });
      setEditOpen(true);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const canPrintAll = Boolean(orderId);
  const canPrintOne = Boolean(resultId);

  if (!canPrintAll && !canPrintOne) return null;

  return (
    <>
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
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            {locale === "ar" ? "ملصقات التحاليل" : "Kit labels"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canPrintOne && (
            <>
              <DropdownMenuItem onClick={() => openEditor("one", "single")}>
                <Pencil className="me-2 h-3.5 w-3.5" />
                {locale === "ar" ? "تعديل وطباعة — ملصق واحد" : "Edit & print — one label"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => print("one", "single")}>
                {locale === "ar" ? "طباعة سريعة — صف واحد" : "Quick print — single row"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => print("one", "double")}>
                {locale === "ar" ? "طباعة سريعة — صف مزدوج" : "Quick print — double row"}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === "ar" ? "تعديل ملصق التحليل" : "Edit kit label"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{locale === "ar" ? "عرض (مم)" : "Width (mm)"}</Label>
                <Input type="number" min={20} max={100} value={form.width_mm} onChange={(e) => setForm({ ...form, width_mm: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "ارتفاع (مم)" : "Height (mm)"}</Label>
                <Input type="number" min={15} max={80} value={form.height_mm} onChange={(e) => setForm({ ...form, height_mm: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "اسم المختبر" : "Lab name"}</Label>
              <Input value={form.lab_name} onChange={(e) => setForm({ ...form, lab_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "اسم المريض" : "Patient name"}</Label>
              <Input value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "اسم التحليل" : "Test name"}</Label>
              <Input value={form.test_name} onChange={(e) => setForm({ ...form, test_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "تاريخ السحب" : "Collection date"}</Label>
              <Input value={form.collection_date} onChange={(e) => setForm({ ...form, collection_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "الباركود" : "Barcode"}</Label>
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </div>
            <Button
              className="w-full"
              disabled={printing}
              onClick={async () => {
                setEditOpen(false);
                await print(editScope, editLayout, overridesFromForm());
              }}
            >
              {locale === "ar" ? "طباعة" : "Print"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
