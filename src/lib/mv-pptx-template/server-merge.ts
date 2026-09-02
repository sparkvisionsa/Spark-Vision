"use client";

import type { MvPptxMergeStats } from "./index";
import { downloadBlob } from "@/lib/mv-word-template/docx-to-pdf";

export type ServerPptxMergeParams = {
  projectId: string;
  /** Selected template from the current company's PowerPoint catalogue. */
  templateId?: string;
  /** The server resolves the saved company/project template. */
  useStoredProjectState?: boolean;
  /** Request a PDF conversion of the merged PowerPoint. */
  alsoPdf?: boolean;
  /** Optional current image layout for this merge. */
  imageLayout?: {
    assetImagesPerRow?: number;
    clientImagesPerRow?: number;
  };
};

export type ServerPptxMergeResult = {
  blob: Blob;
  pdfBlob?: Blob;
  pdfSource?: "server" | "browser";
  pdfError?: string;
  mergeStats: MvPptxMergeStats;
};

function readHeaderJson(response: Response, name: string): unknown {
  const raw = response.headers.get(name);
  if (!raw) return undefined;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return undefined;
  }
}

async function readError(response: Response): Promise<string> {
  let message = `تعذر دمج ملف PowerPoint على الخادم (${response.status}).`;
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message.trim();
    if (Array.isArray(payload.message) && typeof payload.message[0] === "string") {
      return payload.message[0].trim() || message;
    }
  } catch {
    // Preserve the useful HTTP-status fallback.
  }
  return message;
}

async function fetchMergedPptxPdfByToken(projectId: string, token: string): Promise<Blob> {
  const response = await fetch(
    `/api/mv/projects/${encodeURIComponent(projectId)}/pptx-template/pdf/${encodeURIComponent(token)}`,
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

/**
 * The server is the source of truth for report data and included asset images.
 * This mirrors the saved-state Word export flow and avoids browser CORS/cache
 * failures that can leave image relationships empty in a PPTX package.
 */
export async function mergePptxReportTemplateViaServer(
  params: ServerPptxMergeParams,
): Promise<ServerPptxMergeResult> {
  const body: Record<string, unknown> = {
    ...(params.templateId ? { templateId: params.templateId } : {}),
    useStoredProjectState: params.useStoredProjectState !== false,
    alsoPdf: params.alsoPdf === true,
    imageLayout: params.imageLayout,
  };

  const response = await fetch(
    `/api/mv/projects/${encodeURIComponent(params.projectId)}/pptx-template/merge`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw new Error(await readError(response));

  const rawStats = readHeaderJson(response, "X-Pptx-Merge-Stats") as Partial<MvPptxMergeStats> | undefined;
  const rawWarnings = readHeaderJson(response, "X-Pptx-Merge-Warnings");
  const warnings = [
    ...(Array.isArray(rawStats?.warnings) ? rawStats.warnings.map(String).filter(Boolean) : []),
    ...(Array.isArray(rawWarnings) ? rawWarnings.map(String).filter(Boolean) : []),
  ].filter((warning, index, list) => list.indexOf(warning) === index);

  const pdfToken = response.headers.get("X-Pptx-Merge-Pdf-Token")?.trim() || "";
  const pdfErrorHeader = response.headers.get("X-Pptx-Merge-Pdf-Error");
  const pptxBlob = await response.blob();

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
      pdfBlob = await fetchMergedPptxPdfByToken(params.projectId, pdfToken);
      pdfSource = "server";
    } catch (err) {
      pdfError =
        (err instanceof Error && err.message.trim()) ||
        pdfError ||
        "تعذر تنزيل ملف PDF من الخادم.";
    }
  }

  if (params.alsoPdf && !pdfBlob) {
    pdfError =
      pdfError ||
      "تعذر تحويل PowerPoint إلى PDF عبر Microsoft Office. تأكد من تثبيت Microsoft PowerPoint على الخادم ثم أعد المحاولة.";
  }

  return {
    blob: pptxBlob,
    pdfBlob,
    pdfSource,
    pdfError,
    mergeStats: {
      variablesFound: Array.isArray(rawStats?.variablesFound)
        ? rawStats.variablesFound.map(String)
        : [],
      variablesFilled: Number(rawStats?.variablesFilled ?? 0),
      assetImagesInserted: Number(rawStats?.assetImagesInserted ?? 0),
      assetImageMarkers: Number(rawStats?.assetImageMarkers ?? 0),
      slidesAdded: Number(rawStats?.slidesAdded ?? 0),
      warnings,
    },
  };
}

export function downloadMergedPptxFiles(opts: {
  pptxBlob: Blob;
  pdfBlob?: Blob;
  baseName: string;
  includePptx?: boolean;
}) {
  const safe = opts.baseName.replace(/[\\/:*?"<>|]+/g, "-") || "report";
  const includePptx = opts.includePptx !== false;
  if (includePptx) {
    downloadBlob(opts.pptxBlob, `${safe}-merged-presentation.pptx`);
  }
  if (opts.pdfBlob) {
    window.setTimeout(
      () => {
        downloadBlob(opts.pdfBlob!, `${safe}-merged-presentation.pdf`);
      },
      includePptx ? 400 : 0,
    );
  }
}
