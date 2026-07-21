import type { DocxImageMergeStats } from "./docx-image-merge";
import { mergeWordHybrid, scanDocxBookmarks } from "./docx-hybrid-merge";
import type { MvWordBookmarkMergeStats } from "./docx-bookmark-shared";
import { mergeWordReportTemplateViaServer } from "./server-merge";
import { yieldToMain } from "./docx-yield";
import type { MvWordMergeInput } from "./build-context";

export type MvWordMergeResult = {
  blob: Blob;
  imageStats: DocxImageMergeStats;
  textStats: { paragraphsUpdated: number; tableCellsUpdated: number };
  bookmarkStats: MvWordBookmarkMergeStats;
  mergeSource?: "server" | "client";
};
function bookmarkStatsToLegacy(stats: MvWordBookmarkMergeStats): {
  imageStats: DocxImageMergeStats;
  textStats: { paragraphsUpdated: number; tableCellsUpdated: number };
} {
  return {
    imageStats: {
      assetReplaced: 0,
      valuationReplaced: 0,
      assetInserted: stats.assetImagesInserted,
      valuationInserted: stats.valuationImagesInserted,
    },
    textStats: {
      paragraphsUpdated: stats.textBookmarksFilled,
      tableCellsUpdated: 0,
    },
  };
}

/**
 * دمج عبر الخادم (Python + lxml) — بدون رجوع للمتصفح (كان يسبب أخطاء XML).
 */
export async function mergeWordReportTemplateSmart(params: {
  projectId: string;
  templateFileId?: string;
  templateBuffer: ArrayBuffer;
  mergeInput: MvWordMergeInput;
  assetImageUrls: string[];
  valuationImageUrls: string[];
  clientImageUrls?: string[];
  imageLayout?: {
    imagesPerRow: number;
    imagesPerPage: number;
  };
}): Promise<MvWordMergeResult> {
  const serverResult = await mergeWordReportTemplateViaServer({
    projectId: params.projectId,
    templateFileId: params.templateFileId,
    mergeInput: params.mergeInput,
    assetImageUrls: params.assetImageUrls,
    valuationImageUrls: params.valuationImageUrls,
    clientImageUrls: params.clientImageUrls,
    imageLayout: params.imageLayout,
  });
  return { ...serverResult, mergeSource: "server" };
}

/**
 * دمج تقرير Word عبر الإشارات المرجعية (Bookmarks) — في المتصفح.
 */
export async function mergeWordReportTemplate(  templateBuffer: ArrayBuffer,
  input: MvWordMergeInput,
): Promise<MvWordMergeResult> {
  await yieldToMain();

  const { buffer, stats } = await mergeWordHybrid(templateBuffer, input);
  const legacy = bookmarkStatsToLegacy(stats);

  await yieldToMain();

  return {
    blob: new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    ...legacy,
    bookmarkStats: stats,
  };
}

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
