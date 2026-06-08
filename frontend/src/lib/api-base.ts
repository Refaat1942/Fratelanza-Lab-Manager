/** Resolve API base URL — in production browser always use same-origin /api/v1 proxy */
export function getApiBaseUrl(): string {
  const env = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    const envIsLocal = env.includes("localhost") || env.includes("127.0.0.1");

    if (!isLocal && envIsLocal) {
      return `${window.location.origin}/api/v1`;
    }
    if (!envIsLocal) {
      return env;
    }
    return `${window.location.origin}/api/v1`;
  }

  return env;
}
