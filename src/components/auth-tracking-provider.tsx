"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { toApiUrl } from "@/lib/api-url";

type AuthUser = {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  role: "user" | "super_admin";
  createdAt: string;
  lastLoginAt?: string | null;
};

type Profile = {
  userId: string;
  email?: string | null;
  phone?: string | null;
  additionalInfo?: Record<string, unknown> | null;
  updatedAt: string;
};

type GuestAccess = {
  limit: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  registrationRequired: boolean;
  isBlocked: boolean;
};

type SessionPayload = {
  session: {
    id: string;
    startedAt: string;
    lastSeenAt: string;
    isActive: boolean;
  };
  user: AuthUser | null;
  profile: Profile | null;
  guestAccess: GuestAccess;
  config: {
    guestAttemptLimit: number;
    registrationRequired: boolean;
    sessionTimeoutMinutes: number;
    dataRetentionDays: number;
    enableTracking: boolean;
  };
  csrfToken?: string;
};

type TrackingAction = {
  actionType: string;
  actionDetails?: Record<string, unknown>;
  pageUrl?: string;
  route?: string;
  timestamp?: string;
};

type AuthTrackingContextType = {
  user: AuthUser | null;
  profile: Profile | null;
  session: SessionPayload["session"] | null;
  guestAccess: GuestAccess | null;
  config: SessionPayload["config"] | null;
  csrfToken: string;
  loading: boolean;
  login: (payload: {
    username: string;
    password: string;
    rememberMe?: boolean;
  }) => Promise<void>;
  register: (payload: {
    username: string;
    password: string;
    email?: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (payload: {
    email?: string | null;
    phone?: string | null;
    additionalInfo?: Record<string, unknown> | null;
  }) => Promise<void>;
  trackAction: (action: TrackingAction) => void;
};

const AuthTrackingContext = createContext<AuthTrackingContextType | null>(null);

function nowIso() {
  return new Date().toISOString();
}

function getOrCreateLocalBackupId() {
  const key = "sv_local_uid";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return String(hash);
}

async function collectFingerprint() {
  const fingerprint: Record<string, string> = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    platform: navigator.platform || "",
    language: navigator.language || "",
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    deviceMemory: String((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? ""),
    hardwareConcurrency: String(navigator.hardwareConcurrency ?? ""),
  };

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 48;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#102030";
      context.font = "12px sans-serif";
      context.fillText("SV", 10, 20);
      context.fillText(navigator.userAgent.slice(0, 12), 10, 36);
      fingerprint.canvas = hashString(canvas.toDataURL());
    }
  } catch {
    fingerprint.canvas = "";
  }

  return fingerprint;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(toApiUrl(url), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(body.message ?? body.error ?? "Request failed");
  }
  return (await response.json()) as T;
}

export default function AuthTrackingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [guestAccess, setGuestAccess] = useState<GuestAccess | null>(null);
  const [session, setSession] = useState<SessionPayload["session"] | null>(null);
  const [config, setConfig] = useState<SessionPayload["config"] | null>(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [loading, setLoading] = useState(true);

  const actionQueueRef = useRef<TrackingAction[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const lastInteractionRef = useRef(Date.now());
  const heartbeatStartRef = useRef(Date.now());
  const scrollMilestoneRef = useRef(0);

  const applySnapshot = useCallback((snapshot: SessionPayload) => {
    setUser(snapshot.user ?? null);
    setProfile(snapshot.profile ?? null);
    setGuestAccess(snapshot.guestAccess ?? null);
    setSession(snapshot.session ?? null);
    setConfig(snapshot.config ?? null);
    if (snapshot.csrfToken) {
      setCsrfToken(snapshot.csrfToken);
    }
  }, []);

  const flushActions = useCallback(async () => {
    const batch = actionQueueRef.current.splice(0, 50);
    if (!batch.length) return;
    try {
      const result = await requestJson<{ guestAccess?: GuestAccess }>("/api/track/action", {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
        body: JSON.stringify({
          actions: batch,
        }),
        keepalive: true,
      });
      if (result.guestAccess) {
        setGuestAccess(result.guestAccess);
      }
    } catch {
      // tracking failures are non-blocking
    }
  }, [csrfToken]);

  const queueFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(async () => {
      flushTimerRef.current = null;
      await flushActions();
    }, 4000);
  }, [flushActions]);

  const trackAction = useCallback(
    (action: TrackingAction) => {
      actionQueueRef.current.push({
        ...action,
        timestamp: action.timestamp ?? nowIso(),
        route: action.route ?? pathname ?? undefined,
        pageUrl: action.pageUrl ?? window.location.href,
      });
      if (actionQueueRef.current.length >= 25) {
        void flushActions();
        return;
      }
      queueFlush();
    },
    [flushActions, pathname, queueFlush]
  );

  const sendSessionEvent = useCallback(
    async (
      eventType: "start" | "heartbeat" | "end",
      extra?: Partial<{
        activeMs: number;
        idleMs: number;
        durationMs: number;
      }>
    ) => {
      const payload: Record<string, unknown> = {
        eventType,
        pageUrl: window.location.href,
        referrer: document.referrer,
        localBackupId: getOrCreateLocalBackupId(),
        ...extra,
      };
      if (eventType === "start") {
        payload.fingerprint = await collectFingerprint();
      }
      const response = await requestJson<SessionPayload>("/api/track/session", {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
        body: JSON.stringify(payload),
        keepalive: eventType === "end",
      });
      applySnapshot(response);
      return response;
    },
    [applySnapshot, csrfToken]
  );

  const refresh = useCallback(async () => {
    const response = await requestJson<SessionPayload>("/api/auth/me");
    applySnapshot(response);
  }, [applySnapshot]);

  const login = useCallback(
    async (payload: { username: string; password: string; rememberMe?: boolean }) => {
      const response = await requestJson<{
        user: AuthUser;
        profile: Profile | null;
        guestAccess: GuestAccess;
      }>("/api/auth/login", {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
        body: JSON.stringify(payload),
      });
      setUser(response.user);
      setProfile(response.profile);
      setGuestAccess(response.guestAccess);
      trackAction({
        actionType: "auth_login",
        actionDetails: {
          username: payload.username,
        },
      });
      await refresh();
    },
    [csrfToken, refresh, trackAction]
  );

  const register = useCallback(
    async (payload: {
      username: string;
      password: string;
      email?: string;
      phone?: string;
    }) => {
      const response = await requestJson<{
        user: AuthUser;
        guestAccess: GuestAccess;
      }>("/api/auth/register", {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
        body: JSON.stringify(payload),
      });
      setUser(response.user);
      setGuestAccess(response.guestAccess);
      trackAction({
        actionType: "auth_register",
        actionDetails: {
          username: payload.username,
        },
      });
      await refresh();
    },
    [csrfToken, refresh, trackAction]
  );

  const logout = useCallback(async () => {
    await requestJson<{ success: boolean }>("/api/auth/logout", {
      method: "POST",
      headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      body: JSON.stringify({}),
    });
    setUser(null);
    setProfile(null);
    await refresh();
  }, [csrfToken, refresh]);

  const updateProfile = useCallback(
    async (payload: {
      email?: string | null;
      phone?: string | null;
      additionalInfo?: Record<string, unknown> | null;
    }) => {
      const response = await requestJson<{
        user: AuthUser;
        profile: Profile;
      }>("/api/user/profile", {
        method: "PATCH",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
        body: JSON.stringify(payload),
      });
      setUser(response.user);
      setProfile(response.profile);
      trackAction({
        actionType: "profile_update",
      });
    },
    [csrfToken, trackAction]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initialize = async () => {
      setLoading(true);
      try {
        await refresh();
      } catch {
        // ignore bootstrap failures
      } finally {
        setLoading(false);
      }

      // Session start tracking should not block first paint.
      try {
        await sendSessionEvent("start");
      } catch {
        // ignore start-event failures
      }
    };

    void initialize();
  }, [refresh, sendSessionEvent]);

  useEffect(() => {
    if (!pathname) return;
    trackAction({
      actionType: "page_view",
      actionDetails: {
        pathname,
      },
      route: pathname,
      pageUrl: window.location.href,
    });
  }, [pathname, trackAction]);

  useEffect(() => {
    const heartbeat = window.setInterval(async () => {
      const now = Date.now();
      const elapsed = now - heartbeatStartRef.current;
      heartbeatStartRef.current = now;
      const idleFor = now - lastInteractionRef.current;
      const idleMs = idleFor > 60_000 ? elapsed : 0;
      const activeMs = idleFor > 60_000 ? 0 : elapsed;
      try {
        await sendSessionEvent("heartbeat", {
          idleMs,
          activeMs,
          durationMs: elapsed,
        });
      } catch {
        // ignore heartbeat failure
      }
    }, 30_000);
    return () => {
      window.clearInterval(heartbeat);
    };
  }, [sendSessionEvent]);

  useEffect(() => {
    const onInteract = () => {
      lastInteractionRef.current = Date.now();
    };

    const onClick = (event: MouseEvent) => {
      onInteract();
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const button = target.closest("button, a, [role='button']");
      if (!button) return;
      const text = (button.textContent || "").trim().slice(0, 120);
      trackAction({
        actionType: "button_click",
        actionDetails: {
          tagName: button.tagName.toLowerCase(),
          id: button.id || null,
          text,
        },
      });
    };

    const onSubmit = (event: Event) => {
      onInteract();
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      trackAction({
        actionType: "form_submit",
        actionDetails: {
          id: form.id || null,
          name: form.getAttribute("name"),
          action: form.action || null,
        },
      });
    };

    const onScroll = () => {
      const scrollTop = window.scrollY;
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      const percent = Math.round((scrollTop / maxScroll) * 100);
      const milestone = Math.floor(percent / 25) * 25;
      if (milestone <= scrollMilestoneRef.current || milestone === 0) return;
      scrollMilestoneRef.current = milestone;
      trackAction({
        actionType: "scroll_depth",
        actionDetails: {
          percent: milestone,
        },
      });
    };

    const onVisibility = () => {
      trackAction({
        actionType: "visibility_change",
        actionDetails: {
          state: document.visibilityState,
        },
      });
      if (document.visibilityState === "hidden") {
        void flushActions();
      }
    };

    const onError = (event: ErrorEvent) => {
      trackAction({
        actionType: "error",
        actionDetails: {
          message: event.message,
          source: event.filename,
          line: event.lineno,
          column: event.colno,
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      trackAction({
        actionType: "error",
        actionDetails: {
          message: String(event.reason ?? "unhandled_rejection"),
        },
      });
    };

    const onBeforeUnload = () => {
      const elapsed = Date.now() - heartbeatStartRef.current;
      const idleFor = Date.now() - lastInteractionRef.current;
      const idleMs = idleFor > 60_000 ? elapsed : 0;
      const activeMs = idleFor > 60_000 ? 0 : elapsed;
      const payload = {
        eventType: "end",
        pageUrl: window.location.href,
        referrer: document.referrer,
        localBackupId: getOrCreateLocalBackupId(),
        idleMs,
        activeMs,
        durationMs: elapsed,
      };
      try {
        navigator.sendBeacon(toApiUrl("/api/track/session"), JSON.stringify(payload));
        const queued = actionQueueRef.current.splice(0, 50);
        if (queued.length > 0) {
          navigator.sendBeacon(toApiUrl("/api/track/action"), JSON.stringify({ actions: queued }));
        }
      } catch {
        // ignore unload failures
      }
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      const lowerUrl = url.toLowerCase();
      const isApiRequest = lowerUrl.includes("/api/");
      const isTrackingEndpoint =
        lowerUrl.includes("/api/track/action") || lowerUrl.includes("/api/track/session");
      const isHighVolumeListEndpoint =
        lowerUrl.includes("/api/cars-sources") ||
        lowerUrl.includes("/api/haraj-scrape") ||
        lowerUrl.includes("/api/yallamotor-scrape");
      const method = init?.method ?? "GET";
      const start = performance.now();
      const response = await originalFetch(input, init);
      if (isApiRequest && !isTrackingEndpoint) {
        const durationMs = Math.round(performance.now() - start);
        const sampleRate = isHighVolumeListEndpoint ? 0.03 : 0.15;
        const shouldTrackCall =
          response.status >= 400 || durationMs >= 1200 || Math.random() < sampleRate;
        if (!shouldTrackCall) {
          return response;
        }
        trackAction({
          actionType: "api_call",
          actionDetails: {
            url,
            method,
            status: response.status,
            durationMs,
          },
        });
      }
      return response;
    }) as typeof window.fetch;

    const interactionEvents = ["mousemove", "keydown", "touchstart", "click"];
    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, onInteract, { passive: true });
    });
    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("submit", onSubmit, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      window.fetch = originalFetch;
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onInteract);
      });
      window.removeEventListener("click", onClick);
      window.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flushActions, trackAction]);

  const value = useMemo<AuthTrackingContextType>(
    () => ({
      user,
      profile,
      session,
      guestAccess,
      config,
      csrfToken,
      loading,
      login,
      register,
      logout,
      refresh,
      updateProfile,
      trackAction,
    }),
    [
      config,
      csrfToken,
      guestAccess,
      loading,
      login,
      logout,
      profile,
      refresh,
      register,
      session,
      trackAction,
      updateProfile,
      user,
    ]
  );

  return (
    <AuthTrackingContext.Provider value={value}>
      {children}
    </AuthTrackingContext.Provider>
  );
}

export function useAuthTracking() {
  const context = useContext(AuthTrackingContext);
  if (!context) {
    throw new Error("useAuthTracking must be used within AuthTrackingProvider");
  }
  return context;
}
