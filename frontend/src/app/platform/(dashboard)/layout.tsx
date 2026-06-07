import { PlatformAuthGuard } from "@/components/auth/auth-guard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function PlatformDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformAuthGuard>
      <DashboardLayout variant="platform">{children}</DashboardLayout>
    </PlatformAuthGuard>
  );
}
