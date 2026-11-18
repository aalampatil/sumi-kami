import Link from "next/link";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import type { WorkspaceSummary } from "@repo/trpc/client";

export function WorkspaceCard({ workspace }: { workspace: WorkspaceSummary }) {
  return (
    <Link
      href={"/dashboard/workspaces/" + workspace.id}
      className="group flex min-w-0 flex-col rounded-xl border bg-card p-6 transition-colors hover:border-input focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <div className="flex items-center justify-between">
        <span className="flex size-11 items-center justify-center rounded-lg bg-secondary">
          <FolderOpen className="size-5" aria-hidden="true" />
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="mt-6 break-words text-lg font-semibold">{workspace.name}</h3>
      <p className="mt-1 break-all text-sm text-muted-foreground">{workspace.slug}</p>
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <span className="text-xs text-muted-foreground">Your role</span>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
          {workspace.role.charAt(0) + workspace.role.slice(1).toLowerCase()}
        </span>
      </div>
    </Link>
  );
}
