import { hasMeaningfulSimpleReportData } from "./mv-simple-project-progress";
import {
  invalidateMvApiCache,
  isMvTransientError,
  MvApiError,
  mvFetchJson,
} from "./mv-api-client";
import {
  writeProjectSummaryCache,
} from "./mv-project-summary-loader";
import type { MvProject, MvProjectReportData } from "./types";

/** Windows-style: `Name - نسخة` / `Name - Copy`, then `(2)`, `(3)`, … */
export function buildWindowsStyleCopyName(
  baseName: string,
  existingNames: Iterable<string>,
  isArabic: boolean,
): string {
  const base = baseName.trim() || (isArabic ? "مشروع" : "Project");
  const suffix = isArabic ? "نسخة" : "Copy";
  const existing = new Set(
    [...existingNames]
      .map((name) => name.trim().toLocaleLowerCase())
      .filter(Boolean),
  );
  const first = `${base} - ${suffix}`;
  if (!existing.has(first.toLocaleLowerCase())) return first;
  for (let n = 2; n < 10_000; n += 1) {
    const candidate = `${base} - ${suffix} (${n})`;
    if (!existing.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${base} - ${suffix} (${Date.now()})`;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof MvApiError && error.status === 404;
}

function shouldFallbackClone(error: unknown): boolean {
  return isNotFoundError(error) || isMvTransientError(error);
}

async function cloneReportDataViaGetPatch(args: {
  targetProjectId: string;
  sourceProjectId: string;
}): Promise<{ empty: boolean; project: MvProject | null }> {
  const { targetProjectId, sourceProjectId } = args;
  const sourcePayload = await mvFetchJson<{ project?: MvProject }>(
    `/api/mv/projects/${encodeURIComponent(sourceProjectId)}?picAssetMode=report`,
    {},
    {
      cacheKey: `project-report:${sourceProjectId}`,
      cacheTtlMs: 60_000,
      staleTtlMs: 10 * 60_000,
      retries: 2,
      timeoutMs: 45_000,
    },
  );
  const reportData = sourcePayload.project?.reportData as MvProjectReportData | undefined;
  if (!hasMeaningfulSimpleReportData(reportData)) {
    return { empty: true, project: null };
  }

  const patched = await mvFetchJson<{ project?: MvProject }>(
    `/api/mv/projects/${encodeURIComponent(targetProjectId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportData }),
    },
    {
      timeoutMs: 60_000,
      retries: 1,
      retryMutations: true,
    },
  );
  return { empty: false, project: patched.project ?? null };
}

/**
 * Clone reportData from source into target.
 * Prefers dedicated Nest endpoint; falls back to GET + PATCH on missing route or transient failures.
 */
export async function cloneReportDataFromProject(args: {
  targetProjectId: string;
  sourceProjectId: string;
}): Promise<{ empty: boolean; project: MvProject | null }> {
  const { targetProjectId, sourceProjectId } = args;
  let result: { empty: boolean; project: MvProject | null };

  try {
    const remote = await mvFetchJson<{
      ok?: boolean;
      empty?: boolean;
      project?: MvProject | null;
    }>(
      `/api/mv/projects/${encodeURIComponent(targetProjectId)}/clone-report-data`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceProjectId }),
      },
      {
        timeoutMs: 90_000,
        retries: 1,
        retryMutations: true,
        retryBaseMs: 700,
      },
    );
    if (remote.empty || !remote.project) {
      result = { empty: true, project: null };
    } else {
      result = { empty: false, project: remote.project };
    }
  } catch (error) {
    if (!shouldFallbackClone(error)) throw error;
    result = await cloneReportDataViaGetPatch(args);
  }

  if (result.project?._id) {
    writeProjectSummaryCache(
      targetProjectId,
      { project: result.project, subProjects: [] },
      "report",
    );
    invalidateMvApiCache("projects:");
  }

  return result;
}

/**
 * Duplicate project with reportData only.
 * Prefers dedicated Nest endpoint; falls back to create + PATCH.
 */
export async function duplicateMvProject(args: {
  sourceProjectId: string;
  isArabic: boolean;
  companyId?: string | null;
}): Promise<MvProject> {
  const { sourceProjectId, isArabic, companyId } = args;
  try {
    const result = await mvFetchJson<{ ok?: boolean; project?: MvProject }>(
      `/api/mv/projects/${encodeURIComponent(sourceProjectId)}/duplicate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: isArabic ? "ar" : "en" }),
      },
      {
        timeoutMs: 90_000,
        retries: 1,
        retryMutations: true,
      },
    );
    if (result.project?._id) {
      invalidateMvApiCache("projects:");
      return result.project;
    }
  } catch (error) {
    if (!isNotFoundError(error) && !isMvTransientError(error)) throw error;
  }

  const [sourcePayload, list] = await Promise.all([
    mvFetchJson<{ project?: MvProject }>(
      `/api/mv/projects/${encodeURIComponent(sourceProjectId)}?picAssetMode=report`,
      {},
      {
        cacheKey: `project-report:${sourceProjectId}`,
        cacheTtlMs: 60_000,
        retries: 2,
        timeoutMs: 45_000,
      },
    ),
    mvFetchJson<Array<Pick<MvProject, "_id" | "name">>>("/api/mv/projects", {}, {
      cacheKey: "projects:list",
      cacheTtlMs: 20_000,
      retries: 2,
      timeoutMs: 45_000,
    }),
  ]);
  const source = sourcePayload.project;
  if (!source?._id) throw new Error("Source project not found");

  const newName = buildWindowsStyleCopyName(
    source.name || "",
    (Array.isArray(list) ? list : []).map((row) => row.name || ""),
    isArabic,
  );

  const createBody: Record<string, unknown> = {
    name: newName,
    reportType: source.reportType ?? "simple",
    locations: [],
    contacts: [],
  };
  if (companyId?.trim()) createBody.companyId = companyId.trim();

  const created = await mvFetchJson<MvProject>(
    "/api/mv/projects",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    },
    { timeoutMs: 60_000, retries: 1, retryMutations: true },
  );

  const reportData = source.reportData;
  if (!reportData || !hasMeaningfulSimpleReportData(reportData)) {
    invalidateMvApiCache("projects:");
    return created;
  }

  const patched = await mvFetchJson<{ project?: MvProject }>(
    `/api/mv/projects/${encodeURIComponent(created._id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportData }),
    },
    { timeoutMs: 60_000, retries: 1, retryMutations: true },
  );
  invalidateMvApiCache("projects:");
  return patched.project ?? created;
}
