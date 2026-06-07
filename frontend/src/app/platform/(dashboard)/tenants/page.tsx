"use client";

import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Lock, Unlock, Ban, CheckCircle, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";

interface Tenant {
  id: string;
  code: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
}

interface Plan {
  id: string;
  name: string;
  tier: string;
  price_egp: number;
}

const emptyForm = {
  code: "", name: "", name_ar: "", email: "", phone: "",
  plan_id: "", admin_username: "", admin_password: "", admin_name: "",
};

export default function TenantsPage() {
  const locale = useAuthStore((s) => s.locale);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/platform/tenants"),
      api.get("/platform/plans"),
    ]).then(([tRes, pRes]) => {
      setTenants(tRes.data);
      setPlans(pRes.data);
    }).catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const action = async (tenantId: string, endpoint: string, label: string) => {
    try {
      await api.post(`/platform/tenants/${tenantId}/${endpoint}`);
      toast.success(label);
      load();
    } catch {
      toast.error(`Failed: ${label}`);
    }
  };

  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/platform/tenants", form);
      toast.success("Laboratory created");
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const columns: ColumnDef<Tenant>[] = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "name", header: locale === "ar" ? "الاسم" : "Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status;
        const variant = s === "active" ? "default" : s === "trial" ? "secondary" : "destructive";
        return <Badge variant={variant}>{s}</Badge>;
      },
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => action(row.original.id, "activate", "Activated")}>
              <CheckCircle className="mr-2 h-4 w-4" /> {t(locale, "activate")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => action(row.original.id, "suspend", "Suspended")}>
              <Ban className="mr-2 h-4 w-4" /> {t(locale, "suspend")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => action(row.original.id, "renew", "Renewed")}>
              <RefreshCw className="mr-2 h-4 w-4" /> {t(locale, "renew")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => action(row.original.id, "lock", "Locked")}>
              <Lock className="mr-2 h-4 w-4" /> {t(locale, "lock")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => action(row.original.id, "unlock", "Unlocked")}>
              <Unlock className="mr-2 h-4 w-4" /> {t(locale, "unlock")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={async () => {
                if (confirm("Delete this laboratory?")) {
                  await api.delete(`/platform/tenants/${row.original.id}`);
                  toast.success("Deleted");
                  load();
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> {t(locale, "delete")}
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
          <h1 className="text-3xl font-bold">{t(locale, "tenants")}</h1>
          <p className="text-muted-foreground">
            {locale === "ar" ? "إنشاء وإدارة المختبرات والاشتراكات" : "Create, lock, suspend, renew laboratories"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            {t(locale, "create")}
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{locale === "ar" ? "مختبر جديد" : "New Laboratory"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={createTenant} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "ar" ? "الباقة" : "Plan"} *</Label>
                  <Select value={form.plan_id} onValueChange={(v) => v && setForm({ ...form, plan_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — EGP {p.price_egp}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Name (EN) *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Name (AR)</Label>
                <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Admin Name *</Label>
                <Input value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Admin Username *</Label>
                <Input value={form.admin_username} onChange={(e) => setForm({ ...form, admin_username: e.target.value })} required minLength={2} />
              </div>
              <div className="space-y-2">
                <Label>Admin Password *</Label>
                <Input type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} required minLength={8} />
              </div>
              <Button type="submit" className="w-full">{t(locale, "create")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DataTable columns={columns} data={tenants} searchPlaceholder={t(locale, "search")} />
      )}
    </div>
  );
}
