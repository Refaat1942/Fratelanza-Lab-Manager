"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2, Download, Upload } from "lucide-react";
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
import { api, getApiError } from "@/lib/api";
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
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/inventory?page_size=100")
      .then((res) => setItems(res.data.items || []))
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
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
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="me-2 h-4 w-4" />{t(locale, "edit")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => deleteItem(row.original.id)}>
              <Trash2 className="me-2 h-4 w-4" />{t(locale, "delete")}
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
            <Download className="me-2 h-4 w-4" />
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
            {importing ? "..." : <><Upload className="me-2 h-4 w-4" />{locale === "ar" ? "استيراد Excel" : "Import Excel"}</>}
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyItem); } }}>
            <DialogTrigger render={<Button className="shadow-md" />}>
              <Plus className="me-2 h-4 w-4" />
              {t(locale, "create")}
            </DialogTrigger>
            <DialogContent className="max-w-lg">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "الاسم (إنجليزي)" : "Name (EN)"} *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "الاسم (عربي)" : "Name (AR)"} *</Label>
                    <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} required />
                  </div>
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
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          searchPlaceholder={t(locale, "search")}
          locale={locale}
          exportFileName="inventory.xlsx"
          exportSheetName={locale === "ar" ? "المخزون" : "Inventory"}
          dateFilterKeys={["created_at"]}
        />
      )}
    </div>
  );
}
