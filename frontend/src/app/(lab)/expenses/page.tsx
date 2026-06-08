"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { useDateRange } from "@/hooks/use-date-range";
import { api, getApiError } from "@/lib/api";
import { exportModuleExcel } from "@/lib/export";
import { toast } from "sonner";

interface Expense {
  id: string;
  expense_number: string;
  description: string;
  amount: number;
  expense_date: string;
  payment_method?: string;
  vendor?: string;
  reference?: string;
  notes?: string;
}

const emptyForm = {
  description: "", amount: "", expense_date: "", payment_method: "", vendor: "", reference: "", notes: "", category_name: "",
};

export default function ExpensesPage() {
  const locale = useAuthStore((s) => s.locale);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { dateFrom, dateTo, setDateFrom, setDateTo, queryParams, reset } = useDateRange();

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/expenses?page_size=100${queryParams}`)
      .then((res) => setExpenses(res.data.items || []))
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, [queryParams]);

  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      expense_date: form.expense_date || undefined,
      payment_method: form.payment_method || null,
      vendor: form.vendor || null,
      reference: form.reference || null,
      notes: form.notes || null,
      category_name: form.category_name || null,
    };
    try {
      if (editId) {
        await api.put(`/expenses/${editId}`, payload);
        toast.success(locale === "ar" ? "تم التحديث" : "Expense updated");
      } else {
        await api.post("/expenses", payload);
        toast.success(locale === "ar" ? "تم الإضافة" : "Expense created");
      }
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (exp: Expense) => {
    setEditId(exp.id);
    setForm({
      description: exp.description,
      amount: String(exp.amount),
      expense_date: exp.expense_date?.slice(0, 10) || "",
      payment_method: exp.payment_method || "",
      vendor: exp.vendor || "",
      reference: exp.reference || "",
      notes: exp.notes || "",
      category_name: "",
    });
    setOpen(true);
  };

  const deleteExpense = async (id: string) => {
    if (!confirm(locale === "ar" ? "حذف المصروف؟" : "Delete expense?")) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const columns: ColumnDef<Expense>[] = [
    { accessorKey: "expense_number", header: "#" },
    { accessorKey: "description", header: locale === "ar" ? "الوصف" : "Description" },
    { accessorKey: "vendor", header: locale === "ar" ? "المورد" : "Vendor" },
    { accessorKey: "amount", header: locale === "ar" ? "المبلغ" : "Amount", cell: ({ row }) => `EGP ${row.original.amount.toLocaleString()}` },
    { accessorKey: "expense_date", header: locale === "ar" ? "التاريخ" : "Date", cell: ({ row }) => new Date(row.original.expense_date).toLocaleDateString() },
    { accessorKey: "payment_method", header: locale === "ar" ? "طريقة الدفع" : "Payment" },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />{t(locale, "edit")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => deleteExpense(row.original.id)}>
              <Trash2 className="mr-2 h-4 w-4" />{t(locale, "delete")}
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
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "expenses")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "تتبع مصروفات المختبر" : "Track laboratory expenses by category and vendor"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />{t(locale, "create")}
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? (locale === "ar" ? "تعديل مصروف" : "Edit Expense") : (locale === "ar" ? "مصروف جديد" : "New Expense")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label>{locale === "ar" ? "الوصف" : "Description"} *</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "المبلغ" : "Amount (EGP)"} *</Label>
                  <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "التاريخ" : "Date"}</Label>
                  <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "المورد" : "Vendor"}</Label>
                  <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
                  <Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="cash, card, transfer" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الفئة" : "Category"}</Label>
                  <Input value={form.category_name} onChange={(e) => setForm({ ...form, category_name: e.target.value })} placeholder="utilities, rent, supplies" />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "المرجع" : "Reference"}</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? "..." : t(locale, "save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <DataTable
          columns={columns}
          data={expenses}
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
          onExport={() => exportModuleExcel("expenses", dateFrom, dateTo).catch((e) => toast.error(String(e)))}
        />
      )}
    </div>
  );
}
