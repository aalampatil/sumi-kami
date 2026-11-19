import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { SiteShell } from "~/components/site/shell";

export default function SignUpPage() {
  return (
    <SiteShell>
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-16">
        <Suspense>
          <SignUp />
        </Suspense>
      </main>
    </SiteShell>
  );
}
