import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  GitBranch,
  Layers3,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  MessageSquareText,
} from "lucide-react";
import { SiteShell } from "~/components/site/shell";
import { HeroPreview } from "~/components/site/hero-preview";
import { Button } from "~/components/ui/button";

const capabilities = [
  {
    icon: SlidersHorizontal,
    title: "A question for every answer",
    body: "Text, choices, ratings, dates, files, and more. Shape the conversation around what you need to learn.",
  },
  {
    icon: GitBranch,
    title: "Follow the conversation",
    body: "Show relevant questions and skip the rest. Conditional logic makes room for a more thoughtful response.",
  },
  {
    icon: Palette,
    title: "Make it feel like you",
    body: "Begin with Japanese Ink, Minimal, or Midnight. Choose colors and a heading style that belong to your story.",
  },
  {
    icon: Layers3,
    title: "Change with confidence",
    body: "Edit a new draft while the published form stays live. Earlier answers keep their original questions.",
  },
  {
    icon: ShieldCheck,
    title: "Give your team its own space",
    body: "Keep projects in separate workspaces with clear roles and controlled access to forms and responses.",
  },
  {
    icon: MessageSquareText,
    title: "Listen beyond the numbers",
    body: "Read each complete response in context. Review the details, download attachments, and export your results.",
  },
];
export default function Home() {
  return (
    <SiteShell>
      <main id="main-content">
        <section className="ink-hero mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
              墨 × 紙 · INK MEETS INTERACTION
            </p>
            <h1 className="mt-7 max-w-2xl font-serif text-[clamp(2.35rem,12vw,3rem)] leading-[1.08] tracking-tight sm:text-7xl lg:text-[5.3rem]">
              Make every
              <br />
              question an
              <br />
              <span className="italic text-[#9f382c] dark:text-[#e1947c]">experience.</span>
            </h1>
            <p className="mt-7 max-w-md text-base leading-8 text-muted-foreground sm:text-lg">
              A form can do more than collect information. Give your questions a thoughtful home,
              and give people a reason to answer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="min-h-12 px-6">
                <Link href="/dashboard">
                  Create your first form
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-12 px-6">
                <Link href="/demo">Try a live demo</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Build. Preview. Publish. Start a conversation.
            </p>
          </div>
          <HeroPreview />
        </section>
        <div className="border-y bg-card">
          <div className="mx-auto grid max-w-7xl grid-cols-3 gap-3 px-5 py-7 sm:px-8">
            {[
              ["13", "ways to ask"],
              ["03", "appearance presets"],
              ["∞", "possibilities to listen"],
            ].map(([number, label]) => (
              <div
                key={label}
                className="flex flex-col gap-2 border-l pl-4 first:border-l-0 first:pl-0 sm:flex-row sm:items-center sm:gap-5 sm:pl-8"
              >
                <span className="font-serif text-3xl sm:text-4xl">{number}</span>
                <span className="text-xs text-muted-foreground sm:text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-6 md:grid-cols-2">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              FROM A BLANK PAGE TO A BETTER QUESTION
            </p>
            <div>
              <h2 className="font-serif text-4xl leading-tight sm:text-5xl">
                Less friction.
                <br />
                More conversation.
              </h2>
              <p className="mt-5 max-w-lg text-base leading-8 text-muted-foreground">
                For feedback that changes your next move, registrations that bring people together,
                and the small check-ins that make a difference.
              </p>
            </div>
          </div>
          <div className="mt-14 grid gap-10 border-t pt-10 md:grid-cols-3">
            {[
              [
                "01",
                "Build with intention",
                "Add your questions, organize them into steps, and see the experience take shape in a live preview.",
              ],
              [
                "02",
                "Share a little of yourself",
                "Choose your appearance, publish your form, and send one simple link. Respondents can answer without an account.",
              ],
              [
                "03",
                "Make space to listen",
                "Read complete responses in your workspace. Refine your next version without rewriting the past.",
              ],
            ].map(([number, title, body]) => (
              <article key={number}>
                <span className="font-mono text-xs text-[#9f382c] dark:text-[#e1947c]">
                  {number} /
                </span>
                <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="border-y bg-card">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  ROOM FOR THE DETAILS
                </p>
                <h2 className="mt-5 font-serif text-4xl sm:text-5xl">
                  Simple to start.
                  <br />
                  Considered throughout.
                </h2>
              </div>
              <Link
                className="inline-flex min-h-11 items-center gap-3 text-sm underline underline-offset-4"
                href="/features"
              >
                Explore the features
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map(({ icon: Icon, title, body }) => (
                <article key={title} className="border-t pt-6">
                  <Icon className="size-5 text-[#9f382c] dark:text-[#e1947c]" aria-hidden="true" />
                  <h3 className="mt-5 text-base font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 sm:py-28 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              YOUR NEXT CONVERSATION STARTS HERE
            </p>
            <h2 className="mt-6 font-serif text-4xl leading-tight sm:text-6xl">
              A blank canvas.
              <br />
              An open invitation.
            </h2>
            <p className="mt-5 max-w-lg text-muted-foreground leading-7">
              You bring the curiosity. We’ll bring the space.
            </p>
          </div>
          <Button asChild className="min-h-12 w-fit px-7">
            <Link href="/dashboard">
              Make your first form
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </main>
    </SiteShell>
  );
}
