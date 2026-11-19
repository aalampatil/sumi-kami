"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { trpc } from "~/trpc/client";
import { createTRPCHttpBatchClientClient } from "~/trpc/create-client";
export function PublicApiProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  const [client] = useState(() =>
    trpc.createClient({ links: [createTRPCHttpBatchClientClient({ anonymous: true })] }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider queryClient={queryClient} client={client}>
        {children}
      </trpc.Provider>
    </QueryClientProvider>
  );
}
