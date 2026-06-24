import type { MvSubProject } from "./types";

/** Shown with the photos icon in the UI. */
export function isPhotosSubfolderName(name: string): boolean {
  const t = name.trim();
  return (
    t === "الصور" ||
    t === "صور" ||
    t === "صور المعاينة" ||
    t === "2.صور المعاينة"
  );
}

export function isRootSubProjectParent(parent: MvSubProject["parent"] | "" | undefined): boolean {
  return parent == null || String(parent).trim() === "";
}

function resolveNumericPrefix(name: string): number | null {
  const match = name.trim().match(/^(\d+)\s*[.\-]/);
  return match ? Number(match[1]) : null;
}

/** مسار مجلدات الأب للأصل (بدون جذر الصور وبدون مجلد الأصل نفسه) — مفصول بـ ‎>‎ */
export function buildAssetParentFolderPath(
  sub: MvSubProject,
  byId: Map<string, MvSubProject>,
  photosRootId: string,
): string {
  const parts: string[] = [];
  let parentId = sub.parent;
  const seen = new Set<string>();
  while (parentId && parentId.trim() && parentId !== photosRootId) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    const label = parent.name.trim();
    if (label) parts.push(label);
    parentId = parent.parent;
  }
  parts.reverse();
  return parts.length > 0 ? parts.join(" > ") : "—";
}

export function sortSubProjectsForDisplay(subs: MvSubProject[]): MvSubProject[] {
  return [...subs].sort((a, b) => {
    const ap = resolveNumericPrefix(a.name);
    const bp = resolveNumericPrefix(b.name);
    if (ap !== null && bp !== null && ap !== bp) return ap - bp;
    if (ap !== null && bp === null) return -1;
    if (ap === null && bp !== null) return 1;

    const aPhotos = isPhotosSubfolderName(a.name) ? 0 : 1;
    const bPhotos = isPhotosSubfolderName(b.name) ? 0 : 1;
    if (aPhotos !== bPhotos) return aPhotos - bPhotos;

    return a.name.localeCompare(b.name, "ar");
  });
}
