"use client";

import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  name_ar: string;
  tier: string;
  billing_cycle: string;
  price_egp: number;
  max_branches: number;
  max_users: number;
  is_active: boolean;
}

const emptyPlan = {
  name: "", name_ar: "", tier: "starter", billing_cycle: "monthly",
  price_egp: 0, max_branches: 1, max_users: 5,
};

export default function PlansPage() {
  const { locale } = useLocale("platform");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(emptyPlan);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    api.get("/platform/plans?include_inactive=true").then((res) => setPlans(res.data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const savePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.patch(`/platform/plans/${editId}`, form);
        toast.success("Plan updated");
      } else {
        await api.post("/platform/plans", { ...form, features: {} });
        toast.success("Plan created");
      }
      setOpen(false);
      setEditId(null);
      setForm(emptyPlan);
      load();
    } catch {
      toast.error("Failed to save plan");
    }
  };

  const openEdit = (plan: Plan) => {
    setEditId(plan.id);
    setForm({
      name: plan.name, name_ar: plan.name_ar, tier: plan.tier,
      billing_cycle: plan.billing_cycle, price_egp: plan.price_egp,
      max_branches: plan.max_branches, max_users: plan.max_users,
    });
    setOpen(true);
  };

  const columns: ColumnDef<Plan>[] = [
    { accessorKey: "name", header: locale === "ar" ? "الاسم" : "Name" },
    {
      accessorKey: "tier",
      header: "Tier",
      cell: ({ row }) => <Badge variant="outline">{row.original.tier}</Badge>,
    },
    { accessorKey: "billing_cycle", header: "Billing" },
    {
      accessorKey: "price_egp",
      header: "Price (EGP)",
      cell: ({ row }) => row.original.price_egp.toLocaleString(),
    },
    { accessorKey: "max_branches", header: "Branches" },
    { accessorKey: "max_users", header: "Users" },
    {
      accessorKey: "is_active",
      header: "Active",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (confirm("Delete this plan?")) {
                await api.delete(`/platform/plans/${row.original.id}`);
                toast.success("Deleted");
                load();
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t(locale, "plans")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "باقات Starter و Professional و Enterprise" : "Starter, Professional, Enterprise plans"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(emptyPlan); } }}>
          <DialogTrigger render={<Button onClick={() => { setEditId(null); setForm(emptyPlan); }} />}>
            <Plus className="mr-2 h-4 w-4" />
            {t(locale, "create")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Plan" : "New Plan"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={savePlan} className="space-y-4">
              <div className="space-y-2">
                <Label>Name (EN)</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Name (AR)</Label>
                <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tier</Label>
                  <Select value={form.tier} onValueChange={(v) => v && setForm({ ...form, tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Billing</Label>
                  <Select value={form.billing_cycle} onValueChange={(v) => v && setForm({ ...form, billing_cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Price (EGP)</Label>
                  <Input type="number" value={form.price_egp} onChange={(e) => setForm({ ...form, price_egp: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Max Branches</Label>
                  <Input type="number" value={form.max_branches} onChange={(e) => setForm({ ...form, max_branches: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Max Users</Label>
                  <Input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: +e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full">{t(locale, "save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={plans} searchPlaceholder={t(locale, "search")} />
    </div>
  );
}
