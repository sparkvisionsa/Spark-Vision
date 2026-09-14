"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthTracking } from "@/components/auth-tracking-provider";

type ResourceChange = { resource: string; projectId?: string; at: string };
const RealtimeContext = createContext<{ socket: Socket | null; connected: boolean }>({ socket: null, connected: false });
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, refresh } = useAuthTracking();
  const authRefresh = useRef(refresh);
  authRefresh.current = refresh;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!user) return;
    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
    const connection = io(realtimeUrl || undefined, {
      path: "/api/realtime/socket.io", withCredentials: true,
      // The dedicated Next rewrite proxies both polling and WebSocket upgrades.
      transports: ["polling", "websocket"],
      reconnectionDelay: 1000, reconnectionDelayMax: 10_000,
    });
    setSocket(connection);
    const reconnect = () => { setConnected(true); window.dispatchEvent(new CustomEvent("sv:realtime-reconnected")); };
    const disconnect = (reason?: string) => { setConnected(false); if (reason === "io server disconnect") void authRefresh.current(); };
    const changes = new Map<string, ResourceChange>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = (event: ResourceChange) => {
      changes.set(`${event.resource}:${event.projectId ?? ""}`, event);
      if (timer) return;
      timer = setTimeout(() => {
        for (const detail of changes.values()) window.dispatchEvent(new CustomEvent("sv:resource-changed", { detail }));
        changes.clear(); timer = undefined;
      }, 400);
    };
    connection.on("connect", reconnect).on("disconnect", disconnect).on("connect_error", () => setConnected(false)).on("resource:changed", changed);
    const retry = () => { if (!connection.connected) connection.connect(); };
    window.addEventListener("online", retry);
    const visibility = () => { if (document.visibilityState === "visible") retry(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { connection.disconnect(); setSocket(null); setConnected(false); if (timer) clearTimeout(timer); window.removeEventListener("online", retry); document.removeEventListener("visibilitychange", visibility); };
  }, [user?.id, user?.companyId]);
  return <RealtimeContext.Provider value={{ socket, connected }}>{children}</RealtimeContext.Provider>;
}
export const useRealtime = () => useContext(RealtimeContext);

/** Subscribe list/readonly views; editable report forms keep their unsaved values. */
export function useResourceRefresh(resource: string, refresh: () => void, projectId?: string) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => callback.current(), 350); };
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<ResourceChange>).detail;
      if (detail.resource === resource && (!projectId || !detail.projectId || detail.projectId === projectId)) run();
    };
    const visible = () => { if (document.visibilityState === "visible") run(); };
    window.addEventListener("sv:resource-changed", changed);
    window.addEventListener("sv:realtime-reconnected", run);
    document.addEventListener("visibilitychange", visible);
    return () => { if (timer) clearTimeout(timer); window.removeEventListener("sv:resource-changed", changed); window.removeEventListener("sv:realtime-reconnected", run); document.removeEventListener("visibilitychange", visible); };
  }, [resource, projectId]);
}
