/** Durable upload outbox. Blobs are stored separately so resuming never loads all files into RAM. */
export type UploadFolder = { key: string; parentKey?: string; name: string; kind: "folder" | "asset"; id?: string; assetId?: string };
export type AttachmentPage = { index: number; total: number; blobKey: string; image: Record<string, unknown>; saved?: boolean };
export type UploadItem = { id: string; name: string; path: string; folderKey?: string; assetId?: string; done?: boolean;
  pages?: AttachmentPage[]; converted?: boolean; source?: Record<string, unknown> };
export type UploadJob = {
  id: string; owner: string; projectId: string; label: string; parentId: string;
  folders: UploadFolder[]; items: UploadItem[]; state: "staging" | "queued" | "uploading" | "waiting" | "error" | "done";
  createdAt: number; error?: string; retryAt?: number; attempts?: number;
  attachment?: { field: "valuationAccountingWorkspace" | "clientDocumentsWorkspace" | "sceCertificateWorkspace"; approachId?: "market" | "cost" | "comparisons"; rowsPerImage?: number };
  phase?: "converting" | "saving" | "verifying";
};
export type AttachmentProcessorContext = {
  job: UploadJob; item: UploadItem; file: File;
  checkpoint: (page?: { value: AttachmentPage; file: File }) => Promise<void>;
  readFile: (key: string) => Promise<File | undefined>;
  request: (url: string, init: RequestInit) => Promise<any>;
  active: () => boolean;
  invalidate: () => void;
};
let attachmentProcessor: ((ctx: AttachmentProcessorContext) => Promise<void>) | undefined;
export function registerAttachmentProcessor(processor: NonNullable<typeof attachmentProcessor>) { attachmentProcessor = processor; }
const DB_NAME = "sv-mv-upload-outbox";
let database: Promise<IDBDatabase> | undefined;
let owner = "";
let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let snapshot: UploadJob[] = [];
const listeners = new Set<() => void>();
const staging = new Map<string, UploadJob>();
let channel: BroadcastChannel | undefined;
let onlineListenerInstalled = false;

function db() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("jobs", { keyPath: "id" });
      request.result.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
  });
}
function committed(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Could not save upload"));
  });
}
async function read<T>(store: string, key?: string): Promise<T> {
  const transaction = (await db()).transaction(store);
  return new Promise((resolve, reject) => {
    const request = key === undefined ? transaction.objectStore(store).getAll() : transaction.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}
async function publish() {
  const jobs = await read<UploadJob[]>("jobs");
  snapshot = [...jobs, ...staging.values()].filter(job => job.owner === owner).sort((a, b) => a.createdAt - b.createdAt);
  listeners.forEach(listener => listener());
}
async function save(job: UploadJob, removeFileId?: string, page?: { value: AttachmentPage; file: File }) {
  const tx = (await db()).transaction(["jobs", "files"], "readwrite");
  const done = committed(tx);
  tx.objectStore("jobs").put(job);
  if (removeFileId) tx.objectStore("files").delete(removeFileId);
  if (page) tx.objectStore("files").put(page.file, page.value.blobKey);
  await done;
  await publish();
  channel?.postMessage("changed");
}
export const subscribeUploads = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getUploads = () => snapshot;
export const uploadOwner = (user: { id: string; companyId?: string | null }) => `${user.id}:${user.companyId ?? "personal"}`;

export async function enqueueUpload(
  input: Omit<UploadJob, "id" | "createdAt" | "state" | "items"> & { items: Array<Omit<UploadItem, "id"> & { file: File }> },
) {
  if (!owner || input.owner !== owner) throw new Error("Please sign in again before uploading.");
  const job: UploadJob = { ...input, id: crypto.randomUUID(), createdAt: Date.now(), state: "staging",
    items: input.items.map(({ file: _file, ...item }) => ({ ...item, id: crypto.randomUUID() })) };
  staging.set(job.id, job);
  snapshot = [...snapshot, job];
  listeners.forEach(listener => listener());
  const protectStaging = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
  window.addEventListener("beforeunload", protectStaging);
  // One transaction: a job is runnable only after every selected file is durable.
  try {
    const tx = (await db()).transaction(["jobs", "files"], "readwrite");
    const done = committed(tx);
    input.items.forEach((item, index) => tx.objectStore("files").put(item.file, job.items[index].id));
    tx.objectStore("jobs").put({ ...job, state: "queued" });
    await done;
  } finally {
    staging.delete(job.id);
    snapshot = snapshot.filter(row => row.id !== job.id);
    listeners.forEach(listener => listener());
    window.removeEventListener("beforeunload", protectStaging);
  }
  await publish();
  channel?.postMessage("changed");
  void navigator.storage?.persist?.().catch(() => false);
  kick();
  return job.id;
}

class UploadHttpError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function request(job: UploadJob, url: string, init: RequestInit) {
  if (owner !== job.owner) throw new UploadHttpError("Upload paused for this account", 401);
  const response = await fetch(url, { ...init, credentials: "include", signal: AbortSignal.timeout(120_000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new UploadHttpError(typeof body?.message === "string" ? body.message : `HTTP ${response.status}`, response.status);
  return body;
}
function invalidate(projectId: string) {
  window.dispatchEvent(new CustomEvent("sv:resource-changed", { detail: { resource: "mv", projectId, at: new Date().toISOString() } }));
}
async function processJob(job: UploadJob) {
  job.state = "uploading";
  job.error = undefined;
  await save(job);
  try {
    const base = `/api/mv/projects/${encodeURIComponent(job.projectId)}`;
    if (job.attachment) {
      if (!attachmentProcessor) throw new Error("Attachment processor is loading");
      await request(job, `${base}/attachment-jobs/${job.id}`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: job.attachment.field, sourceIds: job.items.map(item => item.id), label: job.label }) });
      for (const item of job.items) {
        if (item.done) continue;
        const file = await read<File | undefined>("files", item.id);
        if (!file) throw new UploadHttpError("ملف المرفق المحفوظ على الجهاز غير متاح.", 400);
        await attachmentProcessor({ job, item, file, checkpoint: page => save(job, undefined, page),
          readFile: key => read<File | undefined>("files", key), request: (url, init) => request(job, url, init),
          active: () => owner === job.owner, invalidate: () => invalidate(job.projectId) });
        item.done = true;
        await save(job);
      }
      job.phase = "verifying";
      await save(job);
      const receipt = await request(job, `${base}/attachment-jobs/${job.id}/complete`, { method: "POST" });
      if (Array.isArray(receipt?.missingPages)) {
        const missing = new Set(receipt.missingPages);
        for (const item of job.items) for (const page of item.pages ?? []) {
          if (missing.has(`${item.id}-page-${page.index}`)) { page.saved = false; item.done = false; }
        }
        await save(job);
      }
      if (!receipt?.ok) throw new Error("لم يُؤكد حفظ المرفقات في التقرير.");
      // Keep originals and generated blobs until the project linkage itself is verified.
      const tx = (await db()).transaction(["jobs", "files"], "readwrite");
      const committedJob = committed(tx);
      job.state = "done";
      tx.objectStore("jobs").put(job);
      for (const item of job.items) {
        tx.objectStore("files").delete(item.id);
        item.pages?.forEach(page => tx.objectStore("files").delete(page.blobKey));
      }
      await committedJob;
    } else {
    for (const folder of job.folders) {
      if (folder.id) continue;
      const parent = folder.parentKey ? job.folders.find(row => row.key === folder.parentKey)?.id : job.parentId;
      if (!parent) throw new UploadHttpError("Upload folder is unavailable", 400);
      const row = await request(job, `${base}/subprojects`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent, name: folder.name, folderKind: folder.kind }),
      });
      if (!row?._id) throw new Error("Invalid folder response");
      folder.id = row._id;
      folder.assetId = row.picAsset?._id;
      await save(job);
      invalidate(job.projectId);
    }
    let cursor = 0;
    const pending = job.items.filter(item => !item.done);
    let failure: unknown;
    // Keep requests small and bounded. Each file has a stable server idempotency token.
    await Promise.all(Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (!failure && cursor < pending.length) {
        const item = pending[cursor++];
        try {
          const file = await read<File | undefined>("files", item.id);
          if (!file) throw new UploadHttpError("The saved upload file is unavailable", 400);
          const folder = job.folders.find(row => row.key === item.folderKey);
          const assetId = item.assetId || folder?.assetId || folder?.id;
          if (!assetId) throw new UploadHttpError("Upload asset is unavailable", 400);
          const form = new FormData();
          form.append("files", file, item.name);
          form.append("paths", item.path);
          form.append("uploadKeys", item.id);
          const rows = await request(job, `${base}/asset-image-files?picAssetFolderId=${encodeURIComponent(assetId)}`, { method: "POST", body: form });
          if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Upload was not acknowledged");
          item.done = true;
          // The receipt and blob deletion commit together, including after an interrupted response.
          await save(job, item.id);
          invalidate(job.projectId);
        } catch (error) { failure = error; }
      }
    }));
    if (failure) throw failure;
    }
    job.state = "done";
    job.attempts = 0;
  } catch (error) {
    const status = error instanceof UploadHttpError ? error.status :
      error instanceof Error && ["InvalidPDFException", "PasswordException"].includes(error.name) ? 400 : 0;
    const retryable = !status || status === 408 || status === 409 || status === 429 || status >= 500;
    job.state = retryable ? "waiting" : "error";
    job.error = error instanceof Error ? error.message : String(error);
    job.attempts = (job.attempts ?? 0) + 1;
    job.retryAt = Date.now() + Math.min(60_000, 2000 * 2 ** Math.min(job.attempts, 5));
  }
  await save(job);
  invalidate(job.projectId);
}
async function drain() {
  while (owner && navigator.onLine) {
    const jobs = await read<UploadJob[]>("jobs");
    const job = jobs.find(row => row.owner === owner && ["queued", "uploading", "waiting"].includes(row.state) && (row.retryAt ?? 0) <= Date.now());
    if (!job) break;
    await processJob(job);
  }
}
function kick() {
  if (running || !owner) return;
  if (timer) clearTimeout(timer);
  running = true;
  // Web Locks prevent two tabs from resuming the same outbox concurrently.
  const run = navigator.locks
    ? navigator.locks.request(DB_NAME, { ifAvailable: true }, lock => lock ? drain() : Promise.resolve())
    : drain();
  void run.catch(() => undefined).finally(() => {
    running = false;
    if (owner && snapshot.some(job => ["queued", "uploading", "waiting"].includes(job.state))) timer = setTimeout(kick, 3000);
  });
}
export function setUploadAccount(nextOwner: string) {
  owner = nextOwner;
  snapshot = [];
  listeners.forEach(listener => listener());
  if (!nextOwner) { if (timer) clearTimeout(timer); return; }
  if (!onlineListenerInstalled) {
    window.addEventListener("online", kick);
    onlineListenerInstalled = true;
  }
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(DB_NAME);
    channel.onmessage = () => { void publish().then(kick).catch(() => undefined); };
  }
  void publish().then(kick).catch(() => undefined);
}
export async function retryUpload(id: string) {
  const job = await read<UploadJob>("jobs", id);
  if (!job || job.owner !== owner || !["error", "waiting"].includes(job.state)) return;
  job.state = "queued"; job.retryAt = 0; job.attempts = 0;
  await save(job); kick();
}
export async function dismissUpload(id: string) {
  const existing = await read<UploadJob>("jobs", id);
  if (existing?.state === "done") return removeUpload(id);
  if (navigator.locks) {
    return navigator.locks.request(DB_NAME, { ifAvailable: true }, async lock => {
      if (!lock) throw new Error("تجري معالجة الملفات الآن. حاول مجددًا بعد قليل.");
      await removeUpload(id);
    });
  }
  if (running) throw new Error("تجري معالجة الملفات الآن. حاول مجددًا بعد قليل.");
  await removeUpload(id);
}
async function removeUpload(id: string) {
  const job = await read<UploadJob>("jobs", id);
  if (!job || job.owner !== owner || !["done", "error", "waiting"].includes(job.state)) return;
  if (job.attachment && job.state !== "done") {
    await request(job, `/api/mv/projects/${encodeURIComponent(job.projectId)}/attachment-jobs/${job.id}`, { method: "DELETE" });
    invalidate(job.projectId);
  }
  const tx = (await db()).transaction(["jobs", "files"], "readwrite");
  const done = committed(tx);
  tx.objectStore("jobs").delete(id);
  job.items.forEach(item => {
    tx.objectStore("files").delete(item.id);
    item.pages?.forEach(page => tx.objectStore("files").delete(page.blobKey));
  });
  await done; await publish(); channel?.postMessage("changed");
}
