import { hasMeaningfulSimpleReportData } from "./mv-simple-project-progress";
import { MvApiError, mvFetchJson } from "./mv-api-client";
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

/**
 * Clone reportData from source into target.
 * Prefers dedicated Nest endpoint; falls back to GET + PATCH if unavailable.
 */
export async function cloneReportDataFromProject(args: {
  targetProjectId: string;
  sourceProjectId: string;
}): Promise<{ empty: boolean; project: MvProject | null }> {
  const { targetProjectId, sourceProjectId } = args;
  try {
    const result = await mvFetchJson<{
      ok?: boolean;
      empty?: boolean;
      project?: MvProject | null;
    }>(`/api/mv/projects/${encodeURIComponent(targetProjectId)}/clone-report-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceProjectId }),
    });
    if (result.empty || !result.project) {
      return { empty: true, project: null };
    }
    return { empty: false, project: result.project };
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }

  const sourcePayload = await mvFetchJson<{ project?: MvProject }>(
    `/api/mv/projects/${encodeURIComponent(sourceProjectId)}?picAssetMode=summary`,
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
  );
  return { empty: false, project: patched.project ?? null };
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
    );
    if (result.project?._id) return result.project;
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }

  const [sourcePayload, list] = await Promise.all([
    mvFetchJson<{ project?: MvProject }>(
      `/api/mv/projects/${encodeURIComponent(sourceProjectId)}?picAssetMode=summary`,
    ),
    mvFetchJson<Array<Pick<MvProject, "_id" | "name">>>("/api/mv/projects"),
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

  const created = await mvFetchJson<MvProject>("/api/mv/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });

  const reportData = source.reportData;
  if (!reportData || !hasMeaningfulSimpleReportData(reportData)) {
    return created;
  }

  const patched = await mvFetchJson<{ project?: MvProject }>(
    `/api/mv/projects/${encodeURIComponent(created._id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportData }),
    },
  );
  return patched.project ?? created;
}
