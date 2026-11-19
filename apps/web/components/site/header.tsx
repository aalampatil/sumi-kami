import Link from "next/link";
import { Brand } from "./brand";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 sm:px-8">
        <Brand />
        <nav
          aria-label="Main navigation"
          className="order-3 flex w-full flex-wrap items-center gap-x-4 border-t pt-2 text-xs sm:order-none sm:w-auto sm:gap-6 sm:border-0 sm:pt-0 sm:text-sm"
        >
          <Link
            href="/features"
            className="inline-flex min-h-11 items-center hover:underline underline-offset-4"
          >
            Features
          </Link>
          <Link
            href="/about"
            className="inline-flex min-h-11 items-center hover:underline underline-offset-4"
          >
            Our approach
          </Link>
          <Link
            href="/demo"
            className="inline-flex min-h-11 items-center hover:underline underline-offset-4"
          >
            Try a form
          </Link>
          <Link href="/sign-in" className="ml-auto inline-flex min-h-11 items-center sm:hidden">
            Sign in
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden min-h-11 sm:inline-flex">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild className="min-h-11">
            <Link href="/dashboard">
              Get started<span aria-hidden="true"> ↗</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
