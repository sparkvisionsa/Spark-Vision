export type UploadProjectFileOptions = {
  /**
   * عند true يوجّه الخلفية لرفع الملف إلى DigitalOcean Spaces (مثل ملفات المعاينة)
   * مع الإبقاء على مرجع ‎_id‎ في ‎mv_files‎ — لمسار إجراءات التقييم فقط.
   */
  valuationAccounting?: boolean;
};

/**
 * رفع ملف للمشروع: افتراضياً GridFS؛ مع ‎valuationAccounting‎ يُفضَّل التخزين على Spaces عند التهيئة.
 */
export async function uploadProjectFileAndReturnId(
  projectId: string,
  file: File,
  options?: UploadProjectFileOptions,
): Promise<string> {
  if (!file || file.size <= 0) {
    throw new Error("تعذر رفع الصورة لأن الملف الناتج فارغ.");
  }
  const startedAt = Date.now();
  const formData = new FormData();
  formData.append("files", file, file.name);
  const qs =
    options?.valuationAccounting === true ? "?valuationAccounting=1" : "";
  const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/files${qs}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = "تعذر رفع الملف إلى التخزين.";
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
  if (!listRes.ok) throw new Error("تم الرفع لكن تعذر تحديث قائمة الملفات.");
  const rows = (await listRes.json().catch(() => [])) as unknown;
  const files = Array.isArray(rows)
    ? (rows as { _id: string; name: string; sizeBytes: number; uploadedAt: string }[])
    : [];
  const candidates = files
    .filter((f) => typeof f?._id === "string" && f.name === file.name && Number(f.sizeBytes) === Number(file.size))
    .map((f) => ({ ...f, ts: new Date(f.uploadedAt).getTime() }))
    .filter((f) => Number.isFinite(f.ts) && f.ts >= startedAt - 15_000)
    .sort((a, b) => b.ts - a.ts);
  if (candidates[0]?._id) return candidates[0]._id;
  const newest = files
    .map((f) => ({ ...f, ts: new Date(f.uploadedAt).getTime() }))
    .filter((f) => Number.isFinite(f.ts))
    .sort((a, b) => b.ts - a.ts)[0];
  if (newest?._id) return newest._id;
  throw new Error("تم الرفع لكن لم يمكن تحديد معرّف الملف.");
}
