import { auth } from "@clerk/nextjs/server";
import { Suspense, type ReactNode } from "react";
import { DashboardProviders } from "~/providers/dashboard";
async function AuthenticatedDashboard({ children }: { children: ReactNode }) {
  const { userId } = await auth.protect();
  return <DashboardProviders serverUserId={userId}>{children}</DashboardProviders>;
}
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main role="status" className="p-10">
          Loading your account…
        </main>
      }
    >
      <AuthenticatedDashboard>{children}</AuthenticatedDashboard>
    </Suspense>
  );
}
