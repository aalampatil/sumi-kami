import Link from "next/link";
export default function WorkspaceNotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-2xl font-semibold">Workspace not found</h1>
      <p className="mt-3 text-muted-foreground">
        This workspace is unavailable or you don’t have access.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground"
      >
        Back to workspaces
      </Link>
    </main>
  );
}
