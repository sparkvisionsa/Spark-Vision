import type { MvWordMergeInput } from "./build-context";
import { buildTemplateVariableValues } from "./build-context";
import type { MvWordMergeResult, MvWordMergeStats } from "./merge";
import { convertDocxBlobToPdfBlob, downloadBlob } from "./docx-to-pdf";

export type ServerWordMergeParams = {
  projectId: string;
  mergeInput: MvWordMergeInput;
  assetImageUrls: string[];
  valuationImageUrls: string[];
  clientImageUrls?: string[];
  /** اطلب Word + PDF محوّل من نفس الملف (تنزيلان منفصلان، بدون ZIP) */
  alsoPdf?: boolean;
  /** استخدم أحدث بيانات وصور محفوظة للمشروع مباشرة من الخادم. */
  useStoredProjectState?: boolean;
  imageLayout?: {
    imagesPerRow: number;
    imagesPerPage: number;
    clientImagesPerRow?: number;
    clientImagesPerPage?: number;
    imageQuality?: number;
  };
};

export type MvWordMergeDownloadResult = MvWordMergeResult;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function parseMergeStats(response: Response, params: ServerWordMergeParams): {
  serverStats: Omit<MvWordMergeStats, "warnings">;
  warnings: string[];
} {
  const statsHeader = response.headers.get("X-Word-Merge-Stats");
  let serverStats: Omit<MvWordMergeStats, "warnings"> = {
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
    variablesFound: [],
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

  return { serverStats, warnings };
}

function compactUrlList(urls: string[] | undefined): string[] {
  return (urls ?? []).map((u) => u.trim()).filter(Boolean);
}

async function fetchMergedPdfByToken(projectId: string, token: string): Promise<Blob> {
  const response = await fetch(
    `/api/mv/projects/${encodeURIComponent(projectId)}/word-template/pdf/${encodeURIComponent(token)}`,
    { method: "GET", credentials: "include" },
  );
  if (!response.ok) {
    let message = `تعذر تنزيل ملف PDF (${response.status})`;
    try {
      const json = (await response.json()) as { message?: string | string[] };
      const m = json.message;
      if (typeof m === "string" && m.trim()) message = m.trim();
      else if (Array.isArray(m) && typeof m[0] === "string" && m[0].trim()) message = m[0].trim();
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return response.blob();
}

export async function mergeWordReportTemplateViaServer(
  params: ServerWordMergeParams,
): Promise<MvWordMergeDownloadResult> {
  const useStoredProjectState = params.useStoredProjectState !== false;
  // أرسل الحالة الحالية كاملة، بما في ذلك الفراغ الصريح، حتى ينعكس مسح الحقل
  // فوراً في التنزيل حتى لو لم يكتمل الحفظ التلقائي بعد.
  const textValues = buildTemplateVariableValues(params.mergeInput);
  const assetImageUrls = compactUrlList(params.assetImageUrls);
  const valuationImageUrls = compactUrlList(params.valuationImageUrls);
  const clientImageUrls = compactUrlList(params.clientImageUrls);
  const valuationImagesBase64 = params.mergeInput.valuationImages.map((item) =>
    arrayBufferToBase64(item.image),
  );
  const clientImagesBase64 = params.mergeInput.clientImages.map((item) =>
    arrayBufferToBase64(item.image),
  );

  const body: Record<string, unknown> = {
    imageLayout: params.imageLayout,
    assetImagesBase64: [],
    alsoPdf: false,
    useStoredProjectState,
  };
  // الوضع الافتراضي يقرأ أحدث نسخة من MongoDB لحظة الدمج، ولا يرسل كاش الصفحة.
  if (!useStoredProjectState) {
    body.textValues = textValues;
    body.valuationImagesBase64 = valuationImagesBase64;
    if (assetImageUrls.length > 0) body.assetImageUrls = assetImageUrls;
    if (valuationImageUrls.length > 0) body.valuationImageUrls = valuationImageUrls;
    if (clientImageUrls.length > 0) body.clientImageUrls = clientImageUrls;
    if (clientImagesBase64.length > 0) body.clientImagesBase64 = clientImagesBase64;
  }

  const response = await fetch(
    `/api/mv/projects/${encodeURIComponent(params.projectId)}/word-template/merge`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  const { serverStats, warnings } = parseMergeStats(response, params);
  const pdfToken = response.headers.get("X-Word-Merge-Pdf-Token")?.trim() || "";
  const pdfErrorHeader = response.headers.get("X-Word-Merge-Pdf-Error");
  const contentType = (response.headers.get("Content-Type") || "").toLowerCase();
  const docxBlob = await response.blob();

  // رفض أي استجابة ZIP قديمة — ننزّل Word/PDF كملفين منفصلين فقط
  if (contentType.includes("application/zip")) {
    throw new Error("الخادم أعاد ZIP. حدّث الخادم ثم أعد المحاولة لتنزيل Word وPDF منفصلين.");
  }

  let pdfBlob: Blob | undefined;
  let pdfSource: "server" | "browser" | undefined;
  let pdfError: string | undefined;

  if (pdfErrorHeader) {
    try {
      pdfError = decodeURIComponent(pdfErrorHeader);
    } catch {
      pdfError = pdfErrorHeader;
    }
  }

  if (params.alsoPdf && pdfToken) {
    try {
      pdfBlob = await fetchMergedPdfByToken(params.projectId, pdfToken);
      pdfSource = "server";
    } catch (err) {
      pdfError =
        (err instanceof Error && err.message.trim()) ||
        pdfError ||
        "تعذر تنزيل ملف PDF من الخادم.";
    }
  }

  // احتياطي متصفح متعدد الصفحات إن فشل تحويل الخادم (مثلاً بلا LibreOffice على Ubuntu)
  if (params.alsoPdf && !pdfBlob && docxBlob.size > 0) {
    try {
      pdfBlob = await convertDocxBlobToPdfBlob(docxBlob);
      pdfSource = "browser";
    } catch (err) {
      pdfError =
        (err instanceof Error && err.message.trim()) ||
        pdfError ||
        "تعذر تحويل ملف Word إلى PDF. ثبّت LibreOffice على الخادم لنتائج أفضل.";
    }
  }

  return {
    blob: docxBlob,
    pdfBlob,
    pdfSource,
    pdfError,
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

/** ينزّل ملف Word المدمج فقط. */
export function downloadMergedReportFiles(opts: {
  docxBlob: Blob;
  pdfBlob?: Blob;
  baseName: string;
}) {
  const safe = opts.baseName.replace(/[\\/:*?"<>|]+/g, "-") || "report";
  downloadBlob(opts.docxBlob, `${safe}-merged-report.docx`);
}
