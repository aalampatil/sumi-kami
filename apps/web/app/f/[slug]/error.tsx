"use client";
export default function PublicFormError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-3xl font-semibold">We couldn’t open this form.</h1>
      <p className="mt-4 text-muted-foreground">Please try again in a moment.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 min-h-11 rounded-md bg-primary px-5 text-sm text-primary-foreground"
      >
        Try again
      </button>
    </main>
  );
}
