export type SavedHelperPdf = {
  id: string;
  sequence: number;
  name: string;
  kind: "standard" | "compressed";
  imageCount: number;
  pdfCount: number;
  size: number;
  createdAt: string;
};

const BASE = "/api/helper-tools/pdfs";

async function responseError(response: Response) {
  try {
    const body = await response.json() as { message?: string | string[] };
    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.message)) return body.message.join("، ");
  } catch { /* Response may not contain JSON. */ }
  return `PDF request failed (${response.status})`;
}

export async function listSavedHelperPdfs(): Promise<SavedHelperPdf[]> {
  const response = await fetch(BASE, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(await responseError(response));
  const result = await response.json() as { files: SavedHelperPdf[] };
  return result.files;
}

export async function saveHelperPdf(input: {
  blob: Blob;
  kind: "standard" | "compressed";
  imageCount: number;
  pdfCount: number;
  csrfToken: string;
}): Promise<SavedHelperPdf> {
  const body = new FormData();
  body.append("file", input.blob, input.kind === "compressed" ? "images-compressed.pdf" : "images.pdf");
  body.append("kind", input.kind);
  body.append("imageCount", String(input.imageCount));
  body.append("pdfCount", String(input.pdfCount));
  const response = await fetch(BASE, {
    method: "POST",
    body,
    credentials: "include",
    cache: "no-store",
    headers: { "X-CSRF-Token": input.csrfToken },
  });
  if (!response.ok) throw new Error(await responseError(response));
  const result = await response.json() as { file: SavedHelperPdf };
  return result.file;
}

export async function downloadSavedHelperPdf(file: SavedHelperPdf): Promise<Blob> {
  const response = await fetch(`${BASE}/${encodeURIComponent(file.id)}/file`, {
    credentials: "include", cache: "no-store",
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.blob();
}
