import { fetchWithRetry, mapWithConcurrency } from "./mv-concurrent-fetch";
import {
  buildAssetParentFolderPath,
  isPhotosSubfolderName,
  isRootSubProjectParent,
  sortSubProjectsForDisplay,
} from "./mv-subproject-helpers";
import type { MvSubProject, PicAsset } from "./types";

export type PicAssetFolderEntry = { sub: MvSubProject; picAsset: PicAsset | null };

export function picAssetNeedsMediaFetch(pic: PicAsset | null): boolean {
  if (!pic) return false;
  const expectedImages =
    typeof pic.imageCount === "number" && Number.isFinite(pic.imageCount)
      ? Math.max(0, pic.imageCount)
      : 0;
  if (expectedImages > 0 && (!Array.isArray(pic.images) || pic.images.length === 0)) return true;
  const expectedVoice =
    typeof pic.voiceNoteCount === "number" && Number.isFinite(pic.voiceNoteCount)
      ? Math.max(0, pic.voiceNoteCount)
      : 0;
  const voiceArr = Array.isArray(pic.voiceNotes) ? pic.voiceNotes : [];
  return expectedVoice > 0 && voiceArr.length === 0;
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
    isPresent: primary.isPresent ?? secondary.isPresent,
    isDone: primary.isDone ?? secondary.isDone,
    images: existingImages.length >= incomingImages.length ? existingImages : incomingImages,
    voiceNotes: existingVoice.length >= incomingVoice.length ? existingVoice : incomingVoice,
    imageCount: Math.max(
      primary.imageCount ?? 0,
      secondary.imageCount ?? 0,
      existingImages.length,
      incomingImages.length,
    ),
    voiceNoteCount: Math.max(
      primary.voiceNoteCount ?? 0,
      secondary.voiceNoteCount ?? 0,
      existingVoice.length,
      incomingVoice.length,
    ),
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

export async function fetchPicAssetDetail(
  projectId: string,
  subProjectId: string,
): Promise<{ sub: MvSubProject; picAsset: PicAsset | null } | null> {
  const r = await fetchWithRetry(
    `/api/mv/projects/${encodeURIComponent(projectId)}/subprojects/${encodeURIComponent(subProjectId)}`,
    { credentials: "include" },
  );
  if (!r.ok) return null;
  const row = (await r.json()) as MvSubProject & { picAsset?: PicAsset | null };
  return { sub: row, picAsset: row.picAsset ?? null };
}

export type HydratePicAssetsOptions = {
  concurrency?: number;
  prioritySubIds?: readonly string[];
  shouldSkip?: (entry: PicAssetFolderEntry) => boolean;
  isCancelled?: () => boolean;
  onUpdate: (subId: string, next: PicAssetFolderEntry) => void;
  onComplete?: () => void;
};

/** جلب تفاصيل الأصول (صور/صوت) في الخلفية — الأولوية للمعرّفات المطلوبة أولاً. */
export function hydratePicAssetEntriesProgressive(
  projectId: string,
  entries: PicAssetFolderEntry[],
  options: HydratePicAssetsOptions,
): { cancel: () => void } {
  let cancelled = false;
  const priority = new Set(options.prioritySubIds ?? []);
  const ordered = [...entries].sort((a, b) => {
    const ap = priority.has(a.sub._id) ? 0 : 1;
    const bp = priority.has(b.sub._id) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return 0;
  });

  void (async () => {
    try {
      await mapWithConcurrency(ordered, options.concurrency ?? 4, async (entry) => {
        if (cancelled || options.isCancelled?.()) return;
        if (options.shouldSkip?.(entry)) return;
        const row = await fetchPicAssetDetail(projectId, entry.sub._id);
        if (cancelled || options.isCancelled?.()) return;
        if (!row) return;
        options.onUpdate(entry.sub._id, {
          sub: row.sub,
          picAsset: mergePicAssetFromApi(entry.picAsset, row.picAsset),
        });
      });
    } finally {
      if (!cancelled) options.onComplete?.();
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
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
