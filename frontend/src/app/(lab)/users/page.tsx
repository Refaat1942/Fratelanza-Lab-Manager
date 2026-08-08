"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

interface UserRow {
  id: string;
  username: string;
  full_name: string;
  roles: string[];
  is_active: boolean;
  is_tenant_admin: boolean;
  last_login_at?: string;
}

interface RoleOption {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  permissions: string[];
}

const emptyForm = { username: "", password: "", full_name: "", role_ids: [] as string[] };

export default function UsersPage() {
  const locale = useAuthStore((s) => s.locale);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [limits, setLimits] = useState<{ max_users: number; current_users: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { dateFrom, dateTo, setDateFrom, setDateTo, queryParams, reset } = useDateRange();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/users${queryParams.replace(/^&/, "?")}`),
      api.get("/settings/limits"),
      api.get("/users/roles"),
    ])
      .then(([usersRes, limitsRes, rolesRes]) => {
        setUsers(usersRes.data.items || []);
        setLimits(limitsRes.data);
        setRoles(rolesRes.data || []);
      })
      .catch((err) => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, [queryParams]);

  useEffect(() => { load(); }, [load]);

  const roleLabel = (role: RoleOption) =>
    locale === "ar" && role.name_ar ? role.name_ar : role.name;

  const toggleRole = (roleId: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      role_ids: checked
        ? [...prev.role_ids, roleId]
        : prev.role_ids.filter((id) => id !== roleId),
    }));
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/users", {
        username: form.username,
        password: form.password,
        full_name: form.full_name,
        role_ids: form.role_ids,
      });
      toast.success(locale === "ar" ? "تم إضافة المستخدم" : "User created");
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (user: UserRow) => {
    try {
      const { data: roleList } = await api.get("/users/roles");
      const matched = (roleList as RoleOption[]).filter((r) => user.roles.includes(r.name));
      setEditId(user.id);
      setForm({
        username: user.username,
        password: "",
        full_name: user.full_name,
        role_ids: matched.map((r) => r.id),
      });
      setEditOpen(true);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const updateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      await api.patch(`/users/${editId}`, {
        full_name: form.full_name,
        role_ids: form.role_ids,
      });
      toast.success(locale === "ar" ? "تم التحديث" : "User updated");
      setEditOpen(false);
      setEditId(null);
      setForm(emptyForm);
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

  const rolePicker = (disabled?: boolean) => (
    <div className="space-y-2 rounded-lg border p-3">
      <Label>{locale === "ar" ? "الصلاحيات (الأدوار)" : "Access roles"}</Label>
      <p className="text-xs text-muted-foreground">
        {locale === "ar"
          ? "اختر دوراً واحداً أو أكثر لتحديد ما يمكن للمستخدم الوصول إليه"
          : "Select one or more roles to control which features this user can access"}
      </p>
      <div className="max-h-48 space-y-2 overflow-y-auto pt-1">
        {roles.filter((r) => r.name !== "Admin").map((role) => (
          <label key={role.id} className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted/50">
            <Checkbox
              checked={form.role_ids.includes(role.id)}
              disabled={disabled}
              onCheckedChange={(v) => toggleRole(role.id, v === true)}
            />
            <span className="text-sm">
              <span className="font-medium">{roleLabel(role)}</span>
              {role.permissions.length > 0 && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {role.permissions.slice(0, 4).join(", ")}
                  {role.permissions.length > 4 ? "…" : ""}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  const columns: ColumnDef<UserRow>[] = [
    { accessorKey: "username", header: locale === "ar" ? "اسم المستخدم" : "Username" },
    { accessorKey: "full_name", header: locale === "ar" ? "الاسم" : "Name" },
    {
      accessorKey: "roles",
      header: locale === "ar" ? "الأدوار" : "Roles",
      cell: ({ row }) => row.original.is_tenant_admin
        ? <Badge>{locale === "ar" ? "مدير" : "Admin"}</Badge>
        : row.original.roles.map((r) => <Badge key={r} variant="outline" className="mr-1">{r}</Badge>),
    },
    {
      accessorKey: "is_active",
      header: locale === "ar" ? "نشط" : "Active",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? (locale === "ar" ? "نعم" : "Yes") : (locale === "ar" ? "لا" : "No")}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => row.original.is_active && !row.original.is_tenant_admin ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />{t(locale, "edit")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => deactivateUser(row.original.id)}>
              <Trash2 className="mr-2 h-4 w-4" />{locale === "ar" ? "تعطيل" : "Deactivate"}
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
          <p className="mt-1 text-sm text-muted-foreground">
            {locale === "ar"
              ? "أضف مستخدمين وحدد أدوارهم للتحكم في صلاحيات كل وحدة."
              : "Add staff and assign roles to control access to each module."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button disabled={!!limits && limits.current_users >= limits.max_users} />
            }
          >
            <Plus className="mr-2 h-4 w-4" />{t(locale, "create")}
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
              {rolePicker()}
              <Button type="submit" className="w-full" disabled={saving}>{t(locale, "save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{locale === "ar" ? "تعديل المستخدم" : "Edit User"}</DialogTitle></DialogHeader>
          <form onSubmit={updateUser} className="space-y-4">
            <div className="space-y-2">
              <Label>{locale === "ar" ? "اسم المستخدم" : "Username"}</Label>
              <Input value={form.username} disabled />
            </div>
            <div className="space-y-2">
              <Label>{locale === "ar" ? "الاسم" : "Full Name"}</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            {rolePicker()}
            <Button type="submit" className="w-full" disabled={saving}>{t(locale, "save")}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
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
          onExport={() => exportModuleExcel("users", dateFrom, dateTo).catch((e) => toast.error(String(e)))}
        />
      )}
    </div>
  );
}
