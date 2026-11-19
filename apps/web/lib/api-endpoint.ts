export function apiEndpoint(path: `/api/${string}`): URL {
  const target = new URL(process.env.NEXT_PUBLIC_API_URL ?? "/trpc", window.location.origin);
  target.pathname = path;
  target.search = "";
  target.hash = "";
  return target;
}
