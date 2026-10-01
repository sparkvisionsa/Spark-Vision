import type { MvProject } from "@/components/workspace/workspace-sections/machine-valuation/types";

export const attachmentFields = ["valuationAccountingWorkspace", "clientDocumentsWorkspace", "sceCertificateWorkspace"] as const;
export type AttachmentSnapshot = Pick<MvProject, "_id" | "name" | "updatedAt" | "reportData" | typeof attachmentFields[number]>;
const requests = new Map<string, Promise<AttachmentSnapshot>>();

export function fetchAttachmentSnapshot(projectId: string): Promise<AttachmentSnapshot> {
  const existing = requests.get(projectId);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/attachment-workspaces`, {
      credentials: "include", cache: "no-store", signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error("تعذر تحميل المرفقات. ستتم إعادة المحاولة.");
    const { project } = await response.json();
    if (project?._id !== projectId) throw new Error("Invalid attachment project");
    return project as AttachmentSnapshot;
  })().finally(() => { if (requests.get(projectId) === request) requests.delete(projectId); });
  requests.set(projectId, request);
  return request;
}

/** One request at a time; an event arriving during a request always gets a trailing refresh. */
export function watchAttachmentSnapshot(projectId: string, receive: (snapshot: AttachmentSnapshot) => void | boolean) {
  let stopped = false, running = false, queued = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let previous = "";
  const run = async () => {
    if (stopped) return;
    if (running) { queued = true; return; }
    running = true;
    try {
      const snapshot = await fetchAttachmentSnapshot(projectId);
      const key = JSON.stringify(attachmentFields.map(field => snapshot[field] ?? null));
      if (!stopped && key !== previous && receive(snapshot) !== false) previous = key;
    } catch { /* Keep visible media and retry on the next event/poll. */ }
    finally {
      running = false;
      if (queued && !stopped) { queued = false; schedule(); }
    }
  };
  const schedule = () => {
    if (stopped || timer) return;
    timer = setTimeout(() => { timer = undefined; void run(); }, 300);
  };
  const changed = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.resource === "mv" && (!detail.projectId || detail.projectId === projectId)) schedule();
  };
  const visible = () => { if (document.visibilityState === "visible") schedule(); };
  window.addEventListener("sv:resource-changed", changed);
  window.addEventListener("sv:realtime-reconnected", schedule);
  window.addEventListener("online", schedule);
  document.addEventListener("visibilitychange", visible);
  const poll = setInterval(visible, 15_000);
  void run();
  return () => {
    stopped = true; clearTimeout(timer); clearInterval(poll);
    window.removeEventListener("sv:resource-changed", changed);
    window.removeEventListener("sv:realtime-reconnected", schedule);
    window.removeEventListener("online", schedule);
    document.removeEventListener("visibilitychange", visible);
  };
}

/** Counts persisted, usable images; zero is authoritative after deletions. */
export function attachmentImageCount(workspace: unknown): number {
  if (typeof workspace === "string") {
    try { return attachmentImageCount(JSON.parse(workspace)); } catch { return 0; }
  }
  const images = (workspace as { images?: unknown[] } | null)?.images;
  if (!Array.isArray(images)) return 0;
  const ids = new Set<string>();
  for (const image of images) {
    if (!image || typeof image !== "object") continue;
    const row = image as Record<string, unknown>;
    const source = [row.fileId, row.dataUrl, row.url].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    if (source) ids.add(typeof row.id === "string" && row.id.trim() ? row.id.trim() : source.trim());
  }
  return ids.size;
}
