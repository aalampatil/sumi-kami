import { Suspense } from "react";
import { workspaceForPage } from "~/lib/server-workspace";
import { WorkspaceShell } from "~/components/workspaces/workspace-shell";
import { WorkspaceSettings } from "~/components/workspaces/workspace-settings";
async function Settings({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const workspace = await workspaceForPage(workspaceId);
  return (
    <WorkspaceShell workspace={workspace} active="settings">
      <WorkspaceSettings workspace={workspace} />
    </WorkspaceShell>
  );
}
export default function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main role="status" className="p-10">
          Loading settings…
        </main>
      }
    >
      <Settings params={params} />
    </Suspense>
  );
}
