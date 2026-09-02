/**
 * Unified project summary loader for Machine Valuation.
 * Memory + sessionStorage + network with SWR / single-flight.
 */
import {
  invalidateMvApiCache,
  isMvAbortError,
  mvFetchJson,
  peekMvApiCache,
  seedMvApiCache,
} from "./mv-api-client";
import {
  MV_WORKFLOW_SESSION,
  readMvWorkflowSessionJson,
  writeMvWorkflowSessionJson,
} from "./mv-workflow-session-cache";
import type { MvProject, MvSubProject } from "./types";

export type MvProjectSummaryMode = "report" | "summary";

export type MvProjectSummaryPayload = {
  project: MvProject;
  subProjects: MvSubProject[];
  fetchedAt: number;
  mode: MvProjectSummaryMode;
};

const REPORT_DATA_SESSION_KEY = (projectId: string) => `sv:mv:report-data:${projectId}`;

function memoryCacheKey(projectId: string, mode: MvProjectSummaryMode) {
  return `project-${mode}:${projectId}`;
}

function networkUrl(projectId: string, mode: MvProjectSummaryMode) {
  const picAssetMode = mode === "report" ? "report" : "summary";
  return `/api/mv/projects/${encodeURIComponent(projectId)}?picAssetMode=${picAssetMode}`;
}

function isUsablePayload(
  value: unknown,
  projectId: string,
): value is { project: MvProject; subProjects?: MvSubProject[] } {
  if (!value || typeof value !== "object") return false;
  const row = value as { project?: MvProject };
  return Boolean(row.project?._id && row.project._id === projectId);
}

function normalizePayload(
  projectId: string,
  mode: MvProjectSummaryMode,
  data: { project: MvProject; subProjects?: MvSubProject[] },
  fetchedAt = Date.now(),
): MvProjectSummaryPayload {
  return {
    project: data.project,
    subProjects: Array.isArray(data.subProjects) ? data.subProjects : [],
    fetchedAt,
    mode,
  };
}

function isProjectNewerThan(
  candidate: MvProject,
  baseline: MvProject,
): boolean {
  const candidateUpdatedAt = Date.parse(candidate.updatedAt ?? "");
  const baselineUpdatedAt = Date.parse(baseline.updatedAt ?? "");
  return (
    Number.isFinite(candidateUpdatedAt) &&
    (!Number.isFinite(baselineUpdatedAt) || candidateUpdatedAt > baselineUpdatedAt)
  );
}

export function readProjectSummaryCache(
  projectId: string,
  mode: MvProjectSummaryMode = "summary",
): MvProjectSummaryPayload | null {
  const mem = peekMvApiCache<{ project: MvProject; subProjects?: MvSubProject[] }>(
    memoryCacheKey(projectId, mode),
  );
  if (isUsablePayload(mem, projectId)) {
    return normalizePayload(projectId, mode, mem);
  }

  if (typeof window === "undefined") return null;

  if (mode === "report") {
    try {
      const raw = window.sessionStorage.getItem(REPORT_DATA_SESSION_KEY(projectId));
      if (raw) {
        const parsed = JSON.parse(raw) as { project?: MvProject; subProjects?: MvSubProject[] };
        if (isUsablePayload(parsed, projectId)) {
          return normalizePayload(projectId, mode, parsed);
        }
      }
    } catch {
      /* ignore */
    }
  }

  const summary = readMvWorkflowSessionJson<{
    project?: MvProject;
    subProjects?: MvSubProject[];
    fetchedAt?: number;
  }>(MV_WORKFLOW_SESSION.projectSummary(projectId));
  if (isUsablePayload(summary, projectId)) {
    const fetchedAt =
      summary && typeof summary === "object" && "fetchedAt" in summary && typeof summary.fetchedAt === "number"
        ? summary.fetchedAt
        : Date.now();
    return normalizePayload(projectId, mode, summary, fetchedAt);
  }
  return null;
}

export function writeProjectSummaryCache(
  projectId: string,
  data: { project: MvProject; subProjects?: MvSubProject[] },
  mode: MvProjectSummaryMode = "summary",
) {
  if (!isUsablePayload(data, projectId)) return;

  // A project card can remain mounted briefly after report data has been
  // saved. Do not let that older card replace the selected report model in
  // the report cache while navigating back into the same project.
  if (mode === "report") {
    const cached = readProjectSummaryCache(projectId, "report");
    if (cached && isProjectNewerThan(cached.project, data.project)) return;
  }

  const payload = normalizePayload(projectId, mode, data);
  seedMvApiCache(memoryCacheKey(projectId, mode), {
    project: payload.project,
    subProjects: payload.subProjects,
  }, 60_000, 10 * 60_000);

  if (mode === "report") {
    // وضع التقرير يعيد subProjects: [] عمداً — لا تُسمَّم شاشة صور الأصول / الشجرة المشتركة.
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          REPORT_DATA_SESSION_KEY(projectId),
          JSON.stringify({ project: payload.project, subProjects: payload.subProjects }),
        );
      } catch {
        /* ignore quota */
      }
    }
    return;
  }

  // Keep a shared summary seed so other screens open instantly.
  seedMvApiCache(`project-summary:${projectId}`, {
    project: payload.project,
    subProjects: payload.subProjects,
  }, 60_000, 10 * 60_000);

  writeMvWorkflowSessionJson(MV_WORKFLOW_SESSION.projectSummary(projectId), {
    project: payload.project,
    subProjects: payload.subProjects,
    fetchedAt: payload.fetchedAt,
  });
}

export function invalidateProjectSummaryCache(projectId?: string) {
  if (!projectId) {
    invalidateMvApiCache("project-");
    invalidateMvApiCache("project-summary:");
    invalidateMvApiCache("project-pic-folders:");
    return;
  }
  invalidateMvApiCache(`project-report:${projectId}`);
  invalidateMvApiCache(`project-summary:${projectId}`);
  invalidateMvApiCache(`project-pic-folders:${projectId}`);
}

/**
 * Load project summary with cache-first + SWR.
 * Never throws AbortError to callers that pass a signal — rethrows other errors.
 */
export async function loadProjectSummary(
  projectId: string,
  options: {
    mode?: MvProjectSummaryMode;
    signal?: AbortSignal;
    forceRefresh?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<MvProjectSummaryPayload> {
  const mode = options.mode ?? "summary";
  const cacheKey = memoryCacheKey(projectId, mode);

  if (!options.forceRefresh) {
    const local = readProjectSummaryCache(projectId, mode);
    // لا تزرع ملخصاً بلا مجلدات — غالباً بقايا وضع التقرير القديم، وتمنع ظهور صور الأصول
    const shouldSeed =
      local &&
      (mode === "report" || local.subProjects.length > 0 || (local.project.subProjectCount ?? 0) === 0);
    if (local && shouldSeed) {
      seedMvApiCache(
        cacheKey,
        { project: local.project, subProjects: local.subProjects },
        15_000,
        10 * 60_000,
      );
    }
  }

  const data = await mvFetchJson<{ project: MvProject; subProjects?: MvSubProject[] }>(
    networkUrl(projectId, mode),
    { signal: options.signal },
    {
      cacheKey,
      cacheTtlMs: 60_000,
      staleTtlMs: 10 * 60_000,
      forceRefresh: options.forceRefresh,
      retries: 2,
      timeoutMs: options.timeoutMs ?? (mode === "report" ? 30_000 : 25_000),
      trackLoading: false,
    },
  );

  if (options.signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
  if (!isUsablePayload(data, projectId)) {
    throw new Error("Invalid project payload");
  }

  const payload = normalizePayload(projectId, mode, data);
  writeProjectSummaryCache(projectId, payload, mode);
  return payload;
}

export async function loadProjectSummarySafe(
  projectId: string,
  options: {
    mode?: MvProjectSummaryMode;
    signal?: AbortSignal;
    forceRefresh?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<{ payload: MvProjectSummaryPayload | null; error: unknown | null; fromCache: boolean }> {
  const mode = options.mode ?? "summary";
  const cached = !options.forceRefresh ? readProjectSummaryCache(projectId, mode) : null;
  try {
    const payload = await loadProjectSummary(projectId, options);
    return { payload, error: null, fromCache: false };
  } catch (error) {
    if (options.signal?.aborted || isMvAbortError(error)) {
      return { payload: cached, error: null, fromCache: Boolean(cached) };
    }
    if (cached) {
      return { payload: cached, error: null, fromCache: true };
    }
    return { payload: null, error, fromCache: false };
  }
}
