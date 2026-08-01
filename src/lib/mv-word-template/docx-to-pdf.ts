import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
/** جودة عالية كاحتياطي متصفح عندما يفشل تحويل الخادم (مستندات صغيرة فقط). */
const JPEG_QUALITY = 0.95;
const CAPTURE_SCALE = 2;

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
          if (img.complete && img.naturalWidth > 0) {
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

/** يقسّم لقطة طويلة إلى صفحات A4 بدلاً من ضغط كل المحتوى في صفحة واحدة. */
function addCanvasSlicesToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, startPageIndex: number): number {
  const pageWidthPx = canvas.width;
  const pageHeightPx = Math.max(1, Math.round((A4_HEIGHT_PT / A4_WIDTH_PT) * pageWidthPx));
  let pageIndex = startPageIndex;
  let offsetY = 0;

  while (offsetY < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
    const slice = document.createElement("canvas");
    slice.width = pageWidthPx;
    slice.height = sliceHeight;
    const ctx = slice.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(
      canvas,
      0,
      offsetY,
      pageWidthPx,
      sliceHeight,
      0,
      0,
      pageWidthPx,
      sliceHeight,
    );

    const imgData = slice.toDataURL("image/jpeg", JPEG_QUALITY);
    if (pageIndex > 0) pdf.addPage("a4", "portrait");
    const drawH = (sliceHeight * A4_WIDTH_PT) / pageWidthPx;
    pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_PT, drawH, undefined, "FAST");

    offsetY += sliceHeight;
    pageIndex += 1;
  }

  return pageIndex;
}

async function captureElementToPdfPages(pdf: jsPDF, element: HTMLElement, startPageIndex: number) {
  const width = Math.max(element.scrollWidth, element.offsetWidth, 800);
  const height = Math.max(element.scrollHeight, element.offsetHeight, 200);
  element.style.width = `${width}px`;
  element.style.minHeight = `${height}px`;
  element.style.background = "#ffffff";

  const canvas = await html2canvas(element, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
  });

  if (canvas.width < 8 || canvas.height < 8) {
    throw new Error("تعذر التقاط صفحة من مستند Word للتحويل إلى PDF.");
  }

  return addCanvasSlicesToPdf(pdf, canvas, startPageIndex);
}

async function renderDocxToHost(docxBlob: Blob) {
  const { renderAsync } = await import("docx-preview");

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dir = "rtl";
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "z-index:-1",
    "pointer-events:none",
    "background:#fff",
    "width:210mm",
    "max-height:0",
    "overflow:hidden",
  ].join(";");

  const styleContainer = document.createElement("div");
  const bodyContainer = document.createElement("div");
  bodyContainer.dir = "rtl";
  bodyContainer.style.cssText = "background:#fff;width:210mm;";
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
  await wait(500);

  return { host, bodyContainer };
}

/**
 * يحوّل ملف Word (.docx) إلى PDF في المتصفح (احتياطي فقط للمستندات الصغيرة).
 */
export async function convertDocxBlobToPdfBlob(docxBlob: Blob): Promise<Blob> {
  const { host, bodyContainer } = await renderDocxToHost(docxBlob);

  try {
    const pages = collectDocxPreviewPages(bodyContainer);
    if (pages.length === 0) {
      throw new Error("تعذر تحويل المستند إلى PDF — لا توجد صفحات للعرض.");
    }
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    let nextPageIndex = 0;

    for (const page of pages) {
      nextPageIndex = await captureElementToPdfPages(pdf, page, nextPageIndex);
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
