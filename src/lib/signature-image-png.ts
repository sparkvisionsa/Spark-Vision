/** Resize image and encode as PNG data URL (for signatures / logos). */
export async function imageFileToSignaturePngDataUrl(
  file: File,
  maxEdge = 360,
): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) return null;
    const w = bmp.width;
    const h = bmp.height;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return null;
    }
    ctx.drawImage(bmp, 0, 0, cw, ch);
    bmp.close();
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
