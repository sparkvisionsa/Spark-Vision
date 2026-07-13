"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

type MvInPageNavigationValue = {
  currentPath: string;
  isNavigating: boolean;
  navigate: (nextPath: string) => void;
  isMachineValuationPath: (path: string) => boolean;
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

  useEffect(() => {
    const normalized = normalizePath(initialPath);
    setCurrentPath((current) => (current === normalized ? current : normalized));
  }, [initialPath]);

  useEffect(() => {
    const onPopState = () => {
      const next = normalizePath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      if (!next.startsWith("/machine-valuation")) return;
      startNavigation(() => setCurrentPath(next));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const isMachineValuationPath = useCallback((path: string) => {
    return normalizePath(path).startsWith("/machine-valuation");
  }, []);

  const navigate = useCallback((nextPath: string) => {
    const normalized = normalizePath(nextPath);
    if (!normalized.startsWith("/machine-valuation")) return;
    if (typeof window !== "undefined") {
      const currentBrowserPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentBrowserPath !== normalized) window.history.pushState({}, "", normalized);
    }
    startNavigation(() => setCurrentPath(normalized));
  }, []);

  const value = useMemo<MvInPageNavigationValue>(
    () => ({ currentPath, isNavigating, navigate, isMachineValuationPath }),
    [currentPath, isNavigating, navigate, isMachineValuationPath],
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
