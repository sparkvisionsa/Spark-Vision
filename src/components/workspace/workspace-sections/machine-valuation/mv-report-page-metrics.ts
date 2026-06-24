/** تحويل mm → px (96dpi) — مطابق لتصدير PDF/html2canvas */
export const REPORT_CSS_PX_PER_MM = 96 / 25.4;

/** هامش بين آخر قسم والفوتر داخل الصفحة الداخلية. */
export const REPORT_BODY_CONTENT_FOOTER_GAP_PX = 30;

/** احتياطي إضافي لمنع قصّ الفوتر عند اختلاف القياس. */
export const REPORT_BODY_CONTENT_SAFETY_PX = 12;

export type ReportPageOrientation = "portrait" | "landscape";

/** عرض منطقة المحتوى الداخلية (210mm − padding أفقي 6mm). */
export function getReportInteriorBodyWidthPx(orientation: ReportPageOrientation = "portrait") {
  const pageWidthMm = orientation === "landscape" ? 297 : 210;
  return Math.floor((pageWidthMm - 6) * REPORT_CSS_PX_PER_MM);
}

/**
 * أقصى ارتفاع للمحتوى داخل صفحة داخلية قبل الفوتر.
 * تقدير محافظ: A4 − هيدر − فوتر − padding.
 */
export function getReportInteriorBodyMaxPx(orientation: ReportPageOrientation = "portrait") {
  const pageMm = orientation === "landscape" ? 210 : 297;
  const headerMm = orientation === "landscape" ? 22 : 32;
  const footerMm = orientation === "landscape" ? 16 : 18;
  const bodyPaddingMm = orientation === "landscape" ? 3 : 6;
  const raw = Math.floor((pageMm - headerMm - footerMm - bodyPaddingMm) * REPORT_CSS_PX_PER_MM);
  return Math.max(
    1,
    raw - REPORT_BODY_CONTENT_FOOTER_GAP_PX - REPORT_BODY_CONTENT_SAFETY_PX,
  );
}

/**
 * يوزّع كتل المحتوى على صفحات حسب الارتفاع الفعلي — مثل تدفق Word.
 * `forceBreakAfter`: فهرس كتل تُجبر على بدء صفحة جديدة بعدها (أقسام مخصصة).
 */
export function packFlowBlockIndices(
  heights: number[],
  maxBodyPx: number,
  forceBreakAfter: ReadonlySet<number> = new Set(),
): number[][] {
  if (heights.length === 0) return [[]];

  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;

  const flush = () => {
    if (page.length > 0) {
      pages.push(page);
      page = [];
      used = 0;
    }
  };

  for (let i = 0; i < heights.length; i++) {
    const h = Math.max(1, heights[i] ?? 1);

    if (page.length > 0 && forceBreakAfter.has(i - 1)) flush();

    if (h > maxBodyPx) {
      flush();
      pages.push([i]);
      if (forceBreakAfter.has(i)) flush();
      continue;
    }

    if (used + h > maxBodyPx && page.length > 0) flush();

    page.push(i);
    used += h;

    if (forceBreakAfter.has(i)) flush();
  }

  flush();
  return pages.length > 0 ? pages : [[]];
}

export function getBlockAnchorFromNode(node: unknown): string | null {
  if (!node || typeof node !== "object" || !("props" in node)) return null;
  const props = (node as { props?: { id?: string; "data-mv-report-insert-anchor"?: string } }).props;
  if (!props) return null;
  return props.id ?? props["data-mv-report-insert-anchor"] ?? null;
}
