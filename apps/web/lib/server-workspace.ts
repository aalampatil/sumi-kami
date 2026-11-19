import "server-only";
import { auth } from "@clerk/nextjs/server";
import { TRPCClientError } from "@trpc/client";
import { notFound } from "next/navigation";
import { createServerApi } from "~/trpc/server";
export async function workspaceForPage(workspaceId: string) {
  await auth.protect();
  const api = await createServerApi();
  try {
    return await api.workspaces.get.query({ workspaceId });
  } catch (error) {
    if (
      error instanceof TRPCClientError &&
      ["NOT_FOUND", "BAD_REQUEST"].includes(error.data?.code ?? "")
    )
      notFound();
    throw error;
  }
}
