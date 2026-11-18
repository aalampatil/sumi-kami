import { auth } from "@clerk/nextjs/server";
import { TRPCClientError } from "@trpc/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { createServerApi } from "~/trpc/server";
import { DashboardShell } from "~/components/dashboard/shell";
import { WorkspaceSettings } from "~/components/workspaces/workspace-settings";

async function WorkspaceOverview({ params }: { params: Promise<{ workspaceId: string }> }) {
  await auth.protect();
  const { workspaceId } = await params;
  const api = await createServerApi();
  let workspace;
  try {
    workspace = await api.workspaces.get.query({ workspaceId });
  } catch (error) {
    if (
      error instanceof TRPCClientError &&
      (error.data?.code === "NOT_FOUND" || error.data?.code === "BAD_REQUEST")
    )
      notFound();
    throw error;
  }
  return (
    <DashboardShell>
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        All workspaces
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-semibold tracking-tight">{workspace.name}</h1>
          <p className="mt-3 break-all text-sm text-muted-foreground">{workspace.slug}</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
          {workspace.role.charAt(0) + workspace.role.slice(1).toLowerCase()}
        </span>
      </div>
      <WorkspaceSettings workspace={workspace} />
    </DashboardShell>
  );
}
export default function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  return (
    <Suspense
      fallback={
        <main className="p-10" role="status">
          Loading workspace…
        </main>
      }
    >
      <WorkspaceOverview params={params} />
    </Suspense>
  );
}
