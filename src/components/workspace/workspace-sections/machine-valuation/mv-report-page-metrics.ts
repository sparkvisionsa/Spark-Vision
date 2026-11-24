/** تحويل mm → px (96dpi) — مطابق لتصدير PDF/html2canvas */
export const REPORT_CSS_PX_PER_MM = 96 / 25.4;

/** هامش بين آخر قسم والفوتر داخل الصفحة الداخلية. */
export const REPORT_BODY_CONTENT_FOOTER_GAP_PX = 30;

/** احتياطي إضافي لمنع قصّ الفوتر عند اختلاف القياس. */
export const REPORT_BODY_CONTENT_SAFETY_PX = 12;

export type ReportPageOrientation = "portrait" | "landscape";

/**
 * The physical A4 frame used by the report shell and the flow paginator.
 * Keeping this in one place prevents a visual header/footer redesign from
 * silently shrinking the usable body and clipping a page during PDF capture.
 */
export const REPORT_INTERIOR_FRAME_MM = {
  portrait: {
    paddingInline: 12,
    header: 25,
    footer: 22,
    bodyPaddingTop: 5,
    bodyPaddingBottom: 5,
  },
  landscape: {
    paddingInline: 14,
    header: 19,
    footer: 18,
    bodyPaddingTop: 4,
    bodyPaddingBottom: 4,
  },
} as const;

export type ReportInteriorFrameMm = {
  paddingInline: number;
  header: number;
  footer: number;
  bodyPaddingTop: number;
  bodyPaddingBottom: number;
};

/** Body padding used by custom system templates (studio, shell and paginator). */
export const REPORT_CUSTOM_TEMPLATE_BODY_PADDING_MM = 4;

type FrameTemplateLayout = {
  layout: {
    pageMarginMm: number;
    headerHeightMm: number;
    footerHeightMm: number;
    showHeader: boolean;
    showFooter: boolean;
  };
};

/**
 * The single source of truth for an interior page frame.  The page shell, the
 * flow paginator and the template studio all read it, so a custom template is
 * paginated with exactly the header/footer/margins it is rendered with — no
 * clipped content and no unexplained blank space at the bottom of a page.
 */
export function resolveReportInteriorFrameMm(
  orientation: ReportPageOrientation = "portrait",
  template?: FrameTemplateLayout | null,
): ReportInteriorFrameMm {
  if (!template) return REPORT_INTERIOR_FRAME_MM[orientation];
  const { layout } = template;
  return {
    paddingInline: layout.pageMarginMm,
    header: layout.showHeader === false ? 0 : Math.max(0, layout.headerHeightMm),
    footer: layout.showFooter === false ? 0 : Math.max(0, layout.footerHeightMm),
    bodyPaddingTop: REPORT_CUSTOM_TEMPLATE_BODY_PADDING_MM,
    bodyPaddingBottom: REPORT_CUSTOM_TEMPLATE_BODY_PADDING_MM,
  };
}

/** عرض منطقة المحتوى الداخلية (210mm − padding أفقي 6mm). */
export function getReportInteriorBodyWidthPx(
  orientation: ReportPageOrientation = "portrait",
  frame: ReportInteriorFrameMm = REPORT_INTERIOR_FRAME_MM[orientation],
) {
  const pageWidthMm = orientation === "landscape" ? 297 : 210;
  return Math.floor((pageWidthMm - frame.paddingInline * 2) * REPORT_CSS_PX_PER_MM);
}

/**
 * أقصى ارتفاع للمحتوى داخل صفحة داخلية قبل الفوتر.
 * تقدير محافظ: A4 − هيدر − فوتر − padding.
 */
export function getReportInteriorBodyMaxPx(
  orientation: ReportPageOrientation = "portrait",
  frame: ReportInteriorFrameMm = REPORT_INTERIOR_FRAME_MM[orientation],
) {
  const pageMm = orientation === "landscape" ? 210 : 297;
  const bodyPaddingMm = frame.bodyPaddingTop + frame.bodyPaddingBottom;
  const raw = Math.floor(
    (pageMm - frame.header - frame.footer - bodyPaddingMm) * REPORT_CSS_PX_PER_MM,
  );
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
