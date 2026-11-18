export function localDevelopmentDatabase(value: string | undefined): URL {
  if (!value) throw new Error("Configure the API development DATABASE_URL first.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The local database URL is invalid.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !url.pathname.endsWith("_dev")
  )
    throw new Error("Workspace setup requires a loopback PostgreSQL database ending in _dev.");
  return url;
}
