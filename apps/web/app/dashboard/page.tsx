import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { createServerApi } from "~/trpc/server";
import { DashboardShell } from "~/components/dashboard/shell";
import { WorkspaceList } from "~/components/workspaces/workspace-list";

async function AccountOverview() {
  await auth.protect();
  const api = await createServerApi();
  const user = await api.auth.me.query();
  return (
    <DashboardShell>
      <section aria-labelledby="account-heading" data-testid="account-overview">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Your creative space
        </p>
        <h1 id="account-heading" className="mt-3 text-3xl font-semibold tracking-tight">
          Welcome, {user.fullName}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Every good question starts with a little space to think.
        </p>
      </section>
      <WorkspaceList />
    </DashboardShell>
  );
}
export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <main className="p-10" role="status">
          Loading your workspace…
        </main>
      }
    >
      <AccountOverview />
    </Suspense>
  );
}
