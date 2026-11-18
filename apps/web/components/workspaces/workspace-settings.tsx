"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { WorkspaceSummary } from "@repo/trpc/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { trpc } from "~/trpc/client";

export function WorkspaceSettings({ workspace }: { workspace: WorkspaceSummary }) {
  const [name, setName] = useState(workspace.name);
  const [retention, setRetention] = useState(workspace.retentionDays?.toString() ?? "");
  const [validationError, setValidationError] = useState("");
  const router = useRouter();
  const utils = trpc.useUtils();
  const canManage = workspace.role === "OWNER" || workspace.role === "ADMIN";
  const update = trpc.workspaces.update.useMutation({
    onSuccess: async (saved) => {
      setName(saved.name);
      await utils.workspaces.list.invalidate();
      toast.success("Workspace settings saved.");
      router.refresh();
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setValidationError("Enter a workspace name.");
      return;
    }
    setValidationError("");
    update.mutate({
      workspaceId: workspace.id,
      name: name.trim(),
      retentionDays: retention === "" ? null : Number(retention),
    });
  }
  return (
    <section
      className="mt-8 max-w-2xl rounded-xl border bg-card p-6 sm:p-8"
      aria-labelledby="settings-heading"
    >
      <h2 id="settings-heading" className="text-lg font-semibold">
        Workspace settings
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {canManage
          ? "Manage the details that keep your workspace organized."
          : "You can view this workspace. An owner or admin can change its settings."}
      </p>
      <form onSubmit={submit} className="mt-7 space-y-6">
        <fieldset disabled={!canManage || update.isPending} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="settings-name" className="text-sm font-medium">
              Workspace name
            </label>
            <Input
              id="settings-name"
              name="name"
              required
              maxLength={160}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11"
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? "settings-error" : undefined}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="settings-retention" className="text-sm font-medium">
              Response retention (days)
            </label>
            <Input
              id="settings-retention"
              name="retentionDays"
              type="number"
              min={1}
              max={99999}
              step={1}
              value={retention}
              onChange={(event) => setRetention(event.target.value)}
              className="min-h-11"
              aria-describedby="retention-help"
            />
            <p id="retention-help" className="text-xs leading-5 text-muted-foreground">
              Leave empty for no default expiry. Changes apply to future submissions; existing
              responses keep their original retention.
            </p>
          </div>
        </fieldset>
        {validationError || update.error ? (
          <p id="settings-error" role="alert" className="text-sm text-destructive">
            {validationError ||
              (update.error?.data?.code === "FORBIDDEN"
                ? "Your role has changed. Reload to see your current access."
                : "We couldn’t save the settings. Please try again.")}
          </p>
        ) : null}
        {canManage ? (
          <Button type="submit" className="min-h-11" disabled={update.isPending}>
            {update.isPending ? "Saving settings…" : "Save settings"}
          </Button>
        ) : null}
      </form>
    </section>
  );
}
