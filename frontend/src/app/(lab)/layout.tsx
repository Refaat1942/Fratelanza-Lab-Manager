import { LabAuthGuard } from "@/components/auth/auth-guard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <LabAuthGuard>
      <DashboardLayout variant="lab">{children}</DashboardLayout>
    </LabAuthGuard>
  );
}
