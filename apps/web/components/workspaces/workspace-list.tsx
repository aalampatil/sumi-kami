"use client";
import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { WorkspaceCard } from "./workspace-card";
import { trpc } from "~/trpc/client";

type Cursor = { cursorCreatedAt: string; cursorId: string };
export function WorkspaceList() {
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const current = cursors.at(-1);
  const workspaces = trpc.workspaces.list.useQuery({ limit: 20, ...current }, { retry: false });
  return (
    <section
      className="mt-10"
      aria-labelledby="workspaces-heading"
      aria-busy={workspaces.isFetching}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="workspaces-heading" className="text-xl font-semibold">
            Your workspaces
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A shared space for your next great question.
          </p>
        </div>
        <CreateWorkspaceDialog />
      </div>
      {workspaces.isPending ? (
        <p className="py-16 text-center text-sm text-muted-foreground" role="status">
          Loading your workspaces…
        </p>
      ) : workspaces.error ? (
        <div className="mt-6 rounded-xl border bg-card p-6" role="alert">
          <p>We couldn’t load your workspaces.</p>
          <Button
            variant="outline"
            className="mt-4 min-h-11"
            onClick={() => void workspaces.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : workspaces.data.items.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.data.items.map((workspace) => (
            <WorkspaceCard key={workspace.id} workspace={workspace} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed px-6 py-16 text-center">
          <FolderOpen className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-4 font-semibold">
            {current ? "No more workspaces" : "A blank canvas, together"}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {current
              ? "Return to the previous page to see your workspaces."
              : "Create your first workspace to keep your forms and team organized."}
          </p>
        </div>
      )}
      {cursors.length || workspaces.data?.nextCursor ? (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Workspace pages">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!cursors.length || workspaces.isFetching}
            onClick={() => setCursors((previous) => previous.slice(0, -1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {cursors.length + 1}</span>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!workspaces.data?.nextCursor || workspaces.isFetching}
            onClick={() => {
              const cursor = workspaces.data?.nextCursor;
              if (cursor)
                setCursors((previous) => [
                  ...previous,
                  { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
                ]);
            }}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
