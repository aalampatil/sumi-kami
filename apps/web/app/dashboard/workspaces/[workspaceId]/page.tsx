import { Suspense } from "react";
import { workspaceForPage } from "~/lib/server-workspace";
import { WorkspaceForms } from "~/components/forms/workspace-forms";
import { WorkspaceShell } from "~/components/workspaces/workspace-shell";

async function WorkspaceOverview({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const workspace = await workspaceForPage(workspaceId);
  return (
    <WorkspaceShell workspace={workspace} active="forms">
      <WorkspaceForms workspace={workspace} />
    </WorkspaceShell>
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
