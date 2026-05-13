import { isMvMainWorkflowSlug, type MvMainWorkflowSlug } from "./mv-main-workflow-model";

const STORAGE_PREFIX = "mv:main-workflow-done:";

/** يُطلق بعد تحديث sessionStorage لنفس التبويب */
export const MV_MAIN_WORKFLOW_PROGRESS_EVENT = "sv:mv-main-workflow-progress";

function storageKey(projectId: string) {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function readCompletedMainPhases(projectId: string): MvMainWorkflowSlug[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => (typeof s === "string" && s === "folders" ? "asset-images" : s))
      .filter(
        (s): s is MvMainWorkflowSlug => typeof s === "string" && isMvMainWorkflowSlug(s),
      );
  } catch {
    return [];
  }
}

/** يُستدعى عند «حفظ والتالي» قبل الانتقال — يُعلّم المرحلة الحالية كمكتملة بالحفظ */
export function markMainPhaseCompleted(projectId: string, slug: MvMainWorkflowSlug): void {
  if (typeof window === "undefined") return;
  const cur = readCompletedMainPhases(projectId);
  if (!cur.includes(slug)) cur.push(slug);
  sessionStorage.setItem(storageKey(projectId), JSON.stringify(cur));
  window.dispatchEvent(new Event(MV_MAIN_WORKFLOW_PROGRESS_EVENT));
}
