"use client";
import { trpc } from "~/trpc/client";
export function ResponseOverview({ workspaceId, formId }: { workspaceId: string; formId: string }) {
  const summary = trpc.forms.summary.useQuery({ workspaceId, formId }, { retry: false });
  if (summary.isPending)
    return (
      <p role="status" className="mt-8 text-sm text-muted-foreground">
        Loading response activity…
      </p>
    );
  if (summary.error)
    return (
      <p role="alert" className="mt-8 text-sm">
        {summary.error.message}
      </p>
    );
  const { total, recent, daily, versions } = summary.data,
    max = Math.max(1, ...daily.map((day) => day.count));
  return (
    <section aria-label="Response activity" className="mt-8 rounded-xl border bg-card p-5 sm:p-6">
      <div className="grid grid-cols-2 gap-5">
        <div>
          <p className="text-xs text-muted-foreground">Available responses</p>
          <p className="mt-2 font-serif text-4xl">{total}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Received in the last 7 days</p>
          <p className="mt-2 font-serif text-4xl">{recent}</p>
        </div>
      </div>
      <figure className="mt-6 border-t pt-5">
        <figcaption className="text-xs text-muted-foreground">
          Responses per day · Last 14 days · UTC
        </figcaption>
        <ol className="mt-4 flex h-24 items-end gap-2">
          {daily.map((day) => (
            <li
              key={day.date}
              className="flex h-full min-w-0 flex-1 items-end"
              title={day.date + ": " + day.count}
            >
              <div
                aria-hidden="true"
                className="w-full rounded-t-sm bg-primary/75"
                style={{ height: (day.count ? Math.max(5, (day.count / max) * 100) : 2) + "%" }}
              />
              <span className="sr-only">
                {day.date}: {day.count} responses
              </span>
            </li>
          ))}
        </ol>
        <div
          className="mt-2 flex justify-between text-[10px] text-muted-foreground"
          aria-hidden="true"
        >
          <span>{daily[0]?.date}</span>
          <span>{daily.at(-1)?.date}</span>
        </div>
      </figure>
      {versions.length ? (
        <details className="mt-5 border-t pt-4">
          <summary className="min-h-11 cursor-pointer text-sm">Responses by version</summary>
          <ul className="mt-2 space-y-2 text-sm">
            {versions.map((version) => (
              <li className="flex justify-between gap-4" key={version.versionNumber}>
                <span className="truncate">
                  Version {version.versionNumber} · {version.title}
                </span>
                <span>{version.count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Up to the 50 most recent versions with available responses. Each response keeps its
            original questions.
          </p>
        </details>
      ) : null}
    </section>
  );
}
