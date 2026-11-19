"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { trpc } from "~/trpc/client";
import { Button } from "~/components/ui/button";
export function AcceptInvitation() {
  const { isLoaded, isSignedIn } = useAuth(),
    [token, setToken] = useState<string | null>(null),
    accept = trpc.members.accept.useMutation();
  useEffect(() => {
    const read = () => setToken(window.location.hash.slice(1));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  if (accept.data)
    return (
      <>
        <h1 className="font-serif text-4xl">A new space to create.</h1>
        <p className="mt-5 text-muted-foreground">You now have access to the workspace.</p>
        <Button asChild className="mt-7 min-h-12">
          <Link href={"/dashboard/workspaces/" + accept.data.workspaceId}>Open workspace ↗</Link>
        </Button>
      </>
    );
  return (
    <>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        AN INVITATION TO WORK TOGETHER
      </p>
      <h1 className="mt-5 font-serif text-4xl">There’s a place for you here.</h1>
      <p className="mt-5 leading-8 text-muted-foreground">
        Sign in with the verified primary email your workspace invitation was created for, then
        accept to join.
      </p>
      {!isLoaded || token === null ? (
        <p role="status" className="mt-6">
          Loading invitation…
        </p>
      ) : !token || !/^[a-f0-9]{64}$/.test(token) ? (
        <p className="mt-6" role="alert">
          Open the complete invitation link shared by your workspace admin.
        </p>
      ) : !isSignedIn ? (
        <SignInButton mode="modal">
          <Button className="mt-7 min-h-12">Sign in to join</Button>
        </SignInButton>
      ) : (
        <Button
          className="mt-7 min-h-12"
          disabled={accept.isPending}
          onClick={() => accept.mutate({ token })}
        >
          {accept.isPending ? "Joining…" : "Accept invitation"}
        </Button>
      )}
      {accept.error ? (
        <p role="alert" className="mt-5 text-sm text-destructive">
          {accept.error.message}
        </p>
      ) : null}
    </>
  );
}
