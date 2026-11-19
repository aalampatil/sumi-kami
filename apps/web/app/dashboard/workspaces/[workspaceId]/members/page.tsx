import { Suspense } from "react";
import { workspaceForPage } from "~/lib/server-workspace";
import { WorkspaceShell } from "~/components/workspaces/workspace-shell";
import { WorkspaceMembers } from "~/components/workspaces/members";
async function Members({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params,
    workspace = await workspaceForPage(workspaceId);
  return (
    <WorkspaceShell workspace={workspace} active="members">
      <WorkspaceMembers workspaceId={workspaceId} />
    </WorkspaceShell>
  );
}
export default function MembersPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  return (
    <Suspense
      fallback={
        <main role="status" className="p-10">
          Opening your team…
        </main>
      }
    >
      <Members params={params} />
    </Suspense>
  );
}
