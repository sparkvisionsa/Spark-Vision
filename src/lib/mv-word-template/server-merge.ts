import type { MvWordMergeInput } from "./build-context";
import { buildTemplateVariableValues } from "./build-context";
import type { MvWordMergeResult } from "./merge";

export type ServerWordMergeParams = {
  projectId: string;
  mergeInput: MvWordMergeInput;
  assetImageUrls: string[];
  valuationImageUrls: string[];
  clientImageUrls?: string[];
  imageLayout?: {
    imagesPerRow: number;
    imagesPerPage: number;
    clientImagesPerRow?: number;
    clientImagesPerPage?: number;
    imageQuality?: number;
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

export async function mergeWordReportTemplateViaServer(
  params: ServerWordMergeParams,
): Promise<MvWordMergeResult> {
  // أرسل الحالة الحالية كاملة، بما في ذلك الفراغ الصريح، حتى ينعكس مسح الحقل
  // فوراً في التنزيل حتى لو لم يكتمل الحفظ التلقائي بعد.
  const textValues = buildTemplateVariableValues(params.mergeInput);

  const response = await fetch(
    `/api/mv/projects/${encodeURIComponent(params.projectId)}/word-template/merge`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        textValues,
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
    variablesFilled: 0,
    assetImagesInserted: Math.max(
      params.assetImageUrls.length,
      params.mergeInput.assetImages.length,
    ),
    valuationImagesInserted: Math.max(
      params.valuationImageUrls.length,
      params.mergeInput.valuationImages.length,
    ),
    clientImagesInserted: Math.max(
      params.clientImageUrls?.length ?? 0,
      params.mergeInput.clientImages.length,
    ),
    variablesFound: [] as string[],
  };
  if (statsHeader) {
    try {
      const parsed = JSON.parse(decodeURIComponent(statsHeader)) as {
        variablesFilled?: unknown;
        variablesFound?: unknown;
        assetImagesInserted?: unknown;
        valuationImagesInserted?: unknown;
        clientImagesInserted?: unknown;
      };
      serverStats = {
        variablesFilled: Number(parsed.variablesFilled ?? 0),
        assetImagesInserted: Number(parsed.assetImagesInserted ?? serverStats.assetImagesInserted),
        valuationImagesInserted: Number(
          parsed.valuationImagesInserted ?? serverStats.valuationImagesInserted,
        ),
        clientImagesInserted: Number(
          parsed.clientImagesInserted ?? serverStats.clientImagesInserted,
        ),
        variablesFound: Array.isArray(parsed.variablesFound)
          ? parsed.variablesFound.map(String)
          : [],
      };
    } catch {
      /* keep defaults */
    }
  }

  const warnings: string[] = [];
  const warningsHeader = response.headers.get("X-Word-Merge-Warnings");
  if (warningsHeader) {
    try {
      const parsed = JSON.parse(decodeURIComponent(warningsHeader)) as unknown;
      if (Array.isArray(parsed)) {
        warnings.push(...parsed.map(String).filter(Boolean));
      }
    } catch {
      warnings.push("اكتمل ملف Word مع تحذير غير معروف أثناء الدمج.");
    }
  }

  const blob = await response.blob();

  return {
    blob,
    mergeSource: "server",
    mergeStats: {
      variablesFilled: serverStats.variablesFilled,
      variablesFound: serverStats.variablesFound,
      assetImagesInserted: serverStats.assetImagesInserted,
      valuationImagesInserted: serverStats.valuationImagesInserted,
      clientImagesInserted: serverStats.clientImagesInserted,
      warnings,
    },
  };
}
