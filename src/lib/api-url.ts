const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

/**
 * Builds the URL for Spark Vision API calls.
 *
 * In the **browser**, always use same-origin paths like `/api/...` so Next.js `rewrites`
 * (see `next.config.ts`) forward to SparkVision-Backend. This avoids CORS issues and
 * wrong hosts when the backend only runs on localhost.
 *
 * On the **server** (SSR / server actions), use `NEXT_PUBLIC_API_BASE_URL` or the local
 * backend fallback so `fetch` can reach Nest directly.
 */
export function toApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  console.log(API_BASE_URL);

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window !== "undefined") {
    return normalizedPath;
  }

  if (API_BASE_URL) {
    return `${API_BASE_URL}${normalizedPath}`;
  }

  return `http://127.0.0.1:5000${normalizedPath}`;
}
