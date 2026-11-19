"use client";
import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { Answers, FieldIssue, FormDefinition } from "@repo/form-core/definition";
import { contrast, focusInk } from "@repo/form-core/appearance";
import { formPath, isAnswered, validateAnswers } from "@repo/form-core/answers";
import type { PublishedForm } from "@repo/trpc/client";
import { trpc } from "~/trpc/client";
import { QuestionFields } from "./question-fields";
import { Enso, InkMark } from "~/components/brand/ink-art";
import { useHydrated } from "~/lib/use-hydrated";

export function RespondentForm({
  definition,
  published,
  preview = false,
}: {
  definition: FormDefinition;
  published?: PublishedForm;
  preview?: boolean;
}) {
  const hydrated = useHydrated();
  const [values, setValues] = useState<Answers>({}),
    [files, setFiles] = useState<Record<string, File[]>>({}),
    [issues, setIssues] = useState<FieldIssue[]>([]);
  const [attempt, setAttempt] = useState(() => crypto.randomUUID()),
    [finished, setFinished] = useState(false),
    [filePending, setFilePending] = useState(false),
    [requestError, setRequestError] = useState("");
  const form = useRef<HTMLFormElement>(null),
    submit = trpc.public.submit.useMutation({ onSuccess: () => setFinished(true) });
  const path = formPath(definition, values),
    appearance = definition.settings.appearance,
    pending = submit.isPending || filePending;
  const style = {
    "--form-bg": appearance.background,
    "--form-surface": appearance.surface,
    "--form-text": appearance.text,
    "--form-muted": appearance.muted,
    "--form-accent": appearance.accent,
    "--form-focus": focusInk(appearance),
    "--form-on-accent": appearance.onAccent,
    "--form-border": appearance.border,
    "--seal": appearance.accent,
    colorScheme:
      contrast(appearance.background, "#FFFFFF") > contrast(appearance.background, "#000000")
        ? "dark"
        : "light",
  } as CSSProperties;
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateAnswers(definition, path.answers);
    for (const field of path.fields)
      for (const file of files[field.key] ?? [])
        if (file.size > (field.configuration.maxBytes ?? 5242880))
          errors.push({ fieldKey: field.key, message: "This file exceeds the allowed size." });
    setIssues(errors);
    setRequestError("");
    if (errors.length) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    if (preview) {
      setFinished(true);
      return;
    }
    if (!published) return;
    const payload = {
      slug: published.slug,
      versionId: published.versionId,
      idempotencyKey: attempt,
      answers: Object.entries(path.answers).map(([fieldKey, value]) => ({ fieldKey, value })),
    };
    if (Object.values(files).some((selected) => selected.length)) {
      setFilePending(true);
      try {
        const body = new FormData();
        body.set("data", JSON.stringify(payload));
        for (const field of path.fields)
          for (const file of files[field.key] ?? []) body.append("file:" + field.key, file);
        const base = new URL(
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc",
          window.location.origin,
        );
        base.pathname = "/api/forms/" + published.slug + "/submissions";
        base.search = "";
        const response = await fetch(base, { method: "POST", body, credentials: "omit" });
        if (!response.ok) {
          const error = (await response.json()) as { error?: string };
          throw new Error(
            typeof error.error === "string"
              ? error.error
              : "We couldn’t submit your response. Please try again.",
          );
        }
        setFinished(true);
      } catch (error) {
        setRequestError(
          error instanceof Error ? error.message : "We couldn’t submit your response.",
        );
      } finally {
        setFilePending(false);
      }
    } else submit.mutate(payload);
  }
  function reset() {
    setValues({});
    setFiles({});
    setIssues([]);
    setAttempt(crypto.randomUUID());
    setFinished(false);
    submit.reset();
    setRequestError("");
  }
  return (
    <div
      style={style}
      data-form-theme={appearance.preset}
      className={
        (appearance.preset === "japanese-ink" ? "ink-form " : "") +
        (preview ? "form-preview rounded-xl border" : "min-h-screen") +
        " bg-[var(--form-bg)] text-[var(--form-text)]"
      }
    >
      <div className="form-sheet mx-auto flex min-h-[inherit] max-w-2xl flex-col px-6 py-10 sm:px-10 sm:py-16">
        <div className="form-masthead mb-10 flex items-center justify-between gap-4 border-b border-[var(--form-border)] pb-5">
          <Link
            href="/"
            className="form-brand inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <InkMark className="size-7 shrink-0" />
            Sumikami
          </Link>
          {preview ? (
            <span className="rounded-full border border-[var(--form-border)] px-3 py-1 text-xs">
              Preview · answers aren’t saved
            </span>
          ) : (
            <span className="text-xs text-[var(--form-muted)]">The art of asking.</span>
          )}
        </div>
        {finished ? (
          <section className="form-completion ink-reveal py-14 text-center" aria-live="polite">
            <span className="form-completion-mark mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--form-accent)] text-[var(--form-on-accent)]">
              {appearance.preset === "japanese-ink" ? <Enso className="completion-enso" /> : null}
              <Check className="completion-check" aria-hidden="true" />
            </span>
            <h1
              className={
                (appearance.font === "serif" ? "font-serif " : "") + "mt-6 text-3xl font-semibold"
              }
            >
              {definition.settings.completionTitle}
            </h1>
            <p className="mt-4 whitespace-pre-wrap leading-7 text-[var(--form-muted)]">
              {definition.settings.completionMessage}
            </p>
            {preview ? (
              <p className="mt-3 text-sm">This was a preview. No response was saved.</p>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--form-border)] px-4 py-2 text-sm"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {preview ? "Restart preview" : "Submit another response"}
            </button>
          </section>
        ) : (
          <>
            <div className="form-introduction ink-reveal">
              {appearance.preset === "japanese-ink" ? (
                <>
                  <Enso className="form-enso" />
                  <p className="form-eyebrow">A space to be heard</p>
                </>
              ) : null}
              <h1
                className={
                  (appearance.font === "serif" ? "font-serif " : "") +
                  "form-title break-words text-4xl leading-tight tracking-tight sm:text-5xl"
                }
              >
                {definition.title}
              </h1>
              {definition.description ? (
                <p className="form-description mt-5 whitespace-pre-wrap text-base leading-8 text-[var(--form-muted)]">
                  {definition.description}
                </p>
              ) : null}
            </div>
            {path.fields.some((field) => field.required) ? (
              <p className="mt-4 text-xs text-[var(--form-muted)]">
                Questions marked * are required.
              </p>
            ) : null}
            {appearance.preset === "japanese-ink" ? (
              <div className="mt-7">
                <progress
                  className="form-progress"
                  aria-label="Questions answered"
                  max={Math.max(1, path.fields.length)}
                  value={path.fields.filter((field) => isAnswered(values[field.key])).length}
                />
              </div>
            ) : null}
            <form
              ref={form}
              method="post"
              onSubmit={(event) => void send(event)}
              noValidate
              className="mt-10 space-y-10"
              aria-busy={pending}
            >
              {definition.steps
                .filter((step) => path.stepKeys.includes(step.key))
                .map((step) => (
                  <section key={step.key} className="space-y-6">
                    {definition.steps.length > 1 && step.title ? (
                      <h2 className="border-b border-[var(--form-border)] pb-3 text-xl font-semibold">
                        {step.title}
                      </h2>
                    ) : null}
                    <QuestionFields
                      fields={step.fields.filter((field) =>
                        path.fields.some((item) => item.key === field.key),
                      )}
                      values={values}
                      onChange={(key, value) => {
                        setValues((previous) => ({ ...previous, [key]: value }));
                        setIssues((previous) => previous.filter((issue) => issue.fieldKey !== key));
                      }}
                      prefix={(preview ? "preview" : "form") + step.key}
                      issues={issues}
                      files={files}
                      onFiles={(key, selected) =>
                        setFiles((previous) => ({ ...previous, [key]: selected }))
                      }
                      disabled={pending || !hydrated}
                    />
                  </section>
                ))}
              {submit.error || requestError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-[var(--form-border)] p-4 text-sm"
                >
                  {requestError || submit.error?.message}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--form-border)] pt-6">
                <button
                  type="submit"
                  disabled={!hydrated || pending || !path.fields.length}
                  className="form-submit inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[var(--form-accent)] px-6 py-3 text-sm font-medium text-[var(--form-on-accent)] outline-offset-4 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[var(--form-focus)] disabled:opacity-60"
                >
                  {pending ? "Submitting…" : definition.settings.submitLabel}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
                <span className="text-xs text-[var(--form-muted)]">
                  {path.fields.filter((field) => isAnswered(values[field.key])).length} of{" "}
                  {path.fields.length} answered
                </span>
              </div>
            </form>
            {!hydrated ? (
              <p role="status" className="mt-6 text-sm">
                Enable JavaScript to complete this form. Your answers are not submitted while it is
                disabled.
              </p>
            ) : null}
          </>
        )}
        <footer className="mt-16 border-t border-[var(--form-border)] pt-5 text-xs text-[var(--form-muted)]">
          Made with Sumikami. Make every question an experience.
        </footer>
      </div>
    </div>
  );
}
