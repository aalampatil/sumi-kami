"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "~/trpc/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
type MemberRole = "ADMIN" | "EDITOR" | "VIEWER";
export function WorkspaceMembers({ workspaceId }: { workspaceId: string }) {
  const team = trpc.members.list.useQuery({ workspaceId }, { retry: false }),
    utils = trpc.useUtils(),
    router = useRouter();
  const [email, setEmail] = useState(""),
    [role, setRole] = useState<MemberRole>("EDITOR"),
    [link, setLink] = useState(""),
    [error, setError] = useState("");
  const refresh = async () => {
    await Promise.all([
      utils.members.list.invalidate({ workspaceId }),
      utils.workspaces.list.invalidate(),
    ]);
    router.refresh();
  };
  const invite = trpc.members.invite.useMutation({
    onSuccess: async (data) => {
      setLink(window.location.origin + "/invite#" + data.token);
      setEmail("");
      await refresh();
    },
    onError: (error) => setError(error.message),
  });
  const update = trpc.members.update.useMutation({
      onSuccess: refresh,
      onError: (error) => setError(error.message),
    }),
    remove = trpc.members.remove.useMutation({
      onSuccess: refresh,
      onError: (error) => setError(error.message),
    }),
    revoke = trpc.members.revoke.useMutation({
      onSuccess: refresh,
      onError: (error) => setError(error.message),
    });
  const busy = invite.isPending || update.isPending || remove.isPending || revoke.isPending;
  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLink("");
    invite.mutate({ workspaceId, email, role });
  }
  return (
    <section className="py-8">
      <h2 className="text-xl font-semibold">People in this workspace</h2>
      <p className="mt-2 text-sm text-muted-foreground">A shared space for thoughtful work.</p>
      {team.isPending ? (
        <p className="py-12" role="status">
          Loading your team…
        </p>
      ) : team.error ? (
        <p className="mt-5" role="alert">
          {team.error.message}
        </p>
      ) : (
        <>
          <ul className="mt-6 divide-y rounded-xl border bg-card px-5">
            {team.data.members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-4 py-5"
              >
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-medium">{member.name}</h3>
                  {member.email ? (
                    <p className="mt-1 break-all text-xs text-muted-foreground">{member.email}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {team.data.canManage && member.role !== "OWNER" ? (
                    <>
                      <select
                        aria-label={"Role for " + member.name}
                        disabled={busy}
                        className="min-h-11 rounded-md border border-input bg-card px-3 text-sm"
                        value={member.role}
                        onChange={(event) => {
                          setError("");
                          update.mutate({
                            workspaceId,
                            userId: member.userId,
                            role: event.target.value as MemberRole,
                          });
                        }}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                      <Button
                        variant="ghost"
                        className="min-h-11"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm("Remove this member’s access to the workspace?")) {
                            setError("");
                            remove.mutate({ workspaceId, userId: member.userId });
                          }
                        }}
                      >
                        Remove<span className="sr-only"> {member.name}</span>
                      </Button>
                    </>
                  ) : (
                    <span className="rounded-full bg-secondary px-3 py-1.5 text-xs">
                      {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {team.data.canManage ? (
            <>
              <form onSubmit={submit} className="mt-10 rounded-xl border bg-card p-6">
                <h3 className="text-base font-semibold">Invite someone</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Create a link and share it with your teammate. They must sign in with the matching
                  verified primary email. Links expire in seven days.
                </p>
                <div className="mt-5 grid items-end gap-4 sm:grid-cols-[1fr_140px_auto]">
                  <div className="space-y-2">
                    <label htmlFor="invite-email" className="text-sm font-medium">
                      Email address
                    </label>
                    <Input
                      id="invite-email"
                      type="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={busy}
                      className="min-h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="invite-role" className="text-sm font-medium">
                      Role
                    </label>
                    <select
                      id="invite-role"
                      className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                      value={role}
                      onChange={(event) => setRole(event.target.value as MemberRole)}
                      disabled={busy}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  </div>
                  <Button type="submit" className="min-h-11" disabled={busy}>
                    {invite.isPending ? "Creating…" : "Create invitation"}
                  </Button>
                </div>
                {link ? (
                  <div className="mt-5 space-y-2">
                    <label htmlFor="invite-link" className="text-sm font-medium">
                      Invitation link
                    </label>
                    <div className="flex gap-2">
                      <Input id="invite-link" value={link} readOnly className="min-h-11" />
                      <Button
                        variant="outline"
                        type="button"
                        className="min-h-11"
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(link)
                            .catch(() => setError("Select and copy the invitation link above."))
                        }
                      >
                        Copy link
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground" role="status">
                      Invitation created. Copy this link now; it is shown only once.
                    </p>
                  </div>
                ) : null}
              </form>
              {team.data.invitations.length ? (
                <section className="mt-8">
                  <h3 className="text-base font-semibold">Pending invitations</h3>
                  <ul className="mt-4 divide-y rounded-xl border bg-card px-5">
                    {team.data.invitations.map((invite) => (
                      <li
                        key={invite.id}
                        className="flex flex-wrap items-center justify-between gap-4 py-4"
                      >
                        <div>
                          <p className="break-all text-sm font-medium">{invite.email}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {invite.role.toLowerCase()} · Expires{" "}
                            {new Date(invite.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="min-h-11"
                          disabled={busy}
                          onClick={() => revoke.mutate({ workspaceId, invitationId: invite.id })}
                        >
                          Revoke<span className="sr-only"> invitation for {invite.email}</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
          <div className="mt-8 grid gap-4 text-xs leading-6 text-muted-foreground sm:grid-cols-3">
            <p>
              <strong className="text-foreground">Admins</strong> manage settings, people, forms,
              and responses.
            </p>
            <p>
              <strong className="text-foreground">Editors</strong> build and publish forms, review
              responses, and export results.
            </p>
            <p>
              <strong className="text-foreground">Viewers</strong> read forms and responses,
              including attachments.
            </p>
          </div>
        </>
      )}
      {error ? (
        <p role="alert" className="mt-5 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
