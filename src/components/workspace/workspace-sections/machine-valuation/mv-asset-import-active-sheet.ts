/** ورقة نشطة للمعالجة/التقييم (نفس الجلسة، لكل مشروع) */
import type { ActiveImportSheetRef } from "./asset-import-panel";

const key = (projectId: string) => `sv:asset-import-active-sheet:${projectId}`;

/** قراءة مرجع الورقة — يدعم النص القديم (اسم فقط) أو JSON { importId, sheetName } */
export function readActiveImportSheetRef(
  projectId: string,
): { importId: string | null; sheetName: string } | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(key(projectId));
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "sheetName" in parsed &&
      typeof (parsed as { sheetName: unknown }).sheetName === "string"
    ) {
      const sheetName = (parsed as { sheetName: string }).sheetName.trim();
      if (!sheetName) return null;
      const importId =
        "importId" in parsed && typeof (parsed as { importId: unknown }).importId === "string"
          ? (parsed as { importId: string }).importId.trim() || null
          : null;
      return { importId, sheetName };
    }
  } catch {
    return { importId: null, sheetName: raw.trim() };
  }
  return null;
}

export function writeActiveImportSheetRef(projectId: string, ref: ActiveImportSheetRef | null): void {
  if (typeof window === "undefined") return;
  if (ref && ref.sheetName.trim() && ref.importId.trim()) {
    sessionStorage.setItem(
      key(projectId),
      JSON.stringify({ importId: ref.importId.trim(), sheetName: ref.sheetName.trim() }),
    );
  } else {
    sessionStorage.removeItem(key(projectId));
  }
}

/** @deprecated استخدم readActiveImportSheetRef — للتوافق مع استدعاءات قديمة */
export function readActiveImportSheetName(projectId: string): string | null {
  const r = readActiveImportSheetRef(projectId);
  return r?.sheetName ?? null;
}

/** @deprecated استخدم writeActiveImportSheetRef */
export function writeActiveImportSheetName(projectId: string, sheetName: string | null): void {
  if (sheetName && sheetName.trim()) {
    sessionStorage.setItem(key(projectId), JSON.stringify({ importId: "", sheetName: sheetName.trim() }));
  } else {
    sessionStorage.removeItem(key(projectId));
  }
}
