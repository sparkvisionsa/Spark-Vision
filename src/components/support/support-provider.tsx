"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { useSupportApi } from "./support-api";
import { useRealtime } from "./realtime-provider";
import type { SupportProduct, SupportSummary } from "./support-types";

const SupportDock = dynamic(() => import("./support-dock"), { ssr: false });
const SupportCenterModal = dynamic(() => import("./support-center-modal"), { ssr: false });
const empty: SupportSummary = { staff: false, superAdmin: false, online: false, unread: 0, notificationUnread: 0, counts: {} };
type Center = { mode: "support" | "developer"; product: SupportProduct; compose?: boolean };
type SupportContextValue = {
  summary: SupportSummary;
  refresh: () => void;
  openRecorder: () => void;
  openAssistant: () => void;
  openSupport: (product?: SupportProduct, options?: { compose?: boolean }) => void;
  openDeveloperRequests: (product?: SupportProduct) => void;
};
const SupportContext = createContext<SupportContextValue>({ summary: empty, refresh: () => {}, openRecorder: () => {}, openAssistant: () => {}, openSupport: () => {}, openDeveloperRequests: () => {} });
export const useSupport = () => useContext(SupportContext);

export function SupportProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthTracking();
  const api = useSupportApi();
  const { socket } = useRealtime();
  const [summary, setSummary] = useState<SupportSummary>(empty);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [center, setCenter] = useState<Center | null>(null);
  const scope = `${user?.id ?? ""}:${user?.companyId ?? ""}`;
  const [summaryScope, setSummaryScope] = useState("");
  const refresh = useCallback(() => {
    if (!user) return;
    void api<SupportSummary>("/summary").then(data => { setSummary(data); setSummaryScope(scope); }).catch(() => {});
  }, [api, user?.id, scope]);
  useEffect(() => {
    setAssistantOpen(false); setRecorderOpen(false); setCenter(null);
    if (!user) { setSummary(empty); return; }
    refresh();
    let pending: ReturnType<typeof setTimeout> | undefined;
    const changed = () => { if (pending) clearTimeout(pending); pending = setTimeout(refresh, 300); };
    socket?.on("support:changed", changed).on("support:notifications", changed).on("connect", refresh).on("support:presence", changed);
    const visibility = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 45_000);
    return () => { if (pending) clearTimeout(pending); clearInterval(timer); socket?.off("support:changed", changed).off("support:notifications", changed).off("connect", refresh).off("support:presence", changed); document.removeEventListener("visibilitychange", visibility); };
  }, [scope, socket, refresh]);
  const openRecorder = useCallback(() => { if (user) setRecorderOpen(true); else window.dispatchEvent(new CustomEvent("sv:open-auth-modal")); }, [user?.id]);
  const openCenter = useCallback((mode: Center["mode"], product: SupportProduct = "general", compose = false) => {
    if (!user) { window.dispatchEvent(new CustomEvent("sv:open-auth-modal")); return; }
    setAssistantOpen(false); setRecorderOpen(false); setCenter({ mode, product, compose });
  }, [user?.id]);
  const openSupport = useCallback((product: SupportProduct = "general", options?: { compose?: boolean }) => openCenter("support", product, options?.compose), [openCenter]);
  const openDeveloperRequests = useCallback((product: SupportProduct = "general") => openCenter("developer", product), [openCenter]);
  const value = useMemo(() => ({ summary: summaryScope === scope ? summary : empty, refresh, openRecorder, openAssistant: () => setAssistantOpen(true), openSupport, openDeveloperRequests }), [summary, summaryScope, scope, refresh, openRecorder, openSupport, openDeveloperRequests]);
  return <SupportContext.Provider value={value}>
    {children}
    {user && <SupportDock key={scope} assistantOpen={assistantOpen} onAssistantOpen={setAssistantOpen} recorderOpen={recorderOpen} onRecorderOpen={setRecorderOpen} />}
    {user && center && <SupportCenterModal open onOpenChange={open => { if (!open) setCenter(null); }} mode={center.mode} product={center.product} compose={center.compose} />}
  </SupportContext.Provider>;
}
