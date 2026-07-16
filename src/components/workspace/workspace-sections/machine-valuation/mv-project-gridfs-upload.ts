import { getMvT, readMvLanguage } from "./mv-i18n";

export type UploadProjectFileOptions = {
  /**
   * عند true يوجّه الخلفية لرفع الملف إلى DigitalOcean Spaces (مثل ملفات المعاينة)
   * مع الإبقاء على مرجع ‎_id‎ في ‎mv_files‎ — لمسار إجراءات التقييم فقط.
   */
  valuationAccounting?: boolean;
};

const uploadT = () => getMvT(readMvLanguage());

const VALUATION_ACCOUNTING_UPLOAD_SOFT_MAX_BYTES = 3.5 * 1024 * 1024;
const VALUATION_ACCOUNTING_UPLOAD_RETRY_MAX_BYTES = 1.8 * 1024 * 1024;

function isLikelyImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
}

function isPayloadTooLargeResponse(status: number, body: string) {
  return (
    status === 413 ||
    /FUNCTION_PAYLOAD_TOO_LARGE|payload too large|request entity too large/i.test(body)
  );
}

function loadUploadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(uploadT()("files.upload.readImageFailed")));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(uploadT()("files.upload.compressFailed")));
      },
      type,
      quality,
    );
  });
}

function jpegUploadName(name: string) {
  const base = name.replace(/\.[^.]+$/i, "").trim() || "valuation-accounting-image";
  return `${base}.jpg`;
}

async function compressImageForUpload(file: File, maxBytes: number): Promise<File> {
  if (!isLikelyImageFile(file) || file.size <= maxBytes) return file;

  const image = await loadUploadImage(file);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  if (naturalWidth < 1 || naturalHeight < 1) return file;

  const maxPixels = 10_000_000;
  const maxSide = 3200;
  const initialScale = Math.min(
    1,
    maxSide / Math.max(naturalWidth, naturalHeight),
    Math.sqrt(maxPixels / Math.max(1, naturalWidth * naturalHeight)),
  );
  const qualities = [0.88, 0.82, 0.76, 0.68, 0.6, 0.52];
  let best: Blob | null = null;
  let scale = Number.isFinite(initialScale) && initialScale > 0 ? initialScale : 1;

  while (scale >= 0.32) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= maxBytes) {
        canvas.width = 1;
        canvas.height = 1;
        return new File([blob], jpegUploadName(file.name), { type: "image/jpeg" });
      }
    }

    canvas.width = 1;
    canvas.height = 1;
    scale *= 0.78;
  }

  if (best && best.size < file.size) {
    return new File([best], jpegUploadName(file.name), { type: "image/jpeg" });
  }
  return file;
}

async function prepareValuationAccountingUploadFile(file: File, maxBytes: number) {
  if (!isLikelyImageFile(file)) return file;
  return compressImageForUpload(file, maxBytes);
}

/**
 * رفع ملف للمشروع: افتراضياً GridFS؛ مع ‎valuationAccounting‎ يُفضَّل التخزين على Spaces عند التهيئة.
 */
export async function uploadProjectFileAndReturnId(
  projectId: string,
  file: File,
  options?: UploadProjectFileOptions,
): Promise<string> {
  if (!file || file.size <= 0) {
    throw new Error(uploadT()("files.upload.emptyFile"));
  }
  const startedAt = Date.now();
  const qs =
    options?.valuationAccounting === true ? "?valuationAccounting=1" : "";

  const postFile = async (candidate: File) => {
    const formData = new FormData();
    formData.append("files", candidate, candidate.name);
    const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/files${qs}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const text = await res.text();
    return { res, text, sentFile: candidate };
  };

  let uploadFile =
    options?.valuationAccounting === true
      ? await prepareValuationAccountingUploadFile(
          file,
          VALUATION_ACCOUNTING_UPLOAD_SOFT_MAX_BYTES,
        )
      : file;
  let result = await postFile(uploadFile);

  if (
    options?.valuationAccounting === true &&
    !result.res.ok &&
    isPayloadTooLargeResponse(result.res.status, result.text) &&
    isLikelyImageFile(uploadFile)
  ) {
    const retryFile = await prepareValuationAccountingUploadFile(
      uploadFile,
      VALUATION_ACCOUNTING_UPLOAD_RETRY_MAX_BYTES,
    );
    if (retryFile.size < uploadFile.size) {
      uploadFile = retryFile;
      result = await postFile(uploadFile);
    }
  }

  const { res, text, sentFile } = result;
  if (!res.ok) {
    let msg = uploadT()("files.upload.storageFailed");
    if (isPayloadTooLargeResponse(res.status, text)) {
      msg = uploadT()("files.upload.payloadTooLarge");
    }
    try {
      const parsed = JSON.parse(text) as { message?: unknown };
      if (typeof parsed.message === "string" && parsed.message.trim()) msg = parsed.message.trim();
    } catch {
      const t = text.trim();
      if (t && t.length < 400) msg = t;
    }
    throw new Error(msg);
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      const first = parsed[0] as { _id?: unknown } | undefined;
      if (first && typeof first._id === "string" && first._id.trim()) return first._id;
    }
  } catch {
    /* ignore */
  }

  const listRes = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/files`, {
    credentials: "include",
  });
  if (!listRes.ok) throw new Error(uploadT()("files.upload.listRefreshFailed"));
  const rows = (await listRes.json().catch(() => [])) as unknown;
  const files = Array.isArray(rows)
    ? (rows as { _id: string; name: string; sizeBytes: number; uploadedAt: string }[])
    : [];
  const candidates = files
    .filter((f) => typeof f?._id === "string" && f.name === sentFile.name && Number(f.sizeBytes) === Number(sentFile.size))
    .map((f) => ({ ...f, ts: new Date(f.uploadedAt).getTime() }))
    .filter((f) => Number.isFinite(f.ts) && f.ts >= startedAt - 15_000)
    .sort((a, b) => b.ts - a.ts);
  if (candidates[0]?._id) return candidates[0]._id;
  const newest = files
    .map((f) => ({ ...f, ts: new Date(f.uploadedAt).getTime() }))
    .filter((f) => Number.isFinite(f.ts))
    .sort((a, b) => b.ts - a.ts)[0];
  if (newest?._id) return newest._id;
  throw new Error(uploadT()("files.upload.idNotFound"));
}
