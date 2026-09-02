import { MV_REPORT_TOC_ROWS, type MvReportTocRow } from "./mv-valuation-report-toc";
import type { MvReportEditableSection } from "./types";

/** صفوف الفهرس في الصفحة الأولى (مع العنوان والملاحظة). */
// Keep deliberate headroom for Arabic titles that wrap to two or more lines.
// The report shell is a fixed A4 sheet, so an extra TOC page is preferable to
// letting a long title collide with the footer during PDF capture.
export const MV_REPORT_TOC_ROWS_FIRST_PAGE = 14;
/** صفوف الفهرس في صفحات «الفهرس (تابع)». */
export const MV_REPORT_TOC_ROWS_CONTINUATION = 18;

export type ReportTocEntry =
  | { kind: "row"; row: MvReportTocRow }
  | { kind: "custom"; section: MvReportEditableSection; index: number };

export function buildReportTocEntries(
  editableSections: MvReportEditableSection[],
  rows: MvReportTocRow[] = MV_REPORT_TOC_ROWS,
): ReportTocEntry[] {
  const entries: ReportTocEntry[] = rows.map((row) => ({ kind: "row", row }));
  editableSections.forEach((section, index) => {
    entries.push({ kind: "custom", section, index });
  });
  return entries;
}

export function chunkReportTocEntries(
  entries: ReportTocEntry[],
  firstPageLimit = MV_REPORT_TOC_ROWS_FIRST_PAGE,
  continuationLimit = MV_REPORT_TOC_ROWS_CONTINUATION,
): ReportTocEntry[][] {
  if (entries.length === 0) return [[]];
  const chunks: ReportTocEntry[][] = [entries.slice(0, firstPageLimit)];
  let offset = firstPageLimit;
  while (offset < entries.length) {
    chunks.push(entries.slice(offset, offset + continuationLimit));
    offset += continuationLimit;
  }
  return chunks;
}
