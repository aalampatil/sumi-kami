import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteShell } from "~/components/site/shell";
import { AcceptInvitation } from "~/components/workspaces/accept-invitation";
import { AccountApiProvider } from "~/providers/account-api";
export const metadata: Metadata = {
  title: "Workspace invitation · Sumikami",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Invite() {
  return (
    <SiteShell>
      <main id="main-content" className="mx-auto w-full max-w-xl px-6 py-24">
        <Suspense fallback={<p role="status">Opening invitation…</p>}>
          <AccountApiProvider>
            <AcceptInvitation />
          </AccountApiProvider>
        </Suspense>
      </main>
    </SiteShell>
  );
}
