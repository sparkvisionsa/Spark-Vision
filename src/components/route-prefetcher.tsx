"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthTracking } from "@/components/auth-tracking-provider";

function isChunkLoadError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /ChunkLoadError|Loading chunk .* failed/i.test(msg);
}

function coerceErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === "string") return err;
  // Next dev overlay sometimes gives Event objects
  if (err && typeof err === "object" && "type" in err) return `[event] ${(err as { type?: unknown }).type ?? ""}`;
  return String(err ?? "");
}

let didReloadAfterChunkError = false;

const BASE_ROUTES = [
  "/evaluation-source",
  "/evaluation-source/cars",
  "/evaluation-source/real-estate",
  "/evaluation-source/other",
  "/profile",
];

/** Value Tech section routes – prefetch so navigation from sidebar is instant */
const VALUE_TECH_ROUTES = [
  "/value-tech",
  "/value-tech-app",
  "/real-estate-valuation",
  "/machine-valuation",
  "/machine-valuation/projects",
  "/clients",
  "/settings",
];

const WORKSPACE_PRELOADERS: Partial<Record<string, () => Promise<unknown>>> = {
  "/value-tech": () => import("@/components/workspace/workspace-sections/value-tech-hub"),
  "/value-tech-app": () => import("@/components/workspace/workspace-sections/value-tech-app"),
  "/real-estate-valuation": () => import("@/components/workspace/workspace-sections/real-estate-valuation"),
  "/machine-valuation": () => import("@/components/workspace/workspace-sections/machine-valuation/index"),
  "/machine-valuation/projects": () => import("@/components/workspace/workspace-sections/machine-valuation/index"),
  "/clients": () => import("@/components/workspace/workspace-sections/clients"),
  "/settings": () => import("@/components/workspace/workspace-sections/settings"),
  "/evaluation-source": () => import("@/components/workspace/workspace-sections/evaluation-source-index"),
  "/evaluation-source/cars": () => import("@/components/workspace/workspace-sections/evaluation-source-cars"),
  "/evaluation-source/real-estate": () =>
    import("@/components/workspace/workspace-sections/evaluation-source-real-estate"),
  "/evaluation-source/other": () =>
    import("@/components/workspace/workspace-sections/evaluation-source-other"),
};

export default function RoutePrefetcher() {
  const router = useRouter();
  const { user } = useAuthTracking();

  const routes = useMemo(() => {
    const base = [...BASE_ROUTES, ...VALUE_TECH_ROUTES];
    if (user?.role === "super_admin") {
      return [...base, "/admin"];
    }
    return base;
  }, [user?.role]);

  useEffect(() => {
    // In development, frequent rebuilds (HMR) change chunk names and can cause ChunkLoadError
    // when we aggressively prefetch + dynamic import many routes. Disable to keep dev stable.
    if (process.env.NODE_ENV === "development") return;

    const timeoutHandles: number[] = [];
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const staggerMs = 200;

    const startPrefetch = () => {
      routes.forEach((route, index) => {
        const handle = window.setTimeout(() => {
          void (async () => {
            try {
              await router.prefetch(route);
              await WORKSPACE_PRELOADERS[route]?.();
            } catch (err) {
              // Avoid unhandled promise rejections + noisy overlays.
              // If a chunk truly fails in production (e.g. stale service worker/cached HTML),
              // do a single hard reload to recover.
              if (isChunkLoadError(err) && !didReloadAfterChunkError) {
                didReloadAfterChunkError = true;
                window.location.reload();
                return;
              }
              // eslint-disable-next-line no-console
              console.warn("[RoutePrefetcher] prefetch failed:", coerceErrorMessage(err));
            }
          })();
        }, index * staggerMs);
        timeoutHandles.push(handle);
      });
    };

    let idleHandle: number | null = null;
    let delayedHandle: number | null = null;

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleHandle = idleWindow.requestIdleCallback(
        () => {
          startPrefetch();
        },
        { timeout: 1200 },
      );
    } else {
      delayedHandle = window.setTimeout(startPrefetch, 200);
    }

    return () => {
      if (idleHandle !== null && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleHandle);
      }
      if (delayedHandle !== null) {
        window.clearTimeout(delayedHandle);
      }
      timeoutHandles.forEach((handle) => window.clearTimeout(handle));
    };
  }, [router, routes]);

  return null;
}
