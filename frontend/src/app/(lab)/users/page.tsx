"use client";

import { ModulePage } from "@/components/modules/module-page";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Record<string, unknown>>[] = [
  { accessorKey: "full_name", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "roles", header: "Roles" },
  { accessorKey: "is_active", header: "Active" },
  { accessorKey: "last_login_at", header: "Last Login" },
];

export default function UsersPage() {
  return (
    <ModulePage
      titleKey="users"
      descriptionEn="User management with RBAC roles and permissions"
      descriptionAr="إدارة المستخدمين مع الأدوار والصلاحيات"
      columns={columns}
    />
  );
}
