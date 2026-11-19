import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "~/components/site/shell";
import { Button } from "~/components/ui/button";
import { fieldLabels, fieldTypes } from "@repo/form-core/definition";
export const metadata: Metadata = {
  title: "Features · Sumikami",
  description:
    "Build thoughtful forms with flexible questions, conditional logic, versioned publishing, private responses, and expressive themes.",
};
const details = [
  [
    "01",
    "Make every question count",
    "Start with a clear structure.",
    "Add and organize questions into steps, refine labels and help text, and set required answers and sensible limits. Your preview uses the same renderer as the published form.",
  ],
  [
    "02",
    "A form that follows the answer",
    "Keep the conversation relevant.",
    "Show and hide later questions, skip forward to another step, or finish early. The server validates responses against the same visibility and routing rules.",
  ],
  [
    "03",
    "Your own kind of paper",
    "Let your personality through.",
    "Choose Japanese Ink, Minimal, or Midnight, then refine your colors, typography, button label, and thank-you message. Your published appearance is captured with that version.",
  ],
  [
    "04",
    "A version for every chapter",
    "Improve the form without losing its history.",
    "Publishing freezes the current version. Make future changes in a new draft, preview them, and publish when you’re ready. Earlier responses retain their original questions and choices.",
  ],
  [
    "05",
    "A place to hear the whole story",
    "Review responses in context.",
    "Browse paginated results, open complete answers, and download private attachments. Export results and see response activity without mixing the meaning of different form versions.",
  ],
  [
    "06",
    "A workspace for your people",
    "Give access with intention.",
    "Organize forms by workspace and work with owners, admins, editors, and viewers. The API checks permissions for each operation, and the database isolates workspace records.",
  ],
];
export default function Features() {
  return (
    <SiteShell>
      <main id="main-content" className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          THE TOOLS BEHIND THE CONVERSATION
        </p>
        <h1 className="mt-6 max-w-3xl font-serif text-5xl leading-tight sm:text-7xl">
          Thoughtful by design.
          <br />
          <span className="italic text-[#9f382c] dark:text-[#e1947c]">Useful by nature.</span>
        </h1>
        <p className="mt-7 max-w-xl leading-8 text-muted-foreground">
          From the first draft to the response that changes your thinking, every part of Sumikami
          has a place.
        </p>
        <div className="mt-14 border-y py-8">
          <h2 className="text-sm font-semibold">Thirteen ways to ask</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {fieldTypes.map((type) => (
              <li key={type} className="rounded-full border bg-card px-4 py-2 text-xs">
                {fieldLabels[type]}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-16">
          {details.map(([number, title, subtitle, body]) => (
            <section key={number} className="grid gap-5 border-b py-10 md:grid-cols-[80px_1fr_1fr]">
              <p className="font-mono text-sm text-muted-foreground">{number} /</p>
              <h2 className="max-w-xs font-serif text-3xl leading-tight">{title}</h2>
              <div>
                <h3 className="text-base font-semibold">{subtitle}</h3>
                <p className="mt-3 text-sm leading-8 text-muted-foreground">{body}</p>
              </div>
            </section>
          ))}
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-6 rounded-xl border bg-card p-8">
          <h2 className="font-serif text-3xl">Get a feel for the experience.</h2>
          <Button asChild className="min-h-12">
            <Link href="/demo">Try the interactive demo ↗</Link>
          </Button>
        </div>
      </main>
    </SiteShell>
  );
}
