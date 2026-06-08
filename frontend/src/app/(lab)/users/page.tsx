"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import { useAuthStore } from "@/stores/auth-store";
import { t } from "@/lib/i18n";
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";

interface UserRow {
  id: string;
  username: string;
  full_name: string;
  roles: string[];
  is_active: boolean;
  is_tenant_admin: boolean;
  last_login_at?: string;
}

export default function UsersPage() {
  const locale = useAuthStore((s) => s.locale);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [limits, setLimits] = useState<{ max_users: number; current_users: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", full_name: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get("/users"), api.get("/settings/limits")])
      .then(([usersRes, limitsRes]) => {
        setUsers(usersRes.data.items || []);
        setLimits(limitsRes.data);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/users", form);
      toast.success(locale === "ar" ? "تم إضافة المستخدم" : "User created");
      setOpen(false);
      setForm({ username: "", password: "", full_name: "" });
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const deactivateUser = async (id: string) => {
    if (!confirm(locale === "ar" ? "تعطيل المستخدم؟" : "Deactivate user?")) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success(locale === "ar" ? "تم التعطيل" : "User deactivated");
      load();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const columns: ColumnDef<UserRow>[] = [
    { accessorKey: "username", header: locale === "ar" ? "اسم المستخدم" : "Username" },
    { accessorKey: "full_name", header: locale === "ar" ? "الاسم" : "Name" },
    {
      accessorKey: "roles",
      header: "Roles",
      cell: ({ row }) => row.original.is_tenant_admin
        ? <Badge>Admin</Badge>
        : row.original.roles.map((r) => <Badge key={r} variant="outline" className="me-1">{r}</Badge>),
    },
    {
      accessorKey: "is_active",
      header: "Active",
      cell: ({ row }) => <Badge variant={row.original.is_active ? "default" : "secondary"}>{row.original.is_active ? "Yes" : "No"}</Badge>,
    },
    {
      id: "actions",
      cell: ({ row }) => row.original.is_active ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-destructive" onClick={() => deactivateUser(row.original.id)}>
              <Trash2 className="me-2 h-4 w-4" />{locale === "ar" ? "تعطيل" : "Deactivate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t(locale, "users")}</h1>
          <p className="text-muted-foreground">
            {limits
              ? locale === "ar"
                ? `${limits.current_users} / ${limits.max_users} مستخدم`
                : `${limits.current_users} / ${limits.max_users} users`
              : `${users.length} ${locale === "ar" ? "مستخدم" : "users"}`}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button disabled={!!limits && limits.current_users >= limits.max_users} />
            }
          >
            <Plus className="me-2 h-4 w-4" />{t(locale, "create")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{locale === "ar" ? "مستخدم جديد" : "New User"}</DialogTitle></DialogHeader>
            <form onSubmit={createUser} className="space-y-4">
              <div className="space-y-2">
                <Label>{locale === "ar" ? "اسم المستخدم" : "Username"}</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "الاسم" : "Full Name"}</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>{locale === "ar" ? "كلمة المرور" : "Password"}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>{t(locale, "save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          searchPlaceholder={t(locale, "search")}
          locale={locale}
          exportFileName="users.xlsx"
          exportSheetName={locale === "ar" ? "المستخدمون" : "Users"}
          dateFilterKeys={["created_at"]}
        />
      )}
    </div>
  );
}
