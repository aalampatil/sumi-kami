import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "~/components/site/shell";
import { Button } from "~/components/ui/button";
export const metadata: Metadata = {
  title: "Our approach · Sumikami",
  description:
    "Ink meets interaction. A thoughtful approach to asking questions and listening to the answers.",
};
export default function About() {
  return (
    <SiteShell>
      <main id="main-content" className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          THE ART OF ASKING
        </p>
        <div className="mt-8 grid items-start gap-12 lg:grid-cols-2">
          <h1 className="font-serif text-5xl leading-tight sm:text-7xl">
            A question is
            <br />
            an invitation.
            <br />
            <span className="italic text-[#9f382c] dark:text-[#e1947c]">Treat it like one.</span>
          </h1>
          <div className="space-y-6 text-base leading-8 text-muted-foreground">
            <p>
              Sumikami brings together{" "}
              <span className="font-serif text-xl text-foreground">墨</span> (ink) and{" "}
              <span className="font-serif text-xl text-foreground">紙</span> (paper): two simple
              materials that can hold an extraordinary amount of meaning.
            </p>
            <p>
              We take that idea into the digital world. A form should offer enough structure to be
              clear and enough room for a person to express themselves. The interface should help
              the conversation, from the first question to the final thank you.
            </p>
            <p>
              For creators, that means a calm workspace, an honest preview, and changes you can
              publish with confidence. For respondents, it means a readable form that respects their
              attention.
            </p>
          </div>
        </div>
        <section className="mt-20 grid gap-10 border-y py-12 sm:grid-cols-3">
          {[
            [
              "Clarity",
              "Ask with intention. Use clear labels, useful help text, and questions that belong in the conversation.",
            ],
            [
              "Expression",
              "Make room for character. A chosen palette and a thoughtful rhythm can make even a simple form feel personal.",
            ],
            [
              "Care",
              "Keep the details intact. Respect workspace access, preserve earlier responses, and make the next action easy to understand.",
            ],
          ].map(([title, body]) => (
            <article key={title}>
              <h2 className="font-serif text-3xl">{title}</h2>
              <p className="mt-4 text-sm leading-8 text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>
        <section className="mt-16 max-w-2xl">
          <h2 className="font-serif text-4xl">Built in the open.</h2>
          <p className="mt-5 leading-8 text-muted-foreground">
            Sumikami’s source and architecture are available on GitHub. Explore how the workspace,
            versioned forms, and response journeys fit together, or contribute to the project.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild className="min-h-12">
              <Link href="/dashboard">Start your next conversation ↗</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-12">
              <a href="https://github.com/aalampatil/sumi-kami">Explore the source</a>
            </Button>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
