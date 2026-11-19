import type { ReactNode } from "react";
import Link from "next/link";
import type { WorkspaceSummary } from "@repo/trpc/client";
import { DashboardShell } from "~/components/dashboard/shell";
export function WorkspaceShell({
  workspace,
  active,
  children,
}: {
  workspace: WorkspaceSummary;
  active: "forms" | "settings" | "members";
  children: ReactNode;
}) {
  const base = "/dashboard/workspaces/" + workspace.id;
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
      <nav aria-label="Workspace" className="mt-8 flex gap-6 border-b">
        {(
          [
            ["forms", "Forms", base],
            ["members", "Members", base + "/members"],
            ["settings", "Settings", base + "/settings"],
          ] as const
        ).map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
            className={
              "inline-flex min-h-12 items-center border-b-2 px-1 text-sm font-medium " +
              (active === key
                ? "border-primary"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </DashboardShell>
  );
}
