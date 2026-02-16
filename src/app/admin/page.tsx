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
  identityId: string;
  userId: string | null;
  username: string;
  role: string;
  registrationStatus: "registered" | "guest";
  registrationDate: string | null;
  lastActiveAt: string | null;
  totalSessions: number;
  totalDurationMs: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  isBlocked: boolean;
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

function isWithinHours(value: string | null, hours: number) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= hours * 60 * 60 * 1000;
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
  const [userSearch, setUserSearch] = useState("");
  const [userRegistrationFilter, setUserRegistrationFilter] = useState<"all" | "registered" | "guest">(
    "all"
  );
  const [userBlockedFilter, setUserBlockedFilter] = useState<"all" | "blocked" | "active">("all");
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
    const result = await apiRequest<{ users: UserRow[]; config: ConfigPayload }>(
      "/api/admin/users",
      csrfToken
    );
    setUsers(result.users ?? []);
    setConfig(result.config);
  }, [csrfToken]);

  const loadActivities = useCallback(async () => {
    const params = buildActivitySearchParams();
    const result = await apiRequest<ActivitiesPayload>(
      `/api/admin/activities?${params.toString()}`,
      csrfToken
    );
    setActivities(result);
  }, [buildActivitySearchParams, csrfToken]);

  const loadAll = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadAnalytics(), loadUsers(), loadActivities()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, [canAccess, loadActivities, loadAnalytics, loadUsers]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

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

  const focusActivityForUser = useCallback((identityId: string) => {
    setActivityPage(1);
    setActivityDraftFilters((prev) => ({
      ...prev,
      userQuery: identityId,
    }));
    setActivityAppliedFilters((prev) => ({
      ...prev,
      userQuery: identityId,
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

  const userSummary = useMemo(() => {
    const summary = {
      total: users.length,
      registered: 0,
      guests: 0,
      blocked: 0,
      activeInLast24Hours: 0,
    };
    users.forEach((entry) => {
      if (entry.registrationStatus === "registered") {
        summary.registered += 1;
      } else {
        summary.guests += 1;
      }
      if (entry.isBlocked) {
        summary.blocked += 1;
      }
      if (isWithinHours(entry.lastActiveAt, 24)) {
        summary.activeInLast24Hours += 1;
      }
    });
    return summary;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return users.filter((entry) => {
      if (
        userRegistrationFilter !== "all" &&
        entry.registrationStatus !== userRegistrationFilter
      ) {
        return false;
      }
      if (userBlockedFilter === "blocked" && !entry.isBlocked) return false;
      if (userBlockedFilter === "active" && entry.isBlocked) return false;
      if (!query) return true;
      const searchable = [
        entry.username,
        entry.identityId,
        entry.userId ?? "",
        entry.registrationStatus,
        entry.role,
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [userBlockedFilter, userRegistrationFilter, userSearch, users]);

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
                  void loadAll();
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

          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Quickly find any registered user or guest, then apply account actions.
                  </CardDescription>
                </div>
                <Badge variant="outline">{filteredUsers.length} shown</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total Identities</p>
                  <p className="text-lg font-semibold text-slate-900">{userSummary.total}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Registered</p>
                  <p className="text-lg font-semibold text-slate-900">{userSummary.registered}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Guests</p>
                  <p className="text-lg font-semibold text-slate-900">{userSummary.guests}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Blocked</p>
                  <p className="text-lg font-semibold text-slate-900">{userSummary.blocked}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Active in 24h</p>
                  <p className="text-lg font-semibold text-slate-900">{userSummary.activeInLast24Hours}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="user-search">Search User or Guest</Label>
                  <Input
                    id="user-search"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Username, identity ID, user ID, role"
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
                <table className="w-full min-w-[1120px] text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-3 py-3">User</th>
                      <th className="px-3 py-3">Identifiers</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Last Activity</th>
                      <th className="px-3 py-3">Usage</th>
                      <th className="px-3 py-3">Attempt Budget</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length ? (
                      filteredUsers.map((entry) => {
                        const attemptLimit = entry.attemptsUsed + entry.attemptsRemaining;
                        const attemptPercent =
                          attemptLimit > 0 ? Math.round((entry.attemptsUsed / attemptLimit) * 100) : 0;

                        return (
                          <tr key={entry.identityId} className="border-b border-slate-100 align-top">
                            <td className="px-3 py-3">
                              <p className="font-medium text-slate-900">{entry.username}</p>
                              <p className="text-xs text-slate-500">{prettyToken(entry.role)}</p>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-mono text-xs text-slate-700" title={entry.identityId}>
                                Identity: {shortId(entry.identityId, 12, 8)}
                              </p>
                              <p className="font-mono text-xs text-slate-500" title={entry.userId ?? undefined}>
                                User: {entry.userId ? shortId(entry.userId, 10, 8) : "Guest only"}
                              </p>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-2">
                                <Badge
                                  variant={
                                    entry.registrationStatus === "registered" ? "secondary" : "outline"
                                  }
                                >
                                  {prettyToken(entry.registrationStatus)}
                                </Badge>
                                <Badge variant={entry.isBlocked ? "destructive" : "secondary"}>
                                  {entry.isBlocked ? "Blocked" : "Allowed"}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-xs">
                              <p className="font-medium text-slate-700">{dateTimeLabel(entry.lastActiveAt)}</p>
                              <p className="text-slate-500">
                                Registered:{" "}
                                {entry.registrationStatus === "registered"
                                  ? dateTimeLabel(entry.registrationDate)
                                  : "No"}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-xs">
                              <p className="font-medium text-slate-700">
                                {entry.totalSessions.toLocaleString()} sessions
                              </p>
                              <p className="text-slate-500">{durationLabel(entry.totalDurationMs)} total time</p>
                            </td>
                            <td className="px-3 py-3 text-xs">
                              {entry.registrationStatus === "guest" ? (
                                <div className="space-y-2">
                                  <p className="font-medium text-slate-700">
                                    {entry.attemptsUsed}/{attemptLimit}
                                  </p>
                                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className="h-full rounded-full bg-amber-500"
                                      style={{ width: `${Math.min(100, attemptPercent)}%` }}
                                    />
                                  </div>
                                  <p className="text-slate-500">{entry.attemptsRemaining} remaining</p>
                                </div>
                              ) : (
                                <p className="text-slate-500">Not limited for registered users</p>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    focusActivityForUser(entry.identityId);
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
                                          targetType: entry.userId ? "user" : "identity",
                                          targetId: entry.userId ?? entry.identityId,
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
                                          targetType: entry.userId ? "user" : "identity",
                                          targetId: entry.userId ?? entry.identityId,
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
                        <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                          No users found for the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                                focusActivityForUser(entry.userIdentifier);
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
