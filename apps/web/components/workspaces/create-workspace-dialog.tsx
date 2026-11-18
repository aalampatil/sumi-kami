"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { suggestWorkspaceSlug } from "~/lib/workspace-slug";
import { trpc } from "~/trpc/client";

export function CreateWorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [customSlug, setCustomSlug] = useState(false);
  const [validationError, setValidationError] = useState("");
  const router = useRouter();
  const utils = trpc.useUtils();
  const create = trpc.workspaces.create.useMutation({
    onSuccess: async (workspace) => {
      await utils.workspaces.list.invalidate();
      setOpen(false);
      toast.success("Workspace created.");
      router.push("/dashboard/workspaces/" + workspace.id);
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setValidationError("Enter a workspace name.");
      return;
    }
    setValidationError("");
    create.mutate({ name: name.trim(), slug });
  }
  function changeOpen(value: boolean) {
    if (create.isPending) return;
    setOpen(value);
    if (value) {
      setName("");
      setSlug("");
      setCustomSlug(false);
      setValidationError("");
      create.reset();
    }
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button className="min-h-11">
          <Plus aria-hidden="true" />
          Create workspace
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            className="absolute top-2 right-2 size-11"
            aria-label="Close workspace dialog"
            disabled={create.isPending}
          >
            <X aria-hidden="true" />
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle>Create a workspace</DialogTitle>
          <DialogDescription>Give your forms and your team a place to call home.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="mt-3 space-y-5">
          <fieldset disabled={create.isPending} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="workspace-name" className="text-sm font-medium">
                Workspace name
              </label>
              <Input
                id="workspace-name"
                name="name"
                autoComplete="organization"
                autoFocus
                required
                maxLength={160}
                value={name}
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? "workspace-create-error" : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!customSlug) setSlug(suggestWorkspaceSlug(event.target.value));
                }}
                placeholder="e.g. Design studio"
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="workspace-slug" className="text-sm font-medium">
                Workspace address
              </label>
              <Input
                id="workspace-slug"
                name="slug"
                required
                maxLength={120}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={slug}
                onChange={(event) => {
                  setCustomSlug(true);
                  setSlug(event.target.value);
                }}
                aria-invalid={create.error?.data?.code === "CONFLICT"}
                aria-describedby={
                  create.error?.data?.code === "CONFLICT"
                    ? "workspace-slug-help workspace-create-error"
                    : "workspace-slug-help"
                }
                className="min-h-11"
              />
              <p id="workspace-slug-help" className="text-xs leading-5 text-muted-foreground">
                Use lowercase letters, numbers, and single hyphens. This address stays the same
                after creation.
              </p>
            </div>
          </fieldset>
          {validationError || create.error ? (
            <p id="workspace-create-error" role="alert" className="text-sm text-destructive">
              {validationError ||
                (create.error?.data?.code === "CONFLICT"
                  ? "That workspace address is already in use. Try another."
                  : "We couldn’t create the workspace. Please try again.")}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={create.isPending}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={create.isPending}>
              {create.isPending ? "Creating workspace…" : "Create workspace"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
