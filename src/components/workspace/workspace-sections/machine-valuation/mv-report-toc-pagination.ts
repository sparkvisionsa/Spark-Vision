import { MV_REPORT_TOC_ROWS, type MvReportTocRow } from "./mv-valuation-report-toc";
import type { MvReportEditableSection } from "./types";

/** صفوف الفهرس في الصفحة الأولى (مع العنوان والملاحظة). */
export const MV_REPORT_TOC_ROWS_FIRST_PAGE = 20;
/** صفوف الفهرس في صفحات «الفهرس (تابع)». */
export const MV_REPORT_TOC_ROWS_CONTINUATION = 26;

export type ReportTocEntry =
  | { kind: "row"; row: MvReportTocRow }
  | { kind: "custom"; section: MvReportEditableSection; index: number };

export function buildReportTocEntries(editableSections: MvReportEditableSection[]): ReportTocEntry[] {
  const entries: ReportTocEntry[] = MV_REPORT_TOC_ROWS.map((row) => ({ kind: "row", row }));
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
