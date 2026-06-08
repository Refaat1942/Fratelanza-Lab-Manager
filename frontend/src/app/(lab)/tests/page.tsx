"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";

interface Test {
  id: string;
  code: string;
  name: string;
  name_ar: string;
  price: number;
  cost: number;
  turnaround_hours: number;
  is_active: boolean;
  category_id: string;
}

interface Category {
  id: string;
  code: string;
  name: string;
  name_ar: string;
}

const emptyTest = {
  category_id: "", name: "", name_ar: "", price: "", cost: "", turnaround_hours: "24",
};

export default function TestsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [tests, setTests] = useState<Test[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTest);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get("/tests"), api.get("/tests/categories")])
      .then(([testsRes, catRes]) => {
        setTests(testsRes.data.items || []);
        setCategories(catRes.data || []);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      category_id: form.category_id,
      name: form.name,
      name_ar: form.name_ar,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      turnaround_hours: parseInt(form.turnaround_hours, 10) || 24,
    };
    try {
      if (editId) {
        await api.put(`/tests/${editId}`, payload);
        toast.success(locale === "ar" ? "تم تحديث التحليل" : "Test updated");
      } else {
        await api.post("/tests", payload);
        toast.success(locale === "ar" ? "تم إضافة التحليل" : "Test created");
      }
      setOpen(false);
      setEditId(null);
      setForm(emptyTest);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (test: Test) => {
    setEditId(test.id);
    setForm({
      category_id: test.category_id,
      name: test.name,
      name_ar: test.name_ar,
      price: String(test.price),
      cost: String(test.cost),
      turnaround_hours: String(test.turnaround_hours),
    });
    setOpen(true);
  };

  const deleteTest = async (id: string) => {
    if (!confirm(locale === "ar" ? "حذف التحليل؟" : "Delete test?")) return;
    try {
      await api.delete(`/tests/${id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const columns: ColumnDef<Test>[] = [
    { accessorKey: "code", header: "Code" },
    {
      accessorKey: "name",
      header: locale === "ar" ? "الاسم" : "Name",
      cell: ({ row }) => locale === "ar" ? row.original.name_ar : row.original.name,
    },
    {
      accessorKey: "price",
      header: locale === "ar" ? "السعر" : "Price (EGP)",
      cell: ({ row }) => row.original.price.toLocaleString(),
    },
    {
      accessorKey: "cost",
      header: locale === "ar" ? "التكلفة" : "Cost (EGP)",
      cell: ({ row }) => row.original.cost.toLocaleString(),
    },
    { accessorKey: "turnaround_hours", header: "TAT (hrs)" },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
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
            <DropdownMenuItem className="text-destructive" onClick={() => deleteTest(row.original.id)}>
              <Trash2 className="me-2 h-4 w-4" />{t(locale, "delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "tests")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "كتالوج التحاليل بالعربية والإنجليزية" : "Test catalog with Arabic/English names and prices"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyTest); } }}>
          <DialogTrigger render={<Button className="shadow-md" />}>
            <Plus className="me-2 h-4 w-4" />
            {t(locale, "create")}
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? (locale === "ar" ? "تعديل تحليل" : "Edit Test") : (locale === "ar" ? "تحليل جديد" : "New Test")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveTest} className="space-y-4">
              <div className="space-y-2">
                <Label>{locale === "ar" ? "الفئة" : "Category"} *</Label>
                <Select value={form.category_id} onValueChange={(v) => v && setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {locale === "ar" ? c.name_ar : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <Label>{locale === "ar" ? "السعر" : "Price"}</Label>
                  <Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "التكلفة" : "Cost"}</Label>
                  <Input type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>TAT (hrs)</Label>
                  <Input type="number" min="1" value={form.turnaround_hours} onChange={(e) => setForm({ ...form, turnaround_hours: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving || !form.category_id}>
                {saving ? "Saving..." : t(locale, "save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={tests}
          searchPlaceholder={t(locale, "search")}
          locale={locale}
          exportFileName="tests.xlsx"
          exportSheetName={locale === "ar" ? "التحاليل" : "Tests"}
          dateFilterKeys={["created_at"]}
        />
      )}
    </div>
  );
}
