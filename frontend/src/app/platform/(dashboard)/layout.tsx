import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function PlatformDashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout variant="platform">{children}</DashboardLayout>;
}
