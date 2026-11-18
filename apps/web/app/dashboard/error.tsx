"use client";
import { Button } from "~/components/ui/button";
export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-2xl font-semibold">We couldn’t open your workspace.</h1>
      <p className="mt-3 text-muted-foreground">Please try again in a moment.</p>
      <Button onClick={reset} className="mt-6 min-h-11">
        Try again
      </Button>
    </main>
  );
}
