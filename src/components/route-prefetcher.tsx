"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthTracking } from "@/components/auth-tracking-provider";

const BASE_ROUTES = [
  "/evaluation-source",
  "/evaluation-source/cars",
  "/evaluation-source/real-estate",
  "/evaluation-source/other",
  "/profile",
];

export default function RoutePrefetcher() {
  const router = useRouter();
  const { user } = useAuthTracking();

  const routes = useMemo(() => {
    if (user?.role === "super_admin") {
      return [...BASE_ROUTES, "/admin"];
    }
    return BASE_ROUTES;
  }, [user?.role]);

  useEffect(() => {
    const timeoutHandles: number[] = [];
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const startPrefetch = () => {
      routes.forEach((route, index) => {
        const handle = window.setTimeout(() => {
          void router.prefetch(route);
        }, index * 200);
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
        { timeout: 1500 }
      );
    } else {
      delayedHandle = window.setTimeout(startPrefetch, 500);
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
