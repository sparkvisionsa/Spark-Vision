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

/** Value Tech section routes – prefetch so navigation from sidebar is instant */
const VALUE_TECH_ROUTES = [
  "/value-tech",
  "/value-tech-app",
  "/real-estate-valuation",
  "/machine-valuation",
  "/clients",
  "/settings",
];

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
    const timeoutHandles: number[] = [];
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const startPrefetch = () => {
      routes.forEach((route, index) => {
        const handle = window.setTimeout(() => {
          void router.prefetch(route);
        }, index * 80);
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
        { timeout: 800 }
      );
    } else {
      delayedHandle = window.setTimeout(startPrefetch, 300);
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
