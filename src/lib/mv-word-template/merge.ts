import {
  downloadMergedReportFiles,
  mergeWordReportTemplateViaServer,
} from "./server-merge";
import type { MvWordMergeInput } from "./build-context";

export type MvWordMergeStats = {
  variablesFilled: number;
  variablesFound: string[];
  assetImagesInserted: number;
  valuationImagesInserted: number;
  clientImagesInserted: number;
  warnings: string[];
};

export type MvWordMergeResult = {
  blob: Blob;
  mergeStats: MvWordMergeStats;
  mergeSource: "server";
  pdfBlob?: Blob;
  pdfSource?: "server" | "browser";
  pdfError?: string;
};

/**
 * دمج عبر الخادم (Python + lxml) — بدون رجوع للمتصفح (كان يسبب أخطاء XML).
 */
export async function mergeWordReportTemplateSmart(params: {
  projectId: string;
  mergeInput: MvWordMergeInput;
  assetImageUrls: string[];
  valuationImageUrls: string[];
  clientImageUrls?: string[];
  alsoPdf?: boolean;
  imageLayout?: {
    imagesPerRow: number;
    imagesPerPage: number;
    clientImagesPerRow?: number;
    clientImagesPerPage?: number;
    imageQuality?: number;
  };
}): Promise<MvWordMergeResult> {
  const serverResult = await mergeWordReportTemplateViaServer({
    projectId: params.projectId,
    mergeInput: params.mergeInput,
    assetImageUrls: params.assetImageUrls,
    valuationImageUrls: params.valuationImageUrls,
    clientImageUrls: params.clientImageUrls,
    alsoPdf: params.alsoPdf,
    imageLayout: params.imageLayout,
  });
  return { ...serverResult, mergeSource: "server" };
}

export { downloadMergedReportFiles };

export function downloadWordBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function fetchImageAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`تعذر تحميل الصورة (${response.status})`);
  }
  return response.arrayBuffer();
}
