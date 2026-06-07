"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_name: string;
  status: string;
  total_amount: number;
  order_date: string;
}

interface Supplier { id: string; name: string; }

export default function PurchasingPage() {
  const locale = useAuthStore((s) => s.locale);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/purchasing/orders?page_size=100"),
      api.get("/suppliers?page_size=100"),
    ])
      .then(([ord, sup]) => {
        setOrders(ord.data.items || []);
        setSuppliers(sup.data.items || []);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/purchasing/orders", { supplier_id: supplierId, notes: notes || null });
      toast.success(locale === "ar" ? "تم إنشاء أمر الشراء" : "Purchase order created");
      setOpen(false);
      setSupplierId("");
      setNotes("");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<PurchaseOrder>[] = [
    { accessorKey: "po_number", header: "PO #" },
    { accessorKey: "supplier_name", header: locale === "ar" ? "المورد" : "Supplier" },
    {
      accessorKey: "status",
      header: locale === "ar" ? "الحالة" : "Status",
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    { accessorKey: "total_amount", header: locale === "ar" ? "المبلغ" : "Amount", cell: ({ row }) => `EGP ${row.original.total_amount.toLocaleString()}` },
    { accessorKey: "order_date", header: locale === "ar" ? "التاريخ" : "Date", cell: ({ row }) => new Date(row.original.order_date).toLocaleDateString() },
    {
      id: "del",
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={async () => {
          if (!confirm(locale === "ar" ? "حذف أمر الشراء؟" : "Delete PO?")) return;
          try {
            await api.delete(`/purchasing/orders/${row.original.id}`);
            toast.success("Deleted");
            load();
          } catch (err) { toast.error(getApiError(err)); }
        }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "purchasing")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "أوامر الشراء من الموردين" : "Purchase orders from suppliers"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />{t(locale, "create")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{locale === "ar" ? "أمر شراء جديد" : "New Purchase Order"}</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label>{locale === "ar" ? "المورد" : "Supplier"}</Label>
                <Select value={supplierId} onValueChange={(v) => v && setSupplierId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={saving || !supplierId}>{t(locale, "save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <DataTable columns={columns} data={orders} searchPlaceholder={t(locale, "search")} />
      )}
    </div>
  );
}
