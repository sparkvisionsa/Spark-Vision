import { toApiUrl } from "@/lib/api-url";

export type ApiClientOptions = RequestInit & {
  query?: Record<string, string | number | boolean | undefined | null>;
};
function buildUrl(path: string, query?: ApiClientOptions["query"]) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, "http://167.71.231.64");

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  return `${url.pathname}${url.search}`;
}

export async function apiClient<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const url = toApiUrl(buildUrl(path, options.query));
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // Ignore non-JSON error payloads.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
