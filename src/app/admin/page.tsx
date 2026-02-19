"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/prefetch-link";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { toApiUrl } from "@/lib/api-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Activity, Clock3, Database, Layers3, TrendingUp } from "lucide-react";

type AnalyticsPayload = {
  overview: {
    totalUsers: number;
    registeredUsers: number;
    guests: number;
    activeUsers: number;
    newUsers: {
      today: number;
      week: number;
      month: number;
    };
    totalSessions: number;
    averageSessionDurationMs: number;
    mostUsedFeatures: Array<{ actionType: string; count: number }>;
    peakUsageByHour: Array<{ hour: number; count: number }>;
  };
  engagement: {
    retentionRate: number;
    returningUsers: number;
    trackedUsers: number;
  };
  conversion: {
    conversionRate: number;
    convertedUsers: number;
    guestPopulation: number;
  };
  downloads: {
    totalDownloads: number;
  };
  searchAnalytics: Array<{ query: string; count: number }>;
  geoDistribution: Array<{ country: string; count: number }>;
  deviceStats: Array<{ type: string; count: number }>;
  browserStats: Array<{ browser: string; count: number }>;
  featureUsage: Array<{ actionType: string; count: number }>;
  generatedAt: string;
};

type UserRow = {
  entityId: string;
  identityId: string;
  identityIds: string[];
  identityCount: number;
  guestGroupKey: string | null;
  localBackupId: string | null;
  lastSessionId: string | null;
  primaryIpAddress: string | null;
  deviceTypes: string[];
  userId: string | null;
  username: string;
  role: string;
  registrationStatus: "registered" | "guest";
  registrationDate: string | null;
  lastActiveAt: string | null;
  firstSeenAt: string | null;
  totalSessions: number;
  activeSessions: number;
  totalDurationMs: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  isBlocked: boolean;
};

type UserSummaryPayload = {
  total: number;
  registered: number;
  guests: number;
  blocked: number;
  activeInLast24Hours: number;
  activeGuestInLast24Hours: number;
  guestWithMultipleIdentities: number;
  maxGuestIdentityCount: number;
};

type UsersPayload = {
  users: UserRow[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  summary: UserSummaryPayload;
  config: ConfigPayload;
};

type ConfigPayload = {
  guestAttemptLimit: number;
  registrationRequired: boolean;
  sessionTimeoutMinutes: number;
  dataRetentionDays: number;
  enableTracking: boolean;
};

type ActivitiesPayload = {
  items: Array<{
    activityId: string;
    userIdentifier: string;
    userId: string | null;
    sessionId: string;
    actionType: string;
    actionDetails: Record<string, unknown>;
    timestamp: string;
    pageUrl: string | null;
    route: string | null;
    referrer: string | null;
    ipAddress: string | null;
  }>;
  total: number;
  page: number;
  limit: number;
};

type SourceRecordStatsPayload = {
  overview: {
    totalSources: number;
    totalCollections: number;
    totalRecords: number;
    oldestRecordAt: string | null;
    newestRecordAt: string | null;
    recordsInLast24Hours: number;
    recordsInLast7Days: number;
    recordsWithPrice: number;
    recordsWithImages: number;
    recordsWithPhone: number;
    priceCoverage: number;
    imageCoverage: number;
    phoneCoverage: number;
  };
  sources: Array<{
    sourceId: string;
    sourceLabel: string;
    collectionCount: number;
    totalRecords: number;
    oldestRecordAt: string | null;
    newestRecordAt: string | null;
    recordsInLast24Hours: number;
    recordsInLast7Days: number;
    recordsWithPrice: number;
    recordsWithImages: number;
    recordsWithPhone: number;
    priceCoverage: number;
    imageCoverage: number;
    phoneCoverage: number;
    largestCollection: {
      collectionId: string;
      collectionName: string;
      totalRecords: number;
    } | null;
    freshestCollection: {
      collectionId: string;
      collectionName: string;
      newestRecordAt: string;
    } | null;
    collections: Array<{
      collectionId: string;
      collectionName: string;
      totalRecords: number;
      oldestRecordAt: string | null;
      newestRecordAt: string | null;
      recordsInLast24Hours: number;
      recordsInLast7Days: number;
      recordsWithPrice: number;
      recordsWithImages: number;
      recordsWithPhone: number;
      priceCoverage: number;
      imageCoverage: number;
      phoneCoverage: number;
    }>;
  }>;
  pages: Array<{
    pageId: string;
    pageLabel: string;
    totalRecords: number;
    oldestRecordAt: string | null;
    newestRecordAt: string | null;
    recordsInLast24Hours: number;
    recordsInLast7Days: number;
    sources: Array<{
      sourceId: string;
      sourceLabel: string;
      totalRecords: number;
      recordsInLast24Hours: number;
      recordsInLast7Days: number;
    }>;
  }>;
  generatedAt: string;
};

type ActivityFilterState = {
  actionType: string;
  userQuery: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_ACTIVITY_FILTERS: ActivityFilterState = {
  actionType: "all",
  userQuery: "",
  dateFrom: "",
  dateTo: "",
};

const EMPTY_USER_SUMMARY: UserSummaryPayload = {
  total: 0,
  registered: 0,
  guests: 0,
  blocked: 0,
  activeInLast24Hours: 0,
  activeGuestInLast24Hours: 0,
  guestWithMultipleIdentities: 0,
  maxGuestIdentityCount: 0,
};

async function apiRequest<T>(
  url: string,
  csrfToken: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(toApiUrl(url), {
    ...options,
    credentials: "include",
    headers: {
      ...(options?.method && options.method !== "GET"
        ? { "x-csrf-token": csrfToken, "Content-Type": "application/json" }
        : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(payload.message ?? payload.error ?? "Request failed");
  }

  return (await response.json()) as T;
}

function durationLabel(durationMs: number) {
  const totalMinutes = Math.round(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function dateTimeLabel(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function percentLabel(value: number) {
  if (!Number.isFinite(value)) return "0%";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function shortId(value: string, left = 10, right = 6) {
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}

function prettyToken(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function detailValueLabel(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const items = value
      .map((entry) => detailValueLabel(entry))
      .filter((entry) => entry.length > 0);
    if (!items.length) return `${value.length} item${value.length === 1 ? "" : "s"}`;
    return items.slice(0, 3).join(", ");
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length ? `${keys.length} fields` : "{}";
  }
  return String(value);
}

function detailsSummary(details: Record<string, unknown>) {
  const segments = Object.entries(details)
    .map(([key, value]) => [prettyToken(key), detailValueLabel(value)] as const)
    .filter(([, value]) => value.length > 0)
    .slice(0, 3)
    .map(([key, value]) => {
      const trimmed = value.length > 80 ? `${value.slice(0, 77)}...` : value;
      return `${key}: ${trimmed}`;
    });

  if (!segments.length) return "No extra details";
  return segments.join(" | ");
}

function toErrorMessage(value: unknown, fallback: string) {
  return value instanceof Error ? value.message : fallback;
}

const AdminAnalyticsCharts = dynamic(
  () =>
    import("@/components/admin/admin-analytics-charts").then(
      (module) => module.AdminAnalyticsCharts
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="h-4 w-40 animate-pulse rounded bg-slate-200" />
              <CardDescription className="h-3 w-52 animate-pulse rounded bg-slate-100" />
            </CardHeader>
            <CardContent className="h-72 animate-pulse rounded bg-slate-100" />
          </Card>
        ))}
      </div>
    ),
  }
);

export default function AdminDashboardPage() {
  const { user, csrfToken, trackAction } = useAuthTracking();
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [config, setConfig] = useState<ConfigPayload | null>(null);
  const [activities, setActivities] = useState<ActivitiesPayload | null>(null);
  const [sourceRecordStats, setSourceRecordStats] = useState<SourceRecordStatsPayload | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [userRegistrationFilter, setUserRegistrationFilter] = useState<"all" | "registered" | "guest">(
    "all"
  );
  const [userBlockedFilter, setUserBlockedFilter] = useState<"all" | "blocked" | "active">("all");
  const [userPage, setUserPage] = useState(1);
  const [userLimit, setUserLimit] = useState(20);
  const [userTotal, setUserTotal] = useState(0);
  const [userHasNext, setUserHasNext] = useState(false);
  const [userSummary, setUserSummary] = useState<UserSummaryPayload>({
    ...EMPTY_USER_SUMMARY,
  });
  const [activityDraftFilters, setActivityDraftFilters] = useState<ActivityFilterState>({
    ...DEFAULT_ACTIVITY_FILTERS,
  });
  const [activityAppliedFilters, setActivityAppliedFilters] = useState<ActivityFilterState>({
    ...DEFAULT_ACTIVITY_FILTERS,
  });
  const [activityPage, setActivityPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const canAccess = user?.role === "super_admin";

  const buildActivitySearchParams = useCallback(
    (options?: { format?: "csv" | "excel" | "pdf"; page?: number; limit?: number }) => {
      const params = new URLSearchParams();
      params.set("page", String(options?.page ?? activityPage));
      params.set("limit", String(options?.limit ?? 25));

      if (activityAppliedFilters.actionType !== "all") {
        params.set("actionType", activityAppliedFilters.actionType);
      }
      if (activityAppliedFilters.userQuery.trim()) {
        params.set("userQuery", activityAppliedFilters.userQuery.trim());
      }
      if (activityAppliedFilters.dateFrom) {
        params.set("dateFrom", activityAppliedFilters.dateFrom);
      }
      if (activityAppliedFilters.dateTo) {
        params.set("dateTo", activityAppliedFilters.dateTo);
      }
      if (options?.format) {
        params.set("format", options.format);
      }

      return params;
    },
    [activityAppliedFilters, activityPage]
  );

  const loadAnalytics = useCallback(async () => {
    const result = await apiRequest<AnalyticsPayload>("/api/admin/analytics", csrfToken);
    setAnalytics(result);
  }, [csrfToken]);

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", String(userPage));
    params.set("limit", String(userLimit));
    if (debouncedUserSearch.trim()) {
      params.set("search", debouncedUserSearch.trim());
    }
    if (userRegistrationFilter !== "all") {
      params.set("registrationStatus", userRegistrationFilter);
    }
    if (userBlockedFilter !== "all") {
      params.set("accessState", userBlockedFilter);
    }

    const result = await apiRequest<UsersPayload>(
      `/api/admin/users?${params.toString()}`,
      csrfToken
    );
    setUsers(result.users ?? []);
    setUserTotal(result.total ?? 0);
    setUserHasNext(Boolean(result.hasNext));
    setUserSummary(result.summary ?? { ...EMPTY_USER_SUMMARY });
    setConfig(result.config);
  }, [
    csrfToken,
    debouncedUserSearch,
    userBlockedFilter,
    userLimit,
    userPage,
    userRegistrationFilter,
  ]);

  const loadActivities = useCallback(async () => {
    const params = buildActivitySearchParams();
    const result = await apiRequest<ActivitiesPayload>(
      `/api/admin/activities?${params.toString()}`,
      csrfToken
    );
    setActivities(result);
  }, [buildActivitySearchParams, csrfToken]);

  const loadSourceRecordStats = useCallback(async () => {
    const result = await apiRequest<SourceRecordStatsPayload>(
      "/api/admin/source-record-stats",
      csrfToken
    );
    setSourceRecordStats(result);
  }, [csrfToken]);

  const loadAll = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadAnalytics(), loadActivities(), loadSourceRecordStats()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, [canAccess, loadActivities, loadAnalytics, loadSourceRecordStats]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedUserSearch(userSearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [userSearch]);

  useEffect(() => {
    setUserPage(1);
  }, [debouncedUserSearch, userBlockedFilter, userLimit, userRegistrationFilter]);

  useEffect(() => {
    if (!canAccess) return;
    const timer = window.setInterval(() => {
      void loadAnalytics().catch((loadError) => {
        setError(toErrorMessage(loadError, "Failed to refresh analytics."));
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [canAccess, loadAnalytics]);

  useEffect(() => {
    if (!canAccess) return;
    const timer = window.setInterval(() => {
      void loadSourceRecordStats().catch((loadError) => {
        setError(toErrorMessage(loadError, "Failed to refresh source stats."));
      });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [canAccess, loadSourceRecordStats]);

  useEffect(() => {
    if (!canAccess) return;
    void loadUsers().catch((loadError) => {
      setError(toErrorMessage(loadError, "Failed to load users."));
    });
  }, [canAccess, loadUsers]);

  useEffect(() => {
    if (!canAccess) return;
    void loadActivities().catch((loadError) => {
      setError(toErrorMessage(loadError, "Failed to load activity logs."));
    });
  }, [canAccess, loadActivities]);

  const applyActivityFilters = useCallback(() => {
    if (
      activityDraftFilters.dateFrom &&
      activityDraftFilters.dateTo &&
      activityDraftFilters.dateFrom > activityDraftFilters.dateTo
    ) {
      setStatus("Invalid date range. 'Date From' must be earlier than 'Date To'.");
      return;
    }
    setStatus(null);
    setActivityPage(1);
    setActivityAppliedFilters({
      actionType: activityDraftFilters.actionType,
      userQuery: activityDraftFilters.userQuery.trim(),
      dateFrom: activityDraftFilters.dateFrom,
      dateTo: activityDraftFilters.dateTo,
    });
  }, [activityDraftFilters]);

  const clearActivityFilters = useCallback(() => {
    setStatus(null);
    setActivityPage(1);
    setActivityDraftFilters({
      ...DEFAULT_ACTIVITY_FILTERS,
    });
    setActivityAppliedFilters({
      ...DEFAULT_ACTIVITY_FILTERS,
    });
  }, []);

  const focusActivityForQuery = useCallback((queryValue: string) => {
    const normalized = queryValue.trim();
    if (!normalized) return;
    setActivityPage(1);
    setActivityDraftFilters((prev) => ({
      ...prev,
      userQuery: normalized,
    }));
    setActivityAppliedFilters((prev) => ({
      ...prev,
      userQuery: normalized,
    }));
    document.getElementById("activity-logs-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const exportActivities = useCallback(
    (format: "csv" | "excel" | "pdf") => {
      const params = buildActivitySearchParams({
        format,
        page: 1,
        limit: 200,
      });
      window.open(toApiUrl(`/api/admin/activities?${params.toString()}`), "_blank");
    },
    [buildActivitySearchParams]
  );

  const activityActionTypes = useMemo(() => {
    const types = new Set<string>();
    analytics?.featureUsage.forEach((item) => types.add(item.actionType));
    activities?.items.forEach((item) => types.add(item.actionType));
    return Array.from(types).sort((left, right) => left.localeCompare(right));
  }, [analytics, activities]);

  const activitySummary = useMemo(() => {
    const items = activities?.items ?? [];
    const uniqueActors = new Set(items.map((item) => item.userIdentifier)).size;
    const actionCounts = new Map<string, number>();
    items.forEach((item) => {
      actionCounts.set(item.actionType, (actionCounts.get(item.actionType) ?? 0) + 1);
    });
    let topActionType = "";
    let topActionCount = 0;
    actionCounts.forEach((count, actionType) => {
      if (count > topActionCount) {
        topActionType = actionType;
        topActionCount = count;
      }
    });
    return {
      shown: items.length,
      uniqueActors,
      topActionType,
      topActionCount,
    };
  }, [activities]);

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] text-slate-900 flex flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-6 py-16">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Super Admin Access Required</CardTitle>
              <CardDescription>
                You must be logged in as `admin000` (or another super admin) to view this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/">Go back</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-slate-900 flex flex-col">
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold">Super Admin Dashboard</h1>
              <p className="text-sm text-slate-600">
                Real-time usage, users, and tracking controls.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void Promise.all([loadAll(), loadUsers()]).catch((loadError) => {
                    setError(toErrorMessage(loadError, "Failed to refresh admin data."));
                  });
                }}
              >
                Refresh
              </Button>
            </div>
          </div>

          {error ? (
            <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {status ? (
            <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {status}
            </p>
          ) : null}

          {loading ? (
            <Card>
              <CardContent className="py-6 text-sm text-slate-600">Loading analytics...</CardContent>
            </Card>
          ) : null}

          {analytics ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardDescription>Total Users</CardDescription>
                  <CardTitle>{analytics.overview.totalUsers}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Active Users</CardDescription>
                  <CardTitle>{analytics.overview.activeUsers}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Sessions</CardDescription>
                  <CardTitle>{analytics.overview.totalSessions}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Avg Session Duration</CardDescription>
                  <CardTitle>{durationLabel(analytics.overview.averageSessionDurationMs)}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          ) : null}

          {loading && !sourceRecordStats ? (
            <Card>
              <CardContent className="py-6 text-sm text-slate-600">
                Loading source record statistics...
              </CardContent>
            </Card>
          ) : null}

          {sourceRecordStats ? (
            <Card className="relative overflow-hidden border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-cyan-50 to-amber-50 shadow-md">
              <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
              <div className="pointer-events-none absolute -left-10 bottom-0 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl" />
              <CardHeader className="relative space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-6 w-6 text-emerald-700" />
                      Data Sources Pulse
                    </CardTitle>
                    <CardDescription className="mt-1 text-slate-700">
                      Live record volume, freshness, and data coverage across every source.
                    </CardDescription>
                  </div>
                  <Badge className="border border-emerald-200 bg-white/80 text-emerald-900 hover:bg-white">
                    Updated {dateTimeLabel(sourceRecordStats.generatedAt)}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-emerald-200 bg-white/80 p-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total Records</p>
                    <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-900">
                      <Database className="h-4 w-4 text-emerald-700" />
                      {sourceRecordStats.overview.totalRecords.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-white/80 p-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Sources / Collections</p>
                    <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-900">
                      <Layers3 className="h-4 w-4 text-cyan-700" />
                      {sourceRecordStats.overview.totalSources} /{" "}
                      {sourceRecordStats.overview.totalCollections}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-white/80 p-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">New in 24h</p>
                    <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-900">
                      <TrendingUp className="h-4 w-4 text-emerald-700" />
                      {sourceRecordStats.overview.recordsInLast24Hours.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-white/80 p-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Coverage</p>
                    <div className="mt-1 space-y-1 text-sm text-slate-700">
                      <p className="flex items-center justify-between">
                        <span>Price</span>
                        <span className="font-semibold">{percentLabel(sourceRecordStats.overview.priceCoverage)}</span>
                      </p>
                      <p className="flex items-center justify-between">
                        <span>Images</span>
                        <span className="font-semibold">{percentLabel(sourceRecordStats.overview.imageCoverage)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {sourceRecordStats.pages.length ? (
                  <div className="space-y-2 rounded-xl border border-emerald-200/80 bg-white/65 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Live Records by Evaluation Page
                    </p>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {sourceRecordStats.pages.map((pageStats) => (
                        <div
                          key={pageStats.pageId}
                          className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-base font-semibold text-slate-900">
                                {pageStats.pageLabel} Page
                              </p>
                              <p className="text-xs text-slate-600">
                                Oldest {dateTimeLabel(pageStats.oldestRecordAt)} | Newest{" "}
                                {dateTimeLabel(pageStats.newestRecordAt)}
                              </p>
                            </div>
                            <Badge className="border border-cyan-200 bg-cyan-50 text-cyan-900 hover:bg-cyan-100">
                              {pageStats.totalRecords.toLocaleString()} records
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-slate-500">New in 24h</p>
                              <p className="font-semibold text-slate-900">
                                {pageStats.recordsInLast24Hours.toLocaleString()}
                              </p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-slate-500">New in 7d</p>
                              <p className="font-semibold text-slate-900">
                                {pageStats.recordsInLast7Days.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {pageStats.sources.map((source) => (
                              <Badge key={`${pageStats.pageId}-${source.sourceId}`} variant="outline" className="bg-white">
                                {source.sourceLabel}: {source.totalRecords.toLocaleString()}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardHeader>

              <CardContent className="relative space-y-3">
                {sourceRecordStats.sources.length ? (
                  <Accordion
                    type="single"
                    collapsible
                    defaultValue={sourceRecordStats.sources[0]?.sourceId}
                    className="space-y-3"
                  >
                    {sourceRecordStats.sources.map((source) => (
                      <AccordionItem
                        key={source.sourceId}
                        value={source.sourceId}
                        className="overflow-hidden rounded-xl border border-slate-200/80 border-b-0 bg-white/90 shadow-sm backdrop-blur"
                      >
                        <AccordionTrigger className="items-start px-4 py-4 hover:no-underline">
                          <div className="flex w-full flex-col gap-3 text-left lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-1">
                              <p className="text-lg font-semibold text-slate-900">{source.sourceLabel}</p>
                              <p className="text-xs text-slate-600">
                                {source.collectionCount} collections | Oldest{" "}
                                {dateTimeLabel(source.oldestRecordAt)} | Newest{" "}
                                {dateTimeLabel(source.newestRecordAt)}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs lg:min-w-[360px]">
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-slate-500">Records</p>
                                <p className="font-semibold text-slate-900">
                                  {source.totalRecords.toLocaleString()}
                                </p>
                              </div>
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-slate-500">Last 24h</p>
                                <p className="font-semibold text-slate-900">
                                  {source.recordsInLast24Hours.toLocaleString()}
                                </p>
                              </div>
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-slate-500">Price Coverage</p>
                                <p className="font-semibold text-slate-900">
                                  {percentLabel(source.priceCoverage)}
                                </p>
                              </div>
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-slate-500">Image Coverage</p>
                                <p className="font-semibold text-slate-900">
                                  {percentLabel(source.imageCoverage)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="border-t border-slate-200/80 px-4 py-4">
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Newest 7 Days</p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                {source.recordsInLast7Days.toLocaleString()}
                              </p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Price Coverage</p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                {percentLabel(source.priceCoverage)}
                              </p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Image Coverage</p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                {percentLabel(source.imageCoverage)}
                              </p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Phone Coverage</p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                {percentLabel(source.phoneCoverage)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            {source.largestCollection ? (
                              <Badge variant="outline" className="bg-white">
                                Largest: {source.largestCollection.collectionName} (
                                {source.largestCollection.totalRecords.toLocaleString()})
                              </Badge>
                            ) : null}
                            {source.freshestCollection ? (
                              <Badge variant="outline" className="bg-white">
                                Freshest: {source.freshestCollection.collectionName} (
                                {dateTimeLabel(source.freshestCollection.newestRecordAt)})
                              </Badge>
                            ) : null}
                          </div>

                          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full min-w-[980px] text-sm">
                              <thead className="bg-slate-50">
                                <tr className="border-b border-slate-200 text-left">
                                  <th className="px-3 py-3">Collection</th>
                                  <th className="px-3 py-3">Records</th>
                                  <th className="px-3 py-3">Oldest</th>
                                  <th className="px-3 py-3">Newest</th>
                                  <th className="px-3 py-3">New 24h</th>
                                  <th className="px-3 py-3">New 7d</th>
                                  <th className="px-3 py-3">Coverage</th>
                                </tr>
                              </thead>
                              <tbody>
                                {source.collections.map((collection) => (
                                  <tr
                                    key={collection.collectionId}
                                    className="border-b border-slate-100 align-top"
                                  >
                                    <td className="px-3 py-3">
                                      <p className="font-medium text-slate-900">
                                        {collection.collectionName}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {collection.collectionId}
                                      </p>
                                    </td>
                                    <td className="px-3 py-3 font-semibold text-slate-900">
                                      {collection.totalRecords.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-3 text-xs text-slate-700">
                                      {dateTimeLabel(collection.oldestRecordAt)}
                                    </td>
                                    <td className="px-3 py-3 text-xs text-slate-700">
                                      {dateTimeLabel(collection.newestRecordAt)}
                                    </td>
                                    <td className="px-3 py-3 font-medium text-slate-800">
                                      {collection.recordsInLast24Hours.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-3 font-medium text-slate-800">
                                      {collection.recordsInLast7Days.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-3 text-xs text-slate-700">
                                      <p>Price: {percentLabel(collection.priceCoverage)}</p>
                                      <p>Images: {percentLabel(collection.imageCoverage)}</p>
                                      <p>Phone: {percentLabel(collection.phoneCoverage)}</p>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <p className="rounded border border-slate-200 bg-white px-3 py-4 text-sm text-slate-600">
                    No source collections were found in the configured database.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/70 bg-white/70 px-3 py-2 text-xs text-slate-600">
                  <p className="flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5 text-cyan-700" />
                    Oldest: {dateTimeLabel(sourceRecordStats.overview.oldestRecordAt)}
                  </p>
                  <p className="flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5 text-emerald-700" />
                    Newest: {dateTimeLabel(sourceRecordStats.overview.newestRecordAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {analytics ? <AdminAnalyticsCharts analytics={analytics} /> : null}

          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Control guest limits, registration requirement, and retention settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {config ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="grid gap-2">
                    <Label>Guest Attempt Limit</Label>
                    <Input
                      type="number"
                      value={config.guestAttemptLimit}
                      onChange={(event) =>
                        setConfig((prev) =>
                          prev
                            ? {
                                ...prev,
                                guestAttemptLimit: Number(event.target.value || "0"),
                              }
                            : prev
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Session Timeout (minutes)</Label>
                    <Input
                      type="number"
                      value={config.sessionTimeoutMinutes}
                      onChange={(event) =>
                        setConfig((prev) =>
                          prev
                            ? {
                                ...prev,
                                sessionTimeoutMinutes: Number(event.target.value || "0"),
                              }
                            : prev
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Data Retention (days)</Label>
                    <Input
                      type="number"
                      value={config.dataRetentionDays}
                      onChange={(event) =>
                        setConfig((prev) =>
                          prev
                            ? {
                                ...prev,
                                dataRetentionDays: Number(event.target.value || "0"),
                              }
                            : prev
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Require Registration</Label>
                    <Select
                      value={config.registrationRequired ? "yes" : "no"}
                      onValueChange={(value) =>
                        setConfig((prev) =>
                          prev
                            ? {
                                ...prev,
                                registrationRequired: value === "yes",
                              }
                            : prev
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Enabled</SelectItem>
                        <SelectItem value="no">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      disabled={savingConfig}
                      onClick={async () => {
                        if (!config) return;
                        setSavingConfig(true);
                        setStatus(null);
                        try {
                          const next = await apiRequest<ConfigPayload>("/api/admin/config", csrfToken, {
                            method: "PUT",
                            body: JSON.stringify(config),
                          });
                          setConfig(next);
                          setStatus("Configuration updated.");
                          trackAction({
                            actionType: "admin_config_update",
                            actionDetails: config as unknown as Record<string, unknown>,
                          });
                        } catch (saveError) {
                          setStatus(
                            saveError instanceof Error
                              ? saveError.message
                              : "Failed to update configuration."
                          );
                        } finally {
                          setSavingConfig(false);
                        }
                      }}
                    >
                      {savingConfig ? "Saving..." : "Save Config"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-cyan-200/80 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 shadow-md">
            <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
            <CardHeader className="relative space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Person-level tracking for registered users and guest visitors. Guests are grouped by
                    persistent browser identity (`localBackupId`) with identity fallback.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-white/80">
                  {users.length} shown of {userTotal}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-md border border-slate-200 bg-white/90 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Tracked People</p>
                  <p className="text-lg font-semibold text-slate-900">{userSummary.total}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white/90 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Registered</p>
                  <p className="text-lg font-semibold text-slate-900">{userSummary.registered}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white/90 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Guest People</p>
                  <p className="text-lg font-semibold text-slate-900">{userSummary.guests}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white/90 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Guests Active (24h)</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {userSummary.activeGuestInLast24Hours}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white/90 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Merged Guest Profiles</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {userSummary.guestWithMultipleIdentities}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white/90 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Max IDs in One Guest</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {userSummary.maxGuestIdentityCount}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="user-search">Search User or Guest Profile</Label>
                  <Input
                    id="user-search"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Username, local backup ID, identity ID, user ID, session ID, IP"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Registration</Label>
                  <Select
                    value={userRegistrationFilter}
                    onValueChange={(value) =>
                      setUserRegistrationFilter(value as "all" | "registered" | "guest")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="registered">Registered</SelectItem>
                      <SelectItem value="guest">Guests</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Access State</Label>
                  <Select
                    value={userBlockedFilter}
                    onValueChange={(value) =>
                      setUserBlockedFilter(value as "all" | "blocked" | "active")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Allowed</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[1280px] text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-3 py-3">Person</th>
                      <th className="px-3 py-3">Identity Tracking</th>
                      <th className="px-3 py-3">Activity</th>
                      <th className="px-3 py-3">Guest Budget</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length ? (
                      users.map((entry) => {
                        const attemptLimit = entry.attemptsUsed + entry.attemptsRemaining;
                        const attemptPercent =
                          attemptLimit > 0 ? Math.round((entry.attemptsUsed / attemptLimit) * 100) : 0;
                        const logQuery =
                          entry.userId ?? entry.lastSessionId ?? entry.identityId;
                        const targetType: "user" | "identity" = entry.userId ? "user" : "identity";
                        const targetId = entry.userId ?? entry.identityId;

                        return (
                          <tr key={entry.entityId} className="border-b border-slate-100 align-top">
                            <td className="px-3 py-3">
                              <div className="space-y-2">
                                <p className="font-medium text-slate-900">{entry.username}</p>
                                <div className="flex flex-wrap gap-2">
                                  <Badge
                                    variant={
                                      entry.registrationStatus === "registered" ? "secondary" : "outline"
                                    }
                                  >
                                    {entry.registrationStatus === "registered"
                                      ? "Registered User"
                                      : "Guest Profile"}
                                  </Badge>
                                  <Badge variant={entry.isBlocked ? "destructive" : "secondary"}>
                                    {entry.isBlocked ? "Blocked" : "Allowed"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-500">
                                  Role: {prettyToken(entry.role)} | First Seen:{" "}
                                  {dateTimeLabel(entry.firstSeenAt)}
                                </p>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-xs">
                              <p className="font-mono text-slate-700" title={entry.identityId}>
                                Primary Identity: {shortId(entry.identityId, 12, 8)}
                              </p>
                              <p className="font-mono text-slate-500" title={entry.userId ?? undefined}>
                                User ID: {entry.userId ? shortId(entry.userId, 10, 8) : "Guest only"}
                              </p>
                              <p className="font-mono text-slate-500" title={entry.localBackupId ?? undefined}>
                                Local Backup:{" "}
                                {entry.localBackupId
                                  ? shortId(entry.localBackupId, 12, 8)
                                  : "Not captured"}
                              </p>
                              <p className="text-slate-500">
                                Linked identities: {entry.identityCount}
                                {entry.identityIds.length > 1
                                  ? ` (${entry.identityIds
                                      .slice(0, 2)
                                      .map((value) => shortId(value, 8, 6))
                                      .join(", ")}${entry.identityIds.length > 2 ? ", ..." : ""})`
                                  : ""}
                              </p>
                              <p className="text-slate-500">
                                Latest session:{" "}
                                {entry.lastSessionId ? shortId(entry.lastSessionId, 10, 8) : "No session"}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-xs">
                              <p className="font-medium text-slate-700">
                                Last Active: {dateTimeLabel(entry.lastActiveAt)}
                              </p>
                              <p className="text-slate-500">
                                {entry.totalSessions.toLocaleString()} sessions | {entry.activeSessions} active now
                              </p>
                              <p className="text-slate-500">
                                {durationLabel(entry.totalDurationMs)} tracked time
                              </p>
                              <p className="text-slate-500">
                                IP: {entry.primaryIpAddress ?? "Unavailable"}
                              </p>
                              <p className="text-slate-500">
                                Devices: {entry.deviceTypes.length ? entry.deviceTypes.join(", ") : "Unknown"}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-xs">
                              {entry.registrationStatus === "guest" ? (
                                <div className="space-y-2">
                                  <p className="font-medium text-slate-700">
                                    Attempts: {entry.attemptsUsed}/{attemptLimit}
                                  </p>
                                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className="h-full rounded-full bg-amber-500"
                                      style={{ width: `${Math.min(100, attemptPercent)}%` }}
                                    />
                                  </div>
                                  <p className="text-slate-500">
                                    {entry.attemptsRemaining} remaining
                                  </p>
                                </div>
                              ) : (
                                <p className="text-slate-500">
                                  Registered users are not guest-limit constrained.
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    focusActivityForQuery(logQuery);
                                  }}
                                >
                                  View Logs
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      await apiRequest<{ success: boolean }>("/api/admin/users", csrfToken, {
                                        method: "PATCH",
                                        body: JSON.stringify({
                                          action: entry.isBlocked ? "unblock" : "block",
                                          targetType,
                                          targetId,
                                          ...(targetType === "identity"
                                            ? { identityIds: entry.identityIds }
                                            : {}),
                                        }),
                                      });
                                      setStatus("User state updated.");
                                      await loadUsers();
                                    } catch (actionError) {
                                      setStatus(
                                        actionError instanceof Error
                                          ? actionError.message
                                          : "Failed to update user state."
                                      );
                                    }
                                  }}
                                >
                                  {entry.isBlocked ? "Unblock" : "Block"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      await apiRequest<{ success: boolean }>("/api/admin/users", csrfToken, {
                                        method: "PATCH",
                                        body: JSON.stringify({
                                          action: "force_logout",
                                          targetType,
                                          targetId,
                                          ...(targetType === "identity"
                                            ? { identityIds: entry.identityIds }
                                            : {}),
                                        }),
                                      });
                                      setStatus("Force logout completed.");
                                    } catch (actionError) {
                                      setStatus(
                                        actionError instanceof Error
                                          ? actionError.message
                                          : "Failed to force logout."
                                      );
                                    }
                                  }}
                                >
                                  Force Logout
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-500">
                          No users found for the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Showing {users.length} of {userTotal} records
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={String(userLimit)}
                    onValueChange={(value) => {
                      setUserLimit(Number(value));
                    }}
                  >
                    <SelectTrigger className="h-8 w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / page</SelectItem>
                      <SelectItem value="20">20 / page</SelectItem>
                      <SelectItem value="50">50 / page</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={userPage <= 1}
                    onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!userHasNext}
                    onClick={() => setUserPage((prev) => prev + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="activity-logs-section">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Activity Logs</CardTitle>
                  <CardDescription>
                    Clean, filterable event history for tracing any user or guest behavior.
                  </CardDescription>
                </div>
                <Badge variant="outline">{activities?.total ?? 0} matching records</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Shown on Page</p>
                  <p className="text-lg font-semibold text-slate-900">{activitySummary.shown}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Unique Actors</p>
                  <p className="text-lg font-semibold text-slate-900">{activitySummary.uniqueActors}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Top Action</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {activitySummary.topActionType
                      ? prettyToken(activitySummary.topActionType)
                      : "No data"}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Top Action Count</p>
                  <p className="text-lg font-semibold text-slate-900">{activitySummary.topActionCount}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-6">
                <div className="grid gap-2 lg:col-span-2">
                  <Label htmlFor="activity-user-query">User / Guest / Session / IP</Label>
                  <Input
                    id="activity-user-query"
                    value={activityDraftFilters.userQuery}
                    onChange={(event) =>
                      setActivityDraftFilters((prev) => ({
                        ...prev,
                        userQuery: event.target.value,
                      }))
                    }
                    placeholder="Search by identity, user ID, session ID, or IP"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Action Type</Label>
                  <Select
                    value={activityDraftFilters.actionType}
                    onValueChange={(value) =>
                      setActivityDraftFilters((prev) => ({
                        ...prev,
                        actionType: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {activityActionTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {prettyToken(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="activity-date-from">Date From</Label>
                  <Input
                    id="activity-date-from"
                    type="date"
                    value={activityDraftFilters.dateFrom}
                    onChange={(event) =>
                      setActivityDraftFilters((prev) => ({
                        ...prev,
                        dateFrom: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="activity-date-to">Date To</Label>
                  <Input
                    id="activity-date-to"
                    type="date"
                    value={activityDraftFilters.dateTo}
                    onChange={(event) =>
                      setActivityDraftFilters((prev) => ({
                        ...prev,
                        dateTo: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2 lg:col-span-6">
                  <Button variant="outline" onClick={applyActivityFilters}>
                    Apply Filters
                  </Button>
                  <Button variant="ghost" onClick={clearActivityFilters}>
                    Clear
                  </Button>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        exportActivities("csv");
                      }}
                    >
                      Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        exportActivities("excel");
                      }}
                    >
                      Export Excel
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        exportActivities("pdf");
                      }}
                    >
                      Export PDF
                    </Button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[1160px] text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-3 py-3">Timestamp</th>
                      <th className="px-3 py-3">Actor</th>
                      <th className="px-3 py-3">Action</th>
                      <th className="px-3 py-3">Session / IP</th>
                      <th className="px-3 py-3">Route</th>
                      <th className="px-3 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities?.items.length ? (
                      activities.items.map((entry) => (
                        <tr key={entry.activityId} className="border-b border-slate-100 align-top">
                          <td className="px-3 py-3 text-xs">
                            <p className="font-medium text-slate-700">{dateTimeLabel(entry.timestamp)}</p>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <button
                              type="button"
                              className="font-mono text-sky-700 hover:underline"
                              onClick={() => {
                                focusActivityForQuery(entry.userIdentifier);
                              }}
                              title={entry.userIdentifier}
                            >
                              {shortId(entry.userIdentifier, 12, 8)}
                            </button>
                            <p className="font-mono text-slate-500" title={entry.userId ?? undefined}>
                              {entry.userId ? `User: ${shortId(entry.userId, 10, 8)}` : "Guest session"}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <Badge variant="outline">{prettyToken(entry.actionType)}</Badge>
                            <p className="mt-1 text-slate-500">{entry.actionType}</p>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <p className="font-mono text-slate-700" title={entry.sessionId}>
                              {shortId(entry.sessionId, 10, 8)}
                            </p>
                            <p className="text-slate-500">{entry.ipAddress ?? "IP unavailable"}</p>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <p className="max-w-[280px] truncate text-slate-700" title={entry.route ?? undefined}>
                              {entry.route ?? "No route"}
                            </p>
                            <p className="max-w-[280px] truncate text-slate-500" title={entry.pageUrl ?? undefined}>
                              {entry.pageUrl ?? "No page URL"}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            <p className="max-w-[320px] whitespace-normal break-words">
                              {detailsSummary(entry.actionDetails)}
                            </p>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                          No activity logs found for the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Showing {activities?.items.length ?? 0} of {activities?.total ?? 0} records
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(activities?.page ?? 1) <= 1}
                    onClick={() => setActivityPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!activities || activities.page * activities.limit >= activities.total}
                    onClick={() => setActivityPage((prev) => prev + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
