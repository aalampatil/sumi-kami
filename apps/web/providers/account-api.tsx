"use client";
import { useAuth } from "@clerk/nextjs";
import { useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc } from "~/trpc/client";
import { createTRPCHttpBatchClientClient } from "~/trpc/create-client";
function Identity({ children }: { children: ReactNode }) {
  const { getToken } = useAuth(),
    [queries] = useState(() => new QueryClient());
  const client = useMemo(
    () => trpc.createClient({ links: [createTRPCHttpBatchClientClient({ getToken })] }),
    [getToken],
  );
  return (
    <QueryClientProvider client={queries}>
      <trpc.Provider queryClient={queries} client={client}>
        {children}
      </trpc.Provider>
    </QueryClientProvider>
  );
}
export function AccountApiProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  return <Identity key={userId ?? "signed-out"}>{children}</Identity>;
}
