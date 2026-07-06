import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const JPEG_QUALITY = 0.93;
const CAPTURE_SCALE = 2.25;

const PREVIEW_SESSION_KEY = "mv-word-report-preview-docx";

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function waitForNextFrame() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

function collectDocxPreviewPages(bodyContainer: HTMLElement): HTMLElement[] {
  const wrapper = bodyContainer.querySelector<HTMLElement>(".docx-wrapper");
  if (!wrapper) return [bodyContainer];

  const sections = Array.from(wrapper.querySelectorAll<HTMLElement>("section.docx"));
  if (sections.length > 0) return sections;

  return [wrapper];
}

async function captureElementToPdfPage(pdf: jsPDF, element: HTMLElement, pageIndex: number) {
  const canvas = await html2canvas(element, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
  });

  const imgData = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const imgW = A4_WIDTH_PT;
  const imgH = (canvas.height * imgW) / canvas.width;
  const finalH = Math.min(imgH, A4_HEIGHT_PT);

  if (pageIndex > 0) {
    pdf.addPage("a4", "portrait");
  }

  pdf.addImage(imgData, "JPEG", 0, 0, imgW, finalH, undefined, "FAST");
}

async function renderDocxToHost(docxBlob: Blob) {
  const { renderAsync } = await import("docx-preview");

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dir = "rtl";
  host.style.cssText =
    "position:fixed;left:-14000px;top:0;z-index:-1;opacity:0;pointer-events:none;background:#fff;";

  const styleContainer = document.createElement("div");
  const bodyContainer = document.createElement("div");
  bodyContainer.dir = "rtl";
  host.appendChild(styleContainer);
  host.appendChild(bodyContainer);
  document.body.appendChild(host);

  await renderAsync(docxBlob, bodyContainer, styleContainer, {
    className: "docx-preview-pdf",
    inWrapper: true,
    breakPages: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    renderHeaders: true,
    renderFooters: true,
    useBase64URL: true,
  });

  await waitForNextFrame();
  await waitForImages(bodyContainer);
  await wait(350);

  return { host, bodyContainer };
}

/**
 * يحوّل ملف Word (.docx) إلى PDF في المتصفح.
 */
export async function convertDocxBlobToPdfBlob(docxBlob: Blob): Promise<Blob> {
  const { host, bodyContainer } = await renderDocxToHost(docxBlob);

  try {
    const pages = collectDocxPreviewPages(bodyContainer);
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    for (let i = 0; i < pages.length; i += 1) {
      await captureElementToPdfPage(pdf, pages[i]!, i);
    }

    if (pdf.getNumberOfPages() === 0) {
      throw new Error("تعذر تحويل المستند إلى PDF.");
    }

    return pdf.output("blob");
  } finally {
    host.remove();
  }
}

export async function storeDocxForPreview(docxBlob: Blob): Promise<string> {
  const buffer = await docxBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 5120) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 5120));
  }
  const encoded = btoa(binary);
  sessionStorage.setItem(PREVIEW_SESSION_KEY, encoded);
  return PREVIEW_SESSION_KEY;
}

export function openDocxHtmlPreviewInNewTab() {
  const opened = window.open("/mv/word-report-preview", "_blank", "noopener,noreferrer");
  if (!opened) {
    throw new Error("تعذّر فتح المعاينة — يرجى السماح بالنوافذ المنبثقة.");
  }
}

export function openBlobInNewTab(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("تعذّر فتح المعاينة — يرجى السماح بالنوافذ المنبثقة.");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export function downloadBlob(blob: Blob, filename: string) {
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

export { PREVIEW_SESSION_KEY };
