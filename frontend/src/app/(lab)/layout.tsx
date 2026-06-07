import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout variant="lab">{children}</DashboardLayout>;
}
