"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

export type MvNavigationBlocker = (args: {
  nextPath: string;
  currentPath: string;
}) => boolean;

type MvInPageNavigationValue = {
  currentPath: string;
  isNavigating: boolean;
  navigate: (nextPath: string) => void;
  isMachineValuationPath: (path: string) => boolean;
  /** Return `true` to allow navigation, `false` to block it. */
  registerNavigationBlocker: (blocker: MvNavigationBlocker) => () => void;
};

const MvInPageNavigationContext = createContext<MvInPageNavigationValue | null>(null);

function normalizePath(path: string) {
  const trimmed = (path || "").trim();
  if (!trimmed) return "/machine-valuation/projects";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return "/machine-valuation/projects";
    }
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function MvInPageNavigationProvider({
  initialPath,
  children,
}: {
  initialPath: string;
  children: ReactNode;
}) {
  const [currentPath, setCurrentPath] = useState(() => normalizePath(initialPath));
  const [isNavigating, startNavigation] = useTransition();
  const currentPathRef = useRef(currentPath);
  const blockersRef = useRef(new Set<MvNavigationBlocker>());

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => {
    const normalized = normalizePath(initialPath);
    setCurrentPath((current) => (current === normalized ? current : normalized));
  }, [initialPath]);

  const allowNavigation = useCallback((nextPath: string, fromPath: string) => {
    if (nextPath === fromPath) return true;
    for (const blocker of blockersRef.current) {
      if (!blocker({ nextPath, currentPath: fromPath })) return false;
    }
    return true;
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const next = normalizePath(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
      if (!next.startsWith("/machine-valuation")) return;
      const fromPath = currentPathRef.current;
      if (!allowNavigation(next, fromPath)) {
        if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== fromPath) {
          window.history.pushState({}, "", fromPath);
        }
        return;
      }
      startNavigation(() => setCurrentPath(next));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [allowNavigation]);

  const isMachineValuationPath = useCallback((path: string) => {
    return normalizePath(path).startsWith("/machine-valuation");
  }, []);

  const registerNavigationBlocker = useCallback((blocker: MvNavigationBlocker) => {
    blockersRef.current.add(blocker);
    return () => {
      blockersRef.current.delete(blocker);
    };
  }, []);

  const navigate = useCallback(
    (nextPath: string) => {
      const normalized = normalizePath(nextPath);
      if (!normalized.startsWith("/machine-valuation")) return;
      const fromPath =
        typeof window !== "undefined"
          ? normalizePath(
              `${window.location.pathname}${window.location.search}${window.location.hash}`,
            )
          : currentPathRef.current;
      if (!allowNavigation(normalized, fromPath)) return;
      if (typeof window !== "undefined") {
        const currentBrowserPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (currentBrowserPath !== normalized) window.history.pushState({}, "", normalized);
      }
      startNavigation(() => setCurrentPath(normalized));
    },
    [allowNavigation],
  );

  const value = useMemo<MvInPageNavigationValue>(
    () => ({
      currentPath,
      isNavigating,
      navigate,
      isMachineValuationPath,
      registerNavigationBlocker,
    }),
    [currentPath, isNavigating, navigate, isMachineValuationPath, registerNavigationBlocker],
  );

  return (
    <MvInPageNavigationContext.Provider value={value}>
      {children}
    </MvInPageNavigationContext.Provider>
  );
}

export function useMvInPageNavigation() {
  const ctx = useContext(MvInPageNavigationContext);
  if (!ctx) {
    throw new Error("useMvInPageNavigation must be used inside MvInPageNavigationProvider");
  }
  return ctx;
}
