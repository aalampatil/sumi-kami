import type { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Layers3 } from "lucide-react";
import { ThemeToggle } from "~/components/theme-toggle";
import { InkMark } from "~/components/brand/ink-art";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="ink-product min-h-screen lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <aside className="product-sidebar border-b bg-card px-5 py-5 lg:min-h-screen lg:border-r lg:border-b-0 lg:px-6 lg:py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-3 text-xl font-semibold tracking-tight"
        >
          <InkMark className="size-9" />
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
      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="flex min-h-20 items-center justify-end gap-4 border-b px-6 lg:px-10">
          <ThemeToggle />
          <UserButton />
        </header>
        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 lg:px-10 lg:py-12"
        >
          {children}
        </main>
        <footer className="flex flex-wrap justify-between gap-4 border-t px-6 py-5 text-xs text-muted-foreground lg:px-10">
          <p>Sumikami · Ink meets interaction.</p>
          <Link href="/demo" className="underline underline-offset-4">
            Explore the form experience ↗
          </Link>
        </footer>
      </div>
    </div>
  );
}
