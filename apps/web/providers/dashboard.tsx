"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "~/trpc/client";
import { createTRPCHttpBatchClientClient } from "~/trpc/create-client";

function IdentityData({
  children,
  getToken,
}: {
  children: ReactNode;
  getToken: () => Promise<string | null>;
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30000 } } }),
  );
  const client = useMemo(
    () => trpc.createClient({ links: [createTRPCHttpBatchClientClient({ getToken })] }),
    [getToken],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider queryClient={queryClient} client={client}>
        {children}
      </trpc.Provider>
    </QueryClientProvider>
  );
}
export function DashboardProviders({
  children,
  serverUserId,
}: {
  children: ReactNode;
  serverUserId: string;
}) {
  const { isLoaded, userId, getToken } = useAuth(),
    router = useRouter();
  const refreshed = useRef<string | null>(null);
  const matches = isLoaded && userId === serverUserId;
  useEffect(() => {
    if (!isLoaded) return;
    if (userId === serverUserId) {
      refreshed.current = null;
      return;
    }
    const mismatch = (userId ?? "anonymous") + ":" + serverUserId;
    if (refreshed.current !== mismatch) {
      refreshed.current = mismatch;
      router.refresh();
    }
  }, [isLoaded, userId, serverUserId, router]);
  if (!matches)
    return (
      <main className="p-10" role="status">
        Loading your account…
        {isLoaded ? (
          <button type="button" className="ml-4 underline" onClick={() => router.refresh()}>
            Reload account
          </button>
        ) : null}
      </main>
    );
  return (
    <IdentityData key={userId} getToken={getToken}>
      {children}
    </IdentityData>
  );
}
