/**
 * Pre-export check: finds template data that the report would print blank.
 * - Template fields / `{{variables}}` marked by the template layer
 *   (`data-mv-template-missing`, see system-report-template-canvas.tsx and
 *   the summary table).
 * - `{{tokens}}` still visible in the sheet text (report-model text whose
 *   variable has no value).
 */

export type ReportTemplateDataGap = {
  label: string;
  /** 1-based sheet numbers where the gap appears. */
  pages: number[];
};

const VISIBLE_TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function collectReportTemplateDataGaps(root: ParentNode): ReportTemplateDataGap[] {
  const gaps = new Map<string, Set<number>>();
  const add = (label: string, page: number) => {
    const key = label.trim();
    if (!key) return;
    const pages = gaps.get(key) ?? new Set<number>();
    pages.add(page);
    gaps.set(key, pages);
  };
  root.querySelectorAll<HTMLElement>("[data-mv-report-sheet]").forEach((sheet, index) => {
    const page = index + 1;
    sheet.querySelectorAll<HTMLElement>("[data-mv-template-missing]").forEach((element) => {
      for (const label of (element.dataset.mvTemplateMissing ?? "").split("|")) add(label, page);
    });
    for (const match of (sheet.textContent ?? "").matchAll(VISIBLE_TOKEN)) add(`{{${match[1]}}}`, page);
  });
  return Array.from(gaps, ([label, pages]) => ({ label, pages: Array.from(pages).sort((a, b) => a - b) }));
}

/** "1، 2، 3 … 9" style compact page list. */
export function formatGapPages(pages: number[], max = 6): string {
  const shown = pages.slice(0, max).join("، ");
  return pages.length > max ? `${shown}…` : shown;
}
