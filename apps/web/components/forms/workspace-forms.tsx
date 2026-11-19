"use client";
import { useState, type FormEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ArrowUpRight, Copy, FileText, Plus } from "lucide-react";
import type { WorkspaceSummary } from "@repo/trpc/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { trpc } from "~/trpc/client";

export function WorkspaceForms({ workspace }: { workspace: WorkspaceSummary }) {
  const { isLoaded, isSignedIn } = useAuth(),
    ready = isLoaded && isSignedIn,
    canEdit = workspace.role !== "VIEWER";
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [cursors, setCursors] = useState<{ cursorCreatedAt: string; cursorId: string }[]>([]),
    [message, setMessage] = useState("");
  const router = useRouter(),
    utils = trpc.useUtils(),
    base = "/dashboard/workspaces/" + workspace.id + "/forms/";
  const list = trpc.forms.list.useQuery(
    { workspaceId: workspace.id, limit: 20, ...cursors.at(-1) },
    { enabled: ready, retry: false },
  );
  const create = trpc.forms.create.useMutation({
    onSuccess: async (form) => {
      await utils.forms.list.invalidate();
      setOpen(false);
      router.push(base + form.id);
    },
  });
  const archive = trpc.forms.archive.useMutation({
    onSuccess: () => utils.forms.list.invalidate(),
  });
  const duplicate = trpc.forms.duplicate.useMutation({
    onSuccess: async (form) => {
      await utils.forms.list.invalidate();
      router.push(base + form.id);
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    create.mutate({ workspaceId: workspace.id, title: title.trim() });
  }
  const busy = create.isPending || archive.isPending || duplicate.isPending;
  return (
    <section className="py-8" aria-labelledby="forms-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="forms-heading" className="text-xl font-semibold">
            Your forms
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            From the first question to the next conversation.
          </p>
        </div>
        {ready && canEdit ? (
          <Dialog
            open={open}
            onOpenChange={(value) => {
              if (!create.isPending) {
                setOpen(value);
                if (value) {
                  setTitle("");
                  create.reset();
                }
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="min-h-11">
                <Plus aria-hidden="true" />
                Create form
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a form</DialogTitle>
                <DialogDescription>
                  Start with a title. Add your questions in the editor.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="mt-3 space-y-5">
                <div className="space-y-2">
                  <label htmlFor="new-form-title" className="text-sm font-medium">
                    Form title
                  </label>
                  <Input
                    id="new-form-title"
                    value={title}
                    maxLength={200}
                    autoFocus
                    required
                    disabled={create.isPending}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Customer feedback"
                    className="min-h-11"
                  />
                </div>
                {create.error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {create.error.message}
                  </p>
                ) : null}
                <Button type="submit" className="min-h-11" disabled={create.isPending}>
                  {create.isPending ? "Creating form…" : "Create form"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
      {!ready || list.isPending ? (
        <p role="status" className="py-16 text-center text-muted-foreground">
          Loading forms…
        </p>
      ) : list.error ? (
        <div role="alert" className="mt-6 rounded-xl border bg-card p-6">
          <p>{list.error.message}</p>
          <Button onClick={() => void list.refetch()} variant="outline" className="mt-4 min-h-11">
            Try again
          </Button>
        </div>
      ) : list.data.items.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.data.items.map((form) => (
            <article key={form.id} className="min-w-0 rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                  <FileText className="size-5" aria-hidden="true" />
                </span>
                <span className="rounded-full border px-2.5 py-1 text-xs">
                  {form.archived
                    ? "Archived"
                    : form.published
                      ? form.hasDraft
                        ? "Published · draft changes"
                        : "Published"
                      : "Draft"}
                </span>
              </div>
              <Link
                href={base + form.id}
                className="mt-5 flex items-start justify-between gap-3 font-semibold"
              >
                <h3 className="break-words text-lg">{form.title}</h3>
                <ArrowUpRight className="mt-1 size-4 shrink-0" aria-hidden="true" />
              </Link>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <Link
                  href={base + form.id + "/responses"}
                  className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                >
                  {form.responseCount} {form.responseCount === 1 ? "response" : "responses"}
                </Link>
                {canEdit ? (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      disabled={busy}
                      aria-label={"Duplicate " + form.title}
                      onClick={() => {
                        setMessage("");
                        duplicate.mutate(
                          { workspaceId: workspace.id, formId: form.id },
                          { onError: (error) => setMessage(error.message) },
                        );
                      }}
                    >
                      <Copy className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      disabled={busy}
                      aria-label={(form.archived ? "Restore " : "Archive ") + form.title}
                      onClick={() => {
                        setMessage("");
                        archive.mutate(
                          { workspaceId: workspace.id, formId: form.id, archived: !form.archived },
                          { onError: (error) => setMessage(error.message) },
                        );
                      }}
                    >
                      <Archive className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed px-6 py-16 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-4 font-semibold">Your next question starts here.</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {canEdit
              ? "Create a form, make it your own, and share it with the people who matter."
              : "An owner, admin, or editor can create the first form in this workspace."}
          </p>
        </div>
      )}
      {message ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {message}
        </p>
      ) : null}
      {cursors.length || list.data?.nextCursor ? (
        <nav aria-label="Form pages" className="mt-6 flex justify-between gap-4">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!cursors.length || list.isFetching}
            onClick={() => setCursors((previous) => previous.slice(0, -1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!list.data?.nextCursor || list.isFetching}
            onClick={() => {
              const next = list.data?.nextCursor;
              if (next)
                setCursors((previous) => [
                  ...previous,
                  { cursorCreatedAt: next.createdAt, cursorId: next.id },
                ]);
            }}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
