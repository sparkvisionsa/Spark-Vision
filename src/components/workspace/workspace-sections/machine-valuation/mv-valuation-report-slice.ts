/**
 * نطاقات اختيار لمرحلة توليد التقرير (PDF) — تُحفَظ مؤقتاً لحين بناء مُولّد الملف.
 */
export type MvValuationReportSlice = {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
  imageColStart?: number;
  imageColEnd?: number;
  imageRowStart?: number;
  imageRowEnd?: number;
  importId?: string;
  sheetName?: string;
};

const SLICE_KEY_PREFIX = "mv:valuation-excel-slice:";

export function reportSliceStorageKey(projectId: string) {
  return `${SLICE_KEY_PREFIX}${projectId}`;
}

export function readReportSlice(projectId: string): MvValuationReportSlice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(reportSliceStorageKey(projectId));
    if (!raw) return null;
    return JSON.parse(raw) as MvValuationReportSlice;
  } catch {
    return null;
  }
}

export function writeReportSlice(projectId: string, slice: MvValuationReportSlice) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(reportSliceStorageKey(projectId), JSON.stringify(slice));
}
