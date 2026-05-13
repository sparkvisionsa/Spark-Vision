import { normalizeImportResult, type AssetImportResult } from "./asset-import-panel";
import type { MvValuationReportSlice } from "./mv-valuation-report-slice";

export type MvReadyExcelAccountImage = {
  id: string;
  /** معرّف ملف PNG في GridFS بعد الرفع */
  fileId?: string;
  /** احتياطي جلسة قديمة فقط — لا يُرسل للخادم */
  dataUrl?: string;
  createdAt: string;
};

export interface MvValuationReadyExcelWorkspaceState {
  version: 1;
  importResult: AssetImportResult | null;
  accountImages: MvReadyExcelAccountImage[];
  reportSlice: MvValuationReportSlice | null;
  updatedAt?: string;
}

export function emptyValuationReadyExcelWorkspace(): MvValuationReadyExcelWorkspaceState {
  return {
    version: 1,
    importResult: null,
    accountImages: [],
    reportSlice: null,
  };
}

const READY_EXCEL_SESSION_IMPORT = (projectId: string) => `sv:mv-valuation-ready-excel:${projectId}`;
const READY_EXCEL_SESSION_IMAGES = (projectId: string) => `sv:mv-accounting-images:${projectId}`;

/** نسخة احتياطية من الجلسة قبل وجود الحقل في Mongo — تُدمج مع الخادم عند التحميل */
export function readReadyExcelWorkspaceFromSession(
  projectId: string,
  readReportSlice: (pid: string) => MvValuationReportSlice | null,
): MvValuationReadyExcelWorkspaceState {
  if (typeof window === "undefined") return emptyValuationReadyExcelWorkspace();
  let importResult: AssetImportResult | null = null;
  try {
    const raw = window.sessionStorage.getItem(READY_EXCEL_SESSION_IMPORT(projectId));
    if (raw) {
      importResult = normalizeImportResult(JSON.parse(raw) as AssetImportResult);
    }
  } catch {
    /* ignore */
  }
  let accountImages: MvReadyExcelAccountImage[] = [];
  try {
    const raw = window.sessionStorage.getItem(READY_EXCEL_SESSION_IMAGES(projectId));
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        accountImages = parsed
          .map((x): MvReadyExcelAccountImage | null => {
            if (!x || typeof x !== "object") return null;
            const o = x as Record<string, unknown>;
            if (typeof o.id !== "string") return null;
            const fileId = typeof o.fileId === "string" && o.fileId.trim() ? o.fileId.trim() : undefined;
            const dataUrl = typeof o.dataUrl === "string" && o.dataUrl.trim() ? o.dataUrl : undefined;
            if (!fileId && !dataUrl) return null;
            return {
              id: o.id,
              fileId,
              dataUrl,
              createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
            };
          })
          .filter((x): x is MvReadyExcelAccountImage => x != null);
      }
    }
  } catch {
    /* ignore */
  }
  return {
    version: 1,
    importResult,
    accountImages,
    reportSlice: readReportSlice(projectId),
  };
}

export function writeReadyExcelSessionCache(
  projectId: string,
  importResult: AssetImportResult | null,
  accountImages: MvReadyExcelAccountImage[],
) {
  if (typeof window === "undefined") return;
  try {
    if (importResult) {
      window.sessionStorage.setItem(READY_EXCEL_SESSION_IMPORT(projectId), JSON.stringify(importResult));
    } else {
      window.sessionStorage.removeItem(READY_EXCEL_SESSION_IMPORT(projectId));
    }
    window.sessionStorage.setItem(READY_EXCEL_SESSION_IMAGES(projectId), JSON.stringify(accountImages));
  } catch {
    /* ignore */
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object";
}

export function parseValuationReadyExcelWorkspaceFromApi(
  raw: unknown,
): MvValuationReadyExcelWorkspaceState | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  const importResult =
    raw.importResult != null && typeof raw.importResult === "object"
      ? (raw.importResult as AssetImportResult)
      : null;
  const imgsRaw = raw.accountImages;
  const accountImages: MvReadyExcelAccountImage[] = Array.isArray(imgsRaw)
    ? imgsRaw
        .map((x): MvReadyExcelAccountImage | null => {
          if (!isRecord(x) || typeof x.id !== "string") return null;
          const fileId = typeof x.fileId === "string" && x.fileId.trim() ? x.fileId.trim() : undefined;
          const dataUrl = typeof x.dataUrl === "string" && x.dataUrl.trim() ? x.dataUrl : undefined;
          if (!fileId && !dataUrl) return null;
          return {
            id: x.id,
            fileId,
            dataUrl,
            createdAt: typeof x.createdAt === "string" ? x.createdAt : new Date().toISOString(),
          };
        })
        .filter((x): x is MvReadyExcelAccountImage => x != null)
    : [];
  const rs = raw.reportSlice;
  const reportSlice: MvValuationReportSlice | null =
    rs != null && typeof rs === "object"
      ? {
          colStart: typeof (rs as { colStart?: unknown }).colStart === "number" ? (rs as { colStart: number }).colStart : 1,
          colEnd: typeof (rs as { colEnd?: unknown }).colEnd === "number" ? (rs as { colEnd: number }).colEnd : 20,
          rowStart: typeof (rs as { rowStart?: unknown }).rowStart === "number" ? (rs as { rowStart: number }).rowStart : 1,
          rowEnd: typeof (rs as { rowEnd?: unknown }).rowEnd === "number" ? (rs as { rowEnd: number }).rowEnd : 500,
          imageColStart: typeof (rs as { imageColStart?: unknown }).imageColStart === "number" ? (rs as { imageColStart: number }).imageColStart : undefined,
          imageColEnd: typeof (rs as { imageColEnd?: unknown }).imageColEnd === "number" ? (rs as { imageColEnd: number }).imageColEnd : undefined,
          imageRowStart: typeof (rs as { imageRowStart?: unknown }).imageRowStart === "number" ? (rs as { imageRowStart: number }).imageRowStart : undefined,
          imageRowEnd: typeof (rs as { imageRowEnd?: unknown }).imageRowEnd === "number" ? (rs as { imageRowEnd: number }).imageRowEnd : undefined,
          importId: typeof (rs as { importId?: unknown }).importId === "string" ? (rs as { importId: string }).importId : undefined,
          sheetName: typeof (rs as { sheetName?: unknown }).sheetName === "string" ? (rs as { sheetName: string }).sheetName : undefined,
        }
      : null;
  return {
    version: 1,
    importResult,
    accountImages,
    reportSlice,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

export function mergeValuationReadyExcelWorkspaces(
  serverRaw: unknown,
  local: MvValuationReadyExcelWorkspaceState,
): MvValuationReadyExcelWorkspaceState {
  const fromServer = parseValuationReadyExcelWorkspaceFromApi(serverRaw);
  if (!fromServer) return local;
  const sTime = fromServer.updatedAt ? Date.parse(fromServer.updatedAt) : 0;
  const lTime = local.updatedAt ? Date.parse(local.updatedAt) : 0;
  if (sTime > lTime) return fromServer;
  if (lTime > sTime) return local;
  const sSheets = fromServer.importResult?.summary?.sheets?.length ?? 0;
  const lSheets = local.importResult?.summary?.sheets?.length ?? 0;
  if (sSheets !== lSheets) return sSheets >= lSheets ? fromServer : local;
  const sim = fromServer.accountImages.length;
  const lim = local.accountImages.length;
  return sim >= lim ? fromServer : local;
}

/** نسخة آمنة لـ PATCH (بدون dataUrl في الصور) */
export function valuationReadyExcelWorkspaceForApi(
  state: MvValuationReadyExcelWorkspaceState,
): MvValuationReadyExcelWorkspaceState {
  return {
    ...state,
    accountImages: state.accountImages.map((im) => {
      if (im.fileId) {
        const { dataUrl: _d, ...rest } = im;
        return rest;
      }
      return im;
    }),
  };
}

export function buildReadyExcelWorkspaceForSave(
  importResult: AssetImportResult | null,
  accountImages: MvReadyExcelAccountImage[],
  reportSlice: MvValuationReportSlice | null,
): MvValuationReadyExcelWorkspaceState {
  return {
    version: 1,
    importResult,
    accountImages,
    reportSlice,
    updatedAt: new Date().toISOString(),
  };
}

export function readyExcelAccountImageSrc(projectId: string, img: MvReadyExcelAccountImage): string {
  if (img.dataUrl) return img.dataUrl;
  if (img.fileId) {
    return `/api/mv/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(img.fileId)}/download`;
  }
  return "";
}
