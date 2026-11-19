import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TRPCClientError } from "@trpc/client";
import { createPublicServerApi } from "~/trpc/server";
import { PublicApiProvider } from "~/providers/public-api";
import { RespondentForm } from "~/components/forms/respondent-form";
export const metadata: Metadata = {
  title: "A form by Sumikami",
  robots: { index: false, follow: false },
};
async function Published({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let form;
  try {
    form = await createPublicServerApi().public.form.query({ slug });
  } catch (error) {
    if (
      error instanceof TRPCClientError &&
      ["NOT_FOUND", "BAD_REQUEST"].includes(error.data?.code ?? "")
    )
      notFound();
    throw error;
  }
  return (
    <PublicApiProvider>
      <RespondentForm definition={form.definition} published={form} />
    </PublicApiProvider>
  );
}
export default function PublishedFormPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense
      fallback={
        <main role="status" className="mx-auto max-w-xl p-10">
          Opening your form…
        </main>
      }
    >
      <Published params={params} />
    </Suspense>
  );
}
