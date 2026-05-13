"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type MvInPageNavigationValue = {
  currentPath: string;
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

  const isMachineValuationPath = useCallback((path: string) => {
    return normalizePath(path).startsWith("/machine-valuation");
  }, []);

  const navigate = useCallback((nextPath: string) => {
    const normalized = normalizePath(nextPath);
    if (!normalized.startsWith("/machine-valuation")) return;
    setCurrentPath(normalized);
  }, []);

  const value = useMemo<MvInPageNavigationValue>(
    () => ({ currentPath, navigate, isMachineValuationPath }),
    [currentPath, navigate, isMachineValuationPath],
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
