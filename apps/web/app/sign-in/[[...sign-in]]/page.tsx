import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { SiteShell } from "~/components/site/shell";

export default function SignInPage() {
  return (
    <SiteShell>
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-16">
        <Suspense>
          <SignIn />
        </Suspense>
      </main>
    </SiteShell>
  );
}
