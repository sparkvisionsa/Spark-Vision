/**
 * Session cache for Word / PowerPoint PDF previews.
 * Survives in-app navigation without reconverting the same template.
 */

export type FinalReportPreviewFormat = "word" | "pptx";

export type CachedFinalReportPreview = {
  source: FinalReportPreviewFormat;
  blob: Blob;
  stamp: string;
};

const memory = new Map<string, CachedFinalReportPreview>();
const DB_NAME = "spark-vision-final-report-preview";
const STORE = "pdfs";

export function finalReportPreviewCacheKey(
  projectId: string,
  format: FinalReportPreviewFormat,
): string {
  return `${projectId}:${format}`;
}

export function finalReportPreviewStamp(input: {
  templateId: string;
  updatedAt?: string | null;
  assetImagesPerRow?: number;
  clientImagesPerRow?: number;
}): string {
  return [
    input.templateId.trim(),
    String(input.updatedAt ?? "").trim(),
    String(input.assetImagesPerRow ?? ""),
    String(input.clientImagesPerRow ?? ""),
  ].join("|");
}

export function readFinalReportPreviewCache(
  key: string,
  stamp: string,
): CachedFinalReportPreview | null {
  const row = memory.get(key);
  if (!row || row.stamp !== stamp || row.blob.size < 32) return null;
  return row;
}

export function writeFinalReportPreviewCache(
  key: string,
  entry: CachedFinalReportPreview,
): void {
  memory.set(key, entry);
  void persistPreview(key, entry);
}

export async function readFinalReportPreviewCacheAsync(
  key: string,
  stamp: string,
): Promise<CachedFinalReportPreview | null> {
  const memoryHit = readFinalReportPreviewCache(key, stamp);
  if (memoryHit) return memoryHit;
  const stored = await loadPreview(key);
  if (!stored || stored.stamp !== stamp || stored.blob.size < 32) return null;
  memory.set(key, stored);
  return stored;
}

function openPreviewDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function persistPreview(key: string, entry: CachedFinalReportPreview): Promise<void> {
  const db = await openPreviewDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.objectStore(STORE).put(entry, key);
    });
  } catch {
    /* ignore quota */
  } finally {
    db.close();
  }
}

async function loadPreview(key: string): Promise<CachedFinalReportPreview | null> {
  const db = await openPreviewDb();
  if (!db) return null;
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(key);
      request.onsuccess = () => {
        const value = request.result as CachedFinalReportPreview | undefined;
        resolve(value && value.blob instanceof Blob ? value : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}
