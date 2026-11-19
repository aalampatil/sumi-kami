import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { TRPCClientError } from "@trpc/client";
import { notFound } from "next/navigation";
import { createServerApi } from "~/trpc/server";
import { DashboardShell } from "~/components/dashboard/shell";
import { ResponseViewer } from "~/components/forms/response-viewer";
async function Responses({ params }: { params: Promise<{ workspaceId: string; formId: string }> }) {
  await auth.protect();
  const scope = await params;
  const api = await createServerApi();
  let form;
  try {
    form = await api.forms.get.query(scope);
  } catch (error) {
    if (
      error instanceof TRPCClientError &&
      ["NOT_FOUND", "BAD_REQUEST"].includes(error.data?.code ?? "")
    )
      notFound();
    throw error;
  }
  return (
    <DashboardShell>
      <ResponseViewer form={form} />
    </DashboardShell>
  );
}
export default function ResponsesPage({
  params,
}: {
  params: Promise<{ workspaceId: string; formId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main role="status" className="p-10">
          Opening responses…
        </main>
      }
    >
      <Responses params={params} />
    </Suspense>
  );
}
