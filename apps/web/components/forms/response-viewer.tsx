"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Download, Inbox } from "lucide-react";
import type { FormEditor, ResponseItem } from "@repo/trpc/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { trpc } from "~/trpc/client";
import { apiEndpoint } from "~/lib/api-endpoint";
import { ResponseOverview } from "./response-overview";
export function ResponseViewer({ form }: { form: FormEditor }) {
  const [cursors, setCursors] = useState<string[]>([]),
    [selected, setSelected] = useState<ResponseItem | null>(null),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [downloading, setDownloading] = useState(false);
  const { getToken } = useAuth(),
    base = "/dashboard/workspaces/" + form.workspaceId + "/forms/" + form.id;
  const responses = trpc.forms.responses.useQuery(
    { workspaceId: form.workspaceId, formId: form.id, limit: 20, before: cursors.at(-1) },
    { retry: false },
  );
  const utils = trpc.useUtils();
  async function exportPage() {
    setDownloading(true);
    setError("");
    try {
      const result = await utils.forms.exportPage.fetch({
        workspaceId: form.workspaceId,
        formId: form.id,
        limit: 20,
        before: cursors.at(-1),
      });
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" })),
        link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn’t export this page.");
    } finally {
      setDownloading(false);
    }
  }
  const items = (responses.data?.items ?? []).filter(
    (response) =>
      !search ||
      response.answers.some((answer) =>
        (answer.label + " " + answer.text).toLowerCase().includes(search.toLowerCase()),
      ),
  );
  async function download(fileId: string) {
    setDownloading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(
        apiEndpoint(`/api/workspaces/${form.workspaceId}/forms/${form.id}/files/${fileId}`),
        { headers: token ? { Authorization: "Bearer " + token } : {} },
      );
      if (!response.ok) throw new Error("We couldn’t download this file. Please try again.");
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      const disposition = response.headers.get("Content-Disposition"),
        encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      link.download = encoded ? decodeURIComponent(encoded) : "response-attachment";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }
  return (
    <section>
      <Link href={base} className="text-sm text-muted-foreground underline underline-offset-4">
        Back to form editor
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Every response tells a story.
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Responses</h1>
          <p className="mt-3 break-words text-sm text-muted-foreground">{form.definition.title}</p>
        </div>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={responses.isFetching}
          onClick={() => {
            void responses.refetch();
            void utils.forms.summary.invalidate({ workspaceId: form.workspaceId, formId: form.id });
          }}
        >
          Refresh responses
        </Button>
      </div>
      <ResponseOverview workspaceId={form.workspaceId} formId={form.id} />
      {form.canExport ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-lg text-xs leading-6 text-muted-foreground">
            CSV exports include every answer on this response page, including responses hidden by
            your page search. Each question is a separate row with its original version.
          </p>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={downloading || responses.isPending || !responses.data?.items.length}
            onClick={() => void exportPage()}
          >
            <Download aria-hidden="true" />
            Export this page
          </Button>
        </div>
      ) : null}
      {error && !selected ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-8 max-w-md space-y-2">
        <label htmlFor="response-search" className="text-sm font-medium">
          Search this page
        </label>
        <Input
          id="response-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search questions or answers"
          className="min-h-11"
        />
      </div>
      {responses.isPending ? (
        <p role="status" className="py-16 text-center text-muted-foreground">
          Loading responses…
        </p>
      ) : responses.error ? (
        <p role="alert" className="mt-6 rounded-xl border p-6">
          {responses.error.message}
        </p>
      ) : items.length ? (
        <ul className="mt-6 space-y-3">
          {items.map((response) => (
            <li key={response.id}>
              <button
                type="button"
                className="w-full rounded-xl border bg-card p-5 text-left transition-colors hover:border-input"
                onClick={() => setSelected(response)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {new Date(response.completedAt).toLocaleString()}
                  </span>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">
                    Version {response.versionNumber}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  {response.answers.slice(0, 2).map((answer) => (
                    <div key={answer.fieldKey} className="min-w-0">
                      <dt className="truncate text-xs text-muted-foreground">{answer.label}</dt>
                      <dd className="mt-1 line-clamp-2 break-words text-sm">
                        {answer.text || "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
                <span className="mt-4 inline-block text-xs underline underline-offset-4">
                  View response
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed p-12 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-semibold">
            {search
              ? "No matching responses on this page"
              : "Your next conversation is on its way."}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {search
              ? "Try a different search or another page."
              : form.publishedVersionId
                ? "Share your published form to start collecting responses."
                : "Publish your form and share its link to collect the first response."}
          </p>
        </div>
      )}
      {cursors.length || responses.data?.nextCursor ? (
        <nav aria-label="Response pages" className="mt-6 flex items-center justify-between gap-4">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!cursors.length || responses.isFetching}
            onClick={() => {
              setCursors((previous) => previous.slice(0, -1));
              setSearch("");
            }}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {cursors.length + 1}</span>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!responses.data?.nextCursor || responses.isFetching}
            onClick={() => {
              const cursor = responses.data?.nextCursor;
              if (cursor) {
                setCursors((previous) => [...previous, cursor]);
                setSearch("");
              }
            }}
          >
            Next
          </Button>
        </nav>
      ) : null}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setError("");
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Response details</DialogTitle>
            <DialogDescription>
              {selected ? selected.formTitle + " · Version " + selected.versionNumber : ""}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <>
              <p className="text-xs text-muted-foreground">
                Received {new Date(selected.completedAt).toLocaleString()}
              </p>
              <dl className="space-y-5">
                {selected.answers.map((answer) => (
                  <div key={answer.fieldKey} className="min-w-0 border-t pt-4">
                    <dt className="text-sm font-medium">{answer.label}</dt>
                    <dd className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
                      {answer.text || "—"}
                    </dd>
                    {answer.fileIds.map((id, index) => (
                      <Button
                        key={id}
                        variant="outline"
                        className="mt-2 min-h-11"
                        disabled={downloading}
                        onClick={() => void download(id)}
                      >
                        <Download className="size-4" aria-hidden="true" />
                        Download file {index + 1}
                      </Button>
                    ))}
                  </div>
                ))}
              </dl>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
