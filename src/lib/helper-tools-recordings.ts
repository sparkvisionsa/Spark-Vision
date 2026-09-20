import type { RecorderSurface } from "@/hooks/use-screen-recorder";

export type RecordingOwnerKind = "user" | "guest";

export type RecordingOwner = {
  kind: RecordingOwnerKind;
  key: string;
  label: string;
  sessionId: string;
};

export const GUEST_OWNER_LABEL = "ضيف";

export type StoredRecordingMeta = {
  id: string;
  createdAt: number;
  source: RecorderSurface;
  seconds: number;
  description: string;
  mime: string;
  size: number;
  ownerKey: string;
  ownerKind: RecordingOwnerKind;
  ownerLabel: string;
  remoteId?: string;
};

export type StoredRecording = StoredRecordingMeta & { blob: Blob };

const DB_NAME = "value-tech-helper-recordings";
const META = "meta";
const BLOBS = "blobs";
const VERSION = 2;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
        if (!db.objectStoreNames.contains(META)) {
          const store = db.createObjectStore(META, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt");
          store.createIndex("source", "source");
          store.createIndex("ownerKey", "ownerKey");
        } else if (oldVersion < 2) {
          const store = request.transaction?.objectStore(META);
          if (store && !store.indexNames.contains("ownerKey")) store.createIndex("ownerKey", "ownerKey");
        }
        if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb"));
  });
}

function belongsToOwner(row: StoredRecordingMeta, ownerKey: string) {
  return Boolean(row?.id && row.ownerKey === ownerKey && Number.isFinite(row.createdAt));
}

export function recordingOwnerFromAuth(input: {
  userId?: string | null;
  username?: string | null;
  companyId?: string | null;
  sessionId?: string | null;
  sessionActive?: boolean;
}): RecordingOwner | null {
  if (input.userId) {
    return {
      kind: "user",
      key: `user:${input.userId}:${input.companyId ?? ""}`,
      label: input.username?.trim() || "مستخدم",
      sessionId: input.sessionId ?? "",
    };
  }
  if (input.sessionId && input.sessionActive !== false) {
    return {
      kind: "guest",
      key: `guest:${input.sessionId}`,
      label: GUEST_OWNER_LABEL,
      sessionId: input.sessionId,
    };
  }
  return null;
}

export async function listScreenRecordings(ownerKey: string, source?: RecorderSurface): Promise<StoredRecordingMeta[]> {
  if (!ownerKey) return [];
  const db = await openDb();
  if (!db) return [];
  try {
    const tx = db.transaction(META, "readonly");
    const store = tx.objectStore(META);
    const rows = source
      ? await requestValue(store.index("source").getAll(source))
      : await requestValue(store.getAll());
    return (rows as StoredRecordingMeta[])
      .filter((row) => belongsToOwner(row, ownerKey))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export async function readScreenRecording(id: string, ownerKey: string): Promise<StoredRecording | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction([META, BLOBS], "readonly");
    const meta = await requestValue(tx.objectStore(META).get(id)) as StoredRecordingMeta | undefined;
    const blob = await requestValue(tx.objectStore(BLOBS).get(id)) as Blob | undefined;
    if (!meta?.id || meta.ownerKey !== ownerKey || !(blob instanceof Blob) || !blob.size) return null;
    return { ...meta, blob };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function saveScreenRecording(input: {
  blob: Blob;
  source: RecorderSurface;
  seconds: number;
  description: string;
  owner: RecordingOwner;
}): Promise<StoredRecordingMeta> {
  const meta: StoredRecordingMeta = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    source: input.source,
    seconds: Math.max(0, Math.floor(input.seconds)),
    description: input.description.trim().slice(0, 200),
    mime: input.blob.type || "video/webm",
    size: input.blob.size,
    ownerKey: input.owner.key,
    ownerKind: input.owner.kind,
    ownerLabel: input.owner.kind === "guest" ? GUEST_OWNER_LABEL : input.owner.label,
  };
  const db = await openDb();
  if (!db) throw new Error("تعذّر حفظ التسجيل على هذا الجهاز.");
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([META, BLOBS], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("تعذّر حفظ التسجيل. قد تكون مساحة المتصفح ممتلئة."));
      tx.objectStore(META).put(meta);
      tx.objectStore(BLOBS).put(input.blob, meta.id);
    });
    return meta;
  } finally {
    db.close();
  }
}

export async function markScreenRecordingRemote(id: string, ownerKey: string, remoteId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(META, "readwrite");
    const store = tx.objectStore(META);
    const current = await requestValue(store.get(id)) as StoredRecordingMeta | undefined;
    if (!current || current.ownerKey !== ownerKey) return;
    await requestValue(store.put({ ...current, remoteId }));
  } finally {
    db.close();
  }
}

export async function updateScreenRecordingDescription(id: string, ownerKey: string, description: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(META, "readwrite");
    const store = tx.objectStore(META);
    const current = await requestValue(store.get(id)) as StoredRecordingMeta | undefined;
    if (!current || current.ownerKey !== ownerKey) return;
    await requestValue(store.put({ ...current, description: description.trim().slice(0, 200) }));
  } finally {
    db.close();
  }
}

export async function deleteScreenRecording(id: string, ownerKey: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction([META, BLOBS], "readwrite");
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const current = await requestValue(tx.objectStore(META).get(id)) as StoredRecordingMeta | undefined;
    if (current && current.ownerKey === ownerKey) {
      tx.objectStore(META).delete(id);
      tx.objectStore(BLOBS).delete(id);
    }
    await done;
  } catch {
    /* ignore */
  } finally {
    db.close();
  }
}
