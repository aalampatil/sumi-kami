import Link from "next/link";
import { Brand } from "./brand";
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:grid-cols-[1fr_auto_auto] sm:px-8">
        <div>
          <Brand />
          <p className="mt-4 max-w-xs text-sm leading-7 text-muted-foreground">
            Thoughtful forms. Meaningful conversations.
            <br />
            Ink meets interaction.
          </p>
        </div>
        <nav aria-label="Product links" className="flex flex-col items-start gap-1 text-sm">
          <p className="mb-2 font-medium">Explore</p>
          <Link className="inline-flex min-h-11 items-center hover:underline" href="/features">
            Features
          </Link>
          <Link className="inline-flex min-h-11 items-center hover:underline" href="/demo">
            Interactive demo
          </Link>
          <Link className="inline-flex min-h-11 items-center hover:underline" href="/dashboard">
            Your workspace
          </Link>
        </nav>
        <nav aria-label="Project links" className="flex flex-col items-start gap-1 text-sm">
          <p className="mb-2 font-medium">Behind the paper</p>
          <Link className="inline-flex min-h-11 items-center hover:underline" href="/about">
            Our approach
          </Link>
          <a
            className="inline-flex min-h-11 items-center hover:underline"
            href="https://github.com/aalampatil/sumi-kami"
          >
            Source on GitHub ↗
          </a>
          <a
            className="inline-flex min-h-11 items-center hover:underline"
            href="https://github.com/aalampatil/sumi-kami/tree/main/docs"
          >
            Project documentation ↗
          </a>
        </nav>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-t px-5 py-5 text-xs text-muted-foreground sm:px-8">
        <p>Sumikami · 墨 × 紙</p>
        <p>Make every question an experience.</p>
      </div>
    </footer>
  );
}
