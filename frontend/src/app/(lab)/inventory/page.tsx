"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2, Download, Upload, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { useDateRange } from "@/hooks/use-date-range";
import { api, getApiError } from "@/lib/api";
import { exportModuleExcel } from "@/lib/export";
import { downloadApiFile } from "@/lib/download";
import { toast } from "sonner";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  name_ar: string;
  category: string;
  unit: string;
  unit_cost: number;
  total_quantity: number;
  reorder_level: number;
  is_active: boolean;
}

const CATEGORIES = [
  "reagent", "kit", "tube", "glove", "syringe", "control", "calibrator", "consumable", "other",
];

const emptyItem = {
  sku: "", name: "", name_ar: "", category: "reagent", unit: "piece", unit_cost: "", reorder_level: "10",
};

export default function InventoryPage() {
  const locale = useAuthStore((s) => s.locale);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyItem);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission("inventory.manage");
  // Stock movement dialog: direction "in" adds a batch, "out" consumes stock (FEFO on the server).
  const [moveItem, setMoveItem] = useState<InventoryItem | null>(null);
  const [move, setMove] = useState({ direction: "in" as "in" | "out", quantity: "", unit_cost: "", reason: "consumption", batch_number: "", notes: "" });

  const openMove = (item: InventoryItem, direction: "in" | "out") => {
    setMove({ direction, quantity: "", unit_cost: String(item.unit_cost ?? ""), reason: "consumption", batch_number: "", notes: "" });
    setMoveItem(item);
  };

  const saveMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveItem) return;
    const qty = parseFloat(move.quantity);
    if (!qty || qty <= 0) return;
    setSaving(true);
    try {
      await api.post(`/inventory/${moveItem.id}/stock`, {
        quantity: move.direction === "in" ? qty : -qty,
        reason: move.direction === "in" ? "purchase" : move.reason,
        unit_cost: move.direction === "in" && move.unit_cost !== "" ? parseFloat(move.unit_cost) : null,
        batch_number: move.batch_number || null,
        notes: move.notes || null,
      });
      toast.success(locale === "ar" ? "تم تسجيل حركة المخزون" : "Stock updated");
      setMoveItem(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const { dateFrom, dateTo, setDateFrom, setDateTo, queryParams, reset } = useDateRange();

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/inventory?page_size=1000${queryParams}`)
      .then((res) => setItems(res.data.items || []))
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, [queryParams]);

  useEffect(() => { load(); }, [load]);

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      name_ar: form.name,
      unit_cost: parseFloat(form.unit_cost) || 0,
      reorder_level: parseFloat(form.reorder_level) || 0,
    };
    try {
      if (editId) {
        await api.put(`/inventory/${editId}`, payload);
        toast.success(locale === "ar" ? "تم التحديث" : "Item updated");
      } else {
        await api.post("/inventory", payload);
        toast.success(locale === "ar" ? "تم إضافة الصنف" : "Item created");
      }
      setOpen(false);
      setEditId(null);
      setForm(emptyItem);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (item: InventoryItem) => {
    try {
      const { data } = await api.get(`/inventory/${item.id}`);
      setEditId(item.id);
      setForm({
        sku: data.sku,
        name: data.name,
        name_ar: data.name_ar,
        category: data.category,
        unit: data.unit,
        unit_cost: String(data.unit_cost),
        reorder_level: String(data.reorder_level),
      });
      setOpen(true);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm(locale === "ar" ? "حذف الصنف؟" : "Delete item?")) return;
    try {
      await api.delete(`/inventory/${id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const importExcel = async (file: File) => {
    setImporting(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const { data } = await api.post("/inventory/import", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(
        locale === "ar"
          ? `تم استيراد ${data.created || 0} صنف`
          : `Imported ${data.created || 0} items`
      );
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setImporting(false);
    }
  };

  const columns: ColumnDef<InventoryItem>[] = [
    { accessorKey: "sku", header: "SKU" },
    {
      accessorKey: "name",
      header: locale === "ar" ? "الاسم" : "Name",
      cell: ({ row }) => locale === "ar" ? row.original.name_ar : row.original.name,
    },
    {
      accessorKey: "category",
      header: locale === "ar" ? "الفئة" : "Category",
      cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge>,
    },
    {
      accessorKey: "total_quantity",
      header: locale === "ar" ? "الكمية" : "Qty",
      cell: ({ row }) => {
        const low = row.original.total_quantity <= row.original.reorder_level;
        return <span className={low ? "text-amber-600 font-medium" : ""}>{row.original.total_quantity}</span>;
      },
    },
    {
      accessorKey: "unit_cost",
      header: locale === "ar" ? "تكلفة الوحدة" : "Unit Cost",
      cell: ({ row }) => `EGP ${row.original.unit_cost}`,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManage && (
              <>
                <DropdownMenuItem onClick={() => openMove(row.original, "in")}>
                  <ArrowDownToLine className="mr-2 h-4 w-4" />{locale === "ar" ? "إضافة مخزون (وارد)" : "Stock in"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openMove(row.original, "out")}>
                  <ArrowUpFromLine className="mr-2 h-4 w-4" />{locale === "ar" ? "صرف مخزون (منصرف)" : "Stock out"}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />{t(locale, "edit")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => deleteItem(row.original.id)}>
              <Trash2 className="mr-2 h-4 w-4" />{t(locale, "delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "inventory")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "مستلزمات المختبر مع استيراد Excel" : "Lab consumables with Excel import"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadApiFile("/inventory/import/template", "inventory_import_template.xlsx")}>
            <Download className="mr-2 h-4 w-4" />
            {locale === "ar" ? "تحميل القالب" : "Download Template"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importExcel(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? "..." : <><Upload className="mr-2 h-4 w-4" />{locale === "ar" ? "استيراد Excel" : "Import Excel"}</>}
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyItem); } }}>
            <DialogTrigger render={<Button className="shadow-md" />}>
              <Plus className="mr-2 h-4 w-4" />
              {t(locale, "create")}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? (locale === "ar" ? "تعديل صنف" : "Edit Item") : (locale === "ar" ? "صنف جديد" : "New Item")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={saveItem} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SKU *</Label>
                    <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required disabled={!!editId} />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "الفئة" : "Category"}</Label>
                    <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الاسم" : "Name"} *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, name_ar: e.target.value })} required />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "الوحدة" : "Unit"}</Label>
                    <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "التكلفة" : "Unit Cost"}</Label>
                    <Input type="number" min="0" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "حد إعادة الطلب" : "Reorder Level"}</Label>
                    <Input type="number" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Saving..." : t(locale, "save")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={!!moveItem} onOpenChange={(o) => !o && setMoveItem(null)}>
        <DialogContent className="sm:max-w-md" dir={locale === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {move.direction === "in"
                ? (locale === "ar" ? "إضافة مخزون" : "Stock in")
                : (locale === "ar" ? "صرف مخزون" : "Stock out")}
              {moveItem && ` — ${locale === "ar" ? moveItem.name_ar || moveItem.name : moveItem.name}`}
            </DialogTitle>
          </DialogHeader>
          {moveItem && (
            <form onSubmit={saveMove} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {locale === "ar" ? "الرصيد الحالي" : "Current stock"}: <span className="font-semibold text-foreground">{moveItem.total_quantity} {moveItem.unit}</span>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mv-qty">{locale === "ar" ? "الكمية" : "Quantity"} *</Label>
                  <Input
                    id="mv-qty"
                    type="number"
                    min="0.01"
                    step="any"
                    max={move.direction === "out" ? moveItem.total_quantity : undefined}
                    value={move.quantity}
                    onChange={(e) => setMove({ ...move, quantity: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                {move.direction === "in" ? (
                  <div className="space-y-2">
                    <Label htmlFor="mv-cost">{locale === "ar" ? "سعر الوحدة" : "Unit cost"}</Label>
                    <Input id="mv-cost" type="number" min="0" step="0.01" value={move.unit_cost} onChange={(e) => setMove({ ...move, unit_cost: e.target.value })} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "السبب" : "Reason"}</Label>
                    <Select value={move.reason} onValueChange={(v) => v && setMove({ ...move, reason: v })}
                      items={[
                        { value: "consumption", label: locale === "ar" ? "استهلاك" : "Used" },
                        { value: "expired", label: locale === "ar" ? "منتهي الصلاحية" : "Expired" },
                        { value: "return", label: locale === "ar" ? "مرتجع للمورد" : "Returned" },
                        { value: "adjustment", label: locale === "ar" ? "تسوية جرد" : "Count adjustment" },
                      ]}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consumption">{locale === "ar" ? "استهلاك" : "Used"}</SelectItem>
                        <SelectItem value="expired">{locale === "ar" ? "منتهي الصلاحية" : "Expired"}</SelectItem>
                        <SelectItem value="return">{locale === "ar" ? "مرتجع للمورد" : "Returned"}</SelectItem>
                        <SelectItem value="adjustment">{locale === "ar" ? "تسوية جرد" : "Count adjustment"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {move.direction === "in" && (
                <div className="space-y-2">
                  <Label htmlFor="mv-batch">{locale === "ar" ? "رقم التشغيلة (اختياري)" : "Batch number (optional)"}</Label>
                  <Input id="mv-batch" value={move.batch_number} onChange={(e) => setMove({ ...move, batch_number: e.target.value })} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="mv-notes">{locale === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Input id="mv-notes" value={move.notes} onChange={(e) => setMove({ ...move, notes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (locale === "ar" ? "جارٍ الحفظ…" : "Saving…") : t(locale, "save")}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          searchPlaceholder={t(locale, "search")}
          filterSlot={
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onReset={reset}
            />
          }
          onExport={() => exportModuleExcel("inventory", dateFrom, dateTo).catch((e) => toast.error(String(e)))}
        />
      )}
    </div>
  );
}
