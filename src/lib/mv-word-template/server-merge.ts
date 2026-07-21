import type { MvWordMergeInput } from "./build-context";
import { buildBookmarkTextValues } from "./build-context";
import { MV_WORD_TEXT_BOOKMARKS } from "./bookmarks";
import type { MvWordBookmarkMergeStats } from "./docx-bookmark-shared";
import type { MvWordMergeResult } from "./merge";

export type ServerWordMergeParams = {
  projectId: string;
  templateFileId?: string;
  mergeInput: MvWordMergeInput;
  assetImageUrls: string[];
  valuationImageUrls: string[];
  clientImageUrls?: string[];
  imageLayout?: {
    imagesPerRow: number;
    imagesPerPage: number;
  };
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function buildTextByBookmarkName(textValues: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of MV_WORD_TEXT_BOOKMARKS) {
    const value = textValues[def.field] ?? "";
    if (!value.trim()) continue;
    for (const name of def.names) {
      out[name] = value;
    }
  }
  return out;
}

function compactTextValues(textValues: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(textValues)) {
    const trimmed = value.trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

export async function mergeWordReportTemplateViaServer(
  params: ServerWordMergeParams,
): Promise<MvWordMergeResult> {
  const textValues = buildBookmarkTextValues(params.mergeInput);

  const response = await fetch(
    `/api/mv/projects/${encodeURIComponent(params.projectId)}/word-template/merge`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateFileId: params.templateFileId,
        textValues: compactTextValues(textValues),
        textByBookmarkName: buildTextByBookmarkName(textValues),
        assetImageUrls: params.assetImageUrls,
        valuationImageUrls: params.valuationImageUrls,
        clientImageUrls: params.clientImageUrls ?? [],
        imageLayout: params.imageLayout,
        assetImagesBase64: [],
        valuationImagesBase64: params.mergeInput.valuationImages.map((item) =>
          arrayBufferToBase64(item.image),
        ),
        clientImagesBase64: params.mergeInput.clientImages.map((item) =>
          arrayBufferToBase64(item.image),
        ),
      }),
    },
  );

  if (!response.ok) {
    let message = `تعذر دمج Word على الخادم (${response.status})`;
    try {
      const json = (await response.json()) as { message?: string | string[] };
      const m = json.message;
      if (typeof m === "string") message = m;
      else if (Array.isArray(m) && m[0]) message = m[0];
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const statsHeader = response.headers.get("X-Word-Merge-Stats");
  let serverStats = {
    textFilled: 0,
    assetImagesInserted: params.mergeInput.assetImages.length,
    valuationImagesInserted: params.mergeInput.valuationImages.length,
    bookmarksFound: [] as string[],
  };
  if (statsHeader) {
    try {
      const parsed = JSON.parse(decodeURIComponent(statsHeader)) as typeof serverStats;
      serverStats = {
        textFilled: Number(parsed.textFilled ?? 0),
        assetImagesInserted: Number(parsed.assetImagesInserted ?? serverStats.assetImagesInserted),
        valuationImagesInserted: Number(
          parsed.valuationImagesInserted ?? serverStats.valuationImagesInserted,
        ),
        bookmarksFound: Array.isArray(parsed.bookmarksFound)
          ? parsed.bookmarksFound.map(String)
          : [],
      };
    } catch {
      /* keep defaults */
    }
  }

  const blob = await response.blob();
  const bookmarkStats: MvWordBookmarkMergeStats = {
    textBookmarksFilled: serverStats.textFilled,
    textBookmarksSkipped: 0,
    assetImagesInserted: serverStats.assetImagesInserted,
    valuationImagesInserted: serverStats.valuationImagesInserted,
    bookmarksFound: serverStats.bookmarksFound,
    imageErrors: [],
  };

  return {
    blob,
    imageStats: {
      assetReplaced: 0,
      valuationReplaced: 0,
      assetInserted: serverStats.assetImagesInserted,
      valuationInserted: serverStats.valuationImagesInserted,
    },
    textStats: { paragraphsUpdated: 0, tableCellsUpdated: 0 },
    bookmarkStats,
  };
}
