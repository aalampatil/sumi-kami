import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Layers3 } from "lucide-react";
import { ThemeToggle } from "~/components/theme-toggle";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="border-b bg-card px-5 py-5 lg:min-h-screen lg:border-r lg:border-b-0 lg:px-6 lg:py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-3 text-xl font-semibold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground"
          >
            墨
          </span>
          Sumikami
        </Link>
        <nav aria-label="Dashboard" className="mt-6 lg:mt-12">
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center gap-3 rounded-md bg-secondary px-3 py-2 text-sm font-medium"
          >
            <Layers3 aria-hidden="true" className="size-4" />
            Workspaces
          </Link>
        </nav>
        <p className="mt-8 hidden text-xs leading-5 text-muted-foreground lg:block">
          Make every question
          <br />
          an experience.
        </p>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-20 items-center justify-end gap-4 border-b px-6 lg:px-10">
          <ThemeToggle />
          <UserButton />
        </header>
        <main id="main-content" className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
