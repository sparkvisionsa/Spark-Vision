import { fetchWithRetry } from "./mv-concurrent-fetch";
import {
  buildAssetParentFolderPath,
  isPhotosSubfolderName,
  isRootSubProjectParent,
  sortSubProjectsForDisplay,
} from "./mv-subproject-helpers";
import type { MvSubProject, PicAsset } from "./types";

export type PicAssetFolderEntry = { sub: MvSubProject; picAsset: PicAsset | null };

const picAssetDetailInFlight = new Map<
  string,
  Promise<{ sub: MvSubProject; picAsset: PicAsset | null } | null>
>();

export function picAssetNeedsMediaFetch(pic: PicAsset | null): boolean {
  if (!pic) return false;
  const expectedImages =
    typeof pic.imageCount === "number" && Number.isFinite(pic.imageCount)
      ? Math.max(0, pic.imageCount)
      : null;
  if (!Array.isArray(pic.images)) return true;
  if (expectedImages !== null && pic.images.length !== expectedImages) return true;
  const expectedVoice =
    typeof pic.voiceNoteCount === "number" && Number.isFinite(pic.voiceNoteCount)
      ? Math.max(0, pic.voiceNoteCount)
      : null;
  if (!Array.isArray(pic.voiceNotes)) return true;
  return expectedVoice !== null && pic.voiceNotes.length !== expectedVoice;
}

export function entryHasFullPicAssetMedia(pic: PicAsset | null): boolean {
  return !picAssetNeedsMediaFetch(pic);
}

function picAssetTimestamp(pic: PicAsset | null): number {
  if (!pic?.updatedAt) return 0;
  const t = Date.parse(pic.updatedAt);
  return Number.isFinite(t) ? t : 0;
}

/**
 * دمج سجل أصل: الحقول النصية من الأحدث (حسب ‎updatedAt‎، والسيرفر عند التساوي)،
 * والوسائط (صور/صوت) من الأكثر اكتمالاً. يُكمّل الحقول الناقصة من المصدر الآخر
 * (مثل ‎subAssetType‎ الذي قد يغيب من ذاكرة الجلسة القديمة).
 */
export function mergePicAssetPreferFull(
  existing: PicAsset | null,
  incoming: PicAsset | null,
): PicAsset | null {
  if (!incoming && !existing) return null;
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingImages = Array.isArray(existing.images) ? existing.images : [];
  const incomingImages = Array.isArray(incoming.images) ? incoming.images : [];
  const existingVoice = Array.isArray(existing.voiceNotes) ? existing.voiceNotes : [];
  const incomingVoice = Array.isArray(incoming.voiceNotes) ? incoming.voiceNotes : [];

  const existingTs = picAssetTimestamp(existing);
  const incomingTs = picAssetTimestamp(incoming);
  const primary = incomingTs >= existingTs ? incoming : existing;
  const secondary = primary === incoming ? existing : incoming;

  const completeMediaArray = (
    pic: PicAsset,
    key: "images" | "voiceNotes",
    countKey: "imageCount" | "voiceNoteCount",
  ) => {
    const media = pic[key];
    if (!Array.isArray(media)) return false;
    const rawCount = pic[countKey];
    if (typeof rawCount !== "number" || !Number.isFinite(rawCount)) return true;
    return media.length === Math.max(0, rawCount);
  };

  const existingImagesComplete = completeMediaArray(existing, "images", "imageCount");
  const incomingImagesComplete = completeMediaArray(incoming, "images", "imageCount");
  const existingVoiceComplete = completeMediaArray(existing, "voiceNotes", "voiceNoteCount");
  const incomingVoiceComplete = completeMediaArray(incoming, "voiceNotes", "voiceNoteCount");

  const chooseMedia = <T>(
    existingRows: T[],
    incomingRows: T[],
    existingComplete: boolean,
    incomingComplete: boolean,
  ) => {
    if (incomingComplete && (!existingComplete || incomingTs >= existingTs)) return incomingRows;
    if (existingComplete) return existingRows;
    if (incomingComplete) return incomingRows;
    return incomingRows.length >= existingRows.length ? incomingRows : existingRows;
  };

  const selectedImages = chooseMedia(
    existingImages,
    incomingImages,
    existingImagesComplete,
    incomingImagesComplete,
  );
  const selectedVoice = chooseMedia(
    existingVoice,
    incomingVoice,
    existingVoiceComplete,
    incomingVoiceComplete,
  );

  const pickScalar = <K extends keyof PicAsset>(key: K): PicAsset[K] => {
    const a = primary[key];
    const b = secondary[key];
    if (a !== null && a !== undefined && a !== "") return a;
    if (b !== null && b !== undefined && b !== "") return b;
    return a ?? b;
  };

  return {
    ...primary,
    name: pickScalar("name"),
    lable: pickScalar("lable"),
    client_code: pickScalar("client_code"),
    employer: pickScalar("employer"),
    val_tech_id: pickScalar("val_tech_id"),
    writtenDescription: pickScalar("writtenDescription"),
    condition: pickScalar("condition"),
    notes: pickScalar("notes"),
    assetType: pickScalar("assetType"),
    subAssetType: pickScalar("subAssetType"),
    quantity: pickScalar("quantity"),
    brand: pickScalar("brand"),
    code: pickScalar("code"),
    model: pickScalar("model"),
    manufactureYear: pickScalar("manufactureYear"),
    kilometersDriven: pickScalar("kilometersDriven"),
    mainImage: pickScalar("mainImage"),
    newAssetLocation: pickScalar("newAssetLocation"),
    isPresent: primary.isPresent ?? secondary.isPresent,
    isDone: primary.isDone ?? secondary.isDone,
    assetDescription:
      primary.assetDescription !== undefined ? primary.assetDescription : secondary.assetDescription ?? null,
    category: pickScalar("category"),
    type: pickScalar("type"),
    asset_source: pickScalar("asset_source"),
    rawData:
      primary.rawData !== undefined && primary.rawData !== null
        ? primary.rawData
        : secondary.rawData ?? primary.rawData ?? null,
    images: selectedImages,
    voiceNotes: selectedVoice,
    // العدد الأحدث يبقى مرجع الاكتمال؛ اختلافه عن المصفوفة القديمة يفرض hydration جديدًا.
    imageCount:
      typeof primary.imageCount === "number"
        ? Math.max(0, primary.imageCount)
        : typeof secondary.imageCount === "number"
          ? Math.max(0, secondary.imageCount)
          : selectedImages.length,
    voiceNoteCount:
      typeof primary.voiceNoteCount === "number"
        ? Math.max(0, primary.voiceNoteCount)
        : typeof secondary.voiceNoteCount === "number"
          ? Math.max(0, secondary.voiceNoteCount)
          : selectedVoice.length,
  };
}

/** دمج مع أولوية صريحة لحقول ‎subAssetType‎ و‎quantity‎ من استجابة الـ API. */
export function mergePicAssetFromApi(
  cached: PicAsset | null,
  fromApi: PicAsset | null,
): PicAsset | null {
  const merged = mergePicAssetPreferFull(cached, fromApi);
  if (!merged || !fromApi) return merged;
  return {
    ...merged,
    subAssetType:
      fromApi.subAssetType !== undefined && fromApi.subAssetType !== null && fromApi.subAssetType !== ""
        ? fromApi.subAssetType
        : merged.subAssetType ?? null,
    quantity:
      fromApi.quantity !== undefined && fromApi.quantity !== null && fromApi.quantity !== ""
        ? fromApi.quantity
        : merged.quantity ?? null,
    assetDescription:
      fromApi.assetDescription !== undefined
        ? fromApi.assetDescription
        : merged.assetDescription ?? null,
    category:
      fromApi.category !== undefined
        ? fromApi.category
        : merged.category ?? merged.assetDescription?.category ?? null,
    type:
      fromApi.type !== undefined
        ? fromApi.type
        : merged.type ?? merged.assetDescription?.type ?? null,
    asset_source:
      fromApi.asset_source !== undefined
        ? fromApi.asset_source
        : merged.asset_source ?? null,
    asset_location:
      fromApi.asset_location !== undefined
        ? fromApi.asset_location
        : merged.asset_location ?? null,
    lable:
      fromApi.lable !== undefined
        ? fromApi.lable
        : merged.lable ?? null,
    client_code:
      fromApi.client_code !== undefined
        ? fromApi.client_code
        : merged.client_code ?? null,
    employer:
      fromApi.employer !== undefined
        ? fromApi.employer
        : merged.employer ?? null,
    val_tech_id:
      fromApi.val_tech_id !== undefined
        ? fromApi.val_tech_id
        : merged.val_tech_id ?? null,
    newAssetLocation:
      fromApi.newAssetLocation !== undefined
        ? fromApi.newAssetLocation
        : merged.newAssetLocation ?? null,
    rawData:
      fromApi.rawData !== undefined
        ? fromApi.rawData
        : merged.rawData ?? null,
  };
}

export function buildPhotosRootAssetEntries(subProjects: MvSubProject[]): {
  previewRoot: MvSubProject | null;
  byId: Map<string, MvSubProject>;
  entries: PicAssetFolderEntry[];
} {
  const previewRoot =
    subProjects.find((s) => isRootSubProjectParent(s.parent) && isPhotosSubfolderName(s.name)) ??
    null;
  if (!previewRoot) {
    return { previewRoot: null, byId: new Map(), entries: [] };
  }
  const byId = new Map(subProjects.map((s) => [s._id, s]));
  const isUnderPhotosRoot = (sub: MvSubProject) => {
    let parent = sub.parent;
    const seen = new Set<string>();
    while (parent && parent.trim()) {
      if (parent === previewRoot._id) return true;
      if (seen.has(parent)) return false;
      seen.add(parent);
      parent = byId.get(parent)?.parent ?? null;
    }
    return false;
  };
  const children = sortSubProjectsForDisplay(subProjects.filter(isUnderPhotosRoot));
  return {
    previewRoot,
    byId,
    entries: children.map((sub) => ({ sub, picAsset: sub.picAsset ?? null })),
  };
}

export function cacheHasFullPicAssetEntries(entries: PicAssetFolderEntry[]): boolean {
  if (entries.length === 0) return false;
  return entries.every((e) => entryHasFullPicAssetMedia(e.picAsset));
}

export function fetchPicAssetDetail(
  projectId: string,
  subProjectId: string,
): Promise<{ sub: MvSubProject; picAsset: PicAsset | null } | null> {
  const key = `${projectId}:${subProjectId}`;
  const current = picAssetDetailInFlight.get(key);
  if (current) return current;
  const request = (async () => {
    const r = await fetchWithRetry(
      `/api/mv/projects/${encodeURIComponent(projectId)}/subprojects/${encodeURIComponent(subProjectId)}`,
      { credentials: "include" },
      { maxRetries: 2, timeoutMs: 20_000 },
    );
    if (!r.ok) return null;
    const row = (await r.json()) as MvSubProject & { picAsset?: PicAsset | null };
    return { sub: row, picAsset: row.picAsset ?? null };
  })().finally(() => {
    if (picAssetDetailInFlight.get(key) === request) picAssetDetailInFlight.delete(key);
  });
  picAssetDetailInFlight.set(key, request);
  return request;
}

async function fetchPicAssetDetailsBatch(
  projectId: string,
  subProjectIds: string[],
  signal: AbortSignal,
) {
  if (subProjectIds.length === 0) return [];
  const query = new URLSearchParams({ ids: subProjectIds.join(",") });
  const response = await fetchWithRetry(
    `/api/mv/projects/${encodeURIComponent(projectId)}/subproject-details?${query.toString()}`,
    { credentials: "include", signal },
    { maxRetries: 3, timeoutMs: 20_000 },
  );
  if (!response.ok) {
    const error = new Error(`تعذر تحميل دفعة تفاصيل الأصول (${response.status}).`);
    error.name = "PicAssetBatchError";
    throw error;
  }
  const body = (await response.json()) as {
    items?: Array<MvSubProject & { picAsset?: PicAsset | null }>;
  };
  return Array.isArray(body.items) ? body.items : [];
}

export type HydratePicAssetsOptions = {
  concurrency?: number;
  prioritySubIds?: readonly string[];
  shouldSkip?: (entry: PicAssetFolderEntry) => boolean;
  isCancelled?: () => boolean;
  onUpdate?: (subId: string, next: PicAssetFolderEntry) => void;
  onBatchUpdate?: (updates: Array<{ subId: string; next: PicAssetFolderEntry }>) => void;
  onProgress?: (completed: number, total: number) => void;
  onComplete?: () => void;
};

/** جلب تفاصيل الأصول (صور/صوت) في الخلفية — الأولوية للمعرّفات المطلوبة أولاً. */
export function hydratePicAssetEntriesProgressive(
  projectId: string,
  entries: PicAssetFolderEntry[],
  options: HydratePicAssetsOptions,
): { cancel: () => void } {
  let cancelled = false;
  const controller = new AbortController();
  const priority = new Set(options.prioritySubIds ?? []);
  const ordered = [...entries].sort((a, b) => {
    const ap = priority.has(a.sub._id) ? 0 : 1;
    const bp = priority.has(b.sub._id) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return 0;
  });

  const pending = ordered.filter((entry) => !options.shouldSkip?.(entry));
  options.onProgress?.(0, pending.length);

  void (async () => {
    let completed = 0;
    try {
      const batchSize = 40;
      for (let offset = 0; offset < pending.length; offset += batchSize) {
        if (cancelled || options.isCancelled?.()) break;
        const batch = pending.slice(offset, offset + batchSize);
        const rows = await fetchPicAssetDetailsBatch(
          projectId,
          batch.map((entry) => entry.sub._id),
          controller.signal,
        );
        if (cancelled || options.isCancelled?.()) break;
        const entriesById = new Map(batch.map((entry) => [entry.sub._id, entry]));
        const updates: Array<{ subId: string; next: PicAssetFolderEntry }> = [];
        for (const row of rows) {
          const entry = entriesById.get(row._id);
          if (!entry) continue;
          updates.push({
            subId: row._id,
            next: {
              sub: row,
              picAsset: mergePicAssetFromApi(entry.picAsset, row.picAsset ?? null),
            },
          });
        }
        if (updates.length > 0) {
          if (options.onBatchUpdate) options.onBatchUpdate(updates);
          else for (const update of updates) options.onUpdate?.(update.subId, update.next);
        }
        completed += batch.length;
        options.onProgress?.(Math.min(completed, pending.length), pending.length);
        if (offset + batchSize < pending.length) {
          await new Promise((resolve) => window.setTimeout(resolve, 60));
        }
      }
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      if (!aborted) options.onProgress?.(completed, pending.length);
    } finally {
      if (!cancelled) options.onComplete?.();
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
      controller.abort();
    },
  };
}

export function buildAssetParentPaths(
  entries: PicAssetFolderEntry[],
  byId: Map<string, MvSubProject>,
  photosRootId: string,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of entries) {
    out.set(
      entry.sub._id,
      buildAssetParentFolderPath(entry.sub, byId, photosRootId),
    );
  }
  return out;
}
