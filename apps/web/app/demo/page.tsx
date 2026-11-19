import type { Metadata } from "next";
import { SiteShell } from "~/components/site/shell";
import { RespondentForm } from "~/components/forms/respondent-form";
import { PublicApiProvider } from "~/providers/public-api";
import { definitionSchema } from "@repo/form-core/definition";
export const metadata: Metadata = {
  title: "Try a form · Sumikami",
  description: "Experience a Sumikami form. This interactive demo does not save your answers.",
};
const definition = definitionSchema.parse({
  title: "The small things matter.",
  description:
    "Tell us about a recent experience that stayed with you. This is a demo: your answers remain in this page and are never submitted.",
  steps: [
    {
      key: "experience",
      title: "",
      fields: [
        {
          key: "name",
          type: "SHORT_TEXT",
          label: "What should we call you?",
          required: true,
          configuration: { placeholder: "Your first name" },
        },
        { key: "rating", type: "RATING", label: "How was your experience?", required: true },
        {
          key: "story",
          type: "LONG_TEXT",
          label: "What made it memorable?",
          helpText: "A tiny detail, a thoughtful gesture, or something we could do better.",
        },
      ],
    },
  ],
  settings: {
    completionTitle: "That’s the art of asking.",
    completionMessage: "Thank you for trying Sumikami. This was a demo, so no response was saved.",
  },
});
export default function Demo() {
  return (
    <SiteShell>
      <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
        <p className="mb-6 text-center text-xs uppercase tracking-[0.18em] text-muted-foreground">
          AN INTERACTIVE DEMO · NO ACCOUNT NEEDED · NOTHING IS SAVED
        </p>
        <PublicApiProvider>
          <RespondentForm definition={definition} preview />
        </PublicApiProvider>
      </main>
    </SiteShell>
  );
}
