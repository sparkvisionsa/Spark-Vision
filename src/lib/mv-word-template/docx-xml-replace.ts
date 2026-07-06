import { MV_WORD_MERGE_FIELDS } from "./fields";
import type { MvWordMergeFieldDef } from "./fields";
import {
  extractWtTextNodes,
  sanitizeXmlText,
  writeWtTextNodes,
} from "./docx-xml-utils";
import { findBalancedTagEnd, walkDocumentXmlSegments } from "./docx-xml-walk";

export type DocxTextMergeStats = {
  paragraphsUpdated: number;
  tableCellsUpdated: number;
};

function normalizeLabelToken(value: string): string {
  return value
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[:：]\s*$/, "")
    .trim();
}

function fieldLabelTokens(field: MvWordMergeFieldDef): string[] {
  const tokens = new Set<string>([field.labelAr]);
  for (const alias of field.aliases) {
    if (!alias.includes("_") && !/^[a-zA-Z]/.test(alias)) tokens.add(alias);
  }
  return [...tokens];
}

function fieldMatchesLabelCell(labelText: string, field: MvWordMergeFieldDef): boolean {
  const normalized = normalizeLabelToken(labelText);
  if (!normalized) return false;

  for (const token of fieldLabelTokens(field)) {
    const tokenNorm = normalizeLabelToken(token);
    if (!tokenNorm) continue;
    if (normalized === tokenNorm) return true;
    if (normalized.endsWith(tokenNorm) && normalized.length <= tokenNorm.length + 12) return true;
    if (normalized.startsWith(tokenNorm) && normalized.length <= tokenNorm.length + 12) return true;
    if (normalized.includes(tokenNorm) && tokenNorm.length >= 4) return true;
  }

  for (const pattern of field.labelPatterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    if (re.test(normalized)) return true;
  }

  return false;
}

function paragraphIsEditable(paragraphXml: string): boolean {
  if (/<w:fldChar|<w:instrText/i.test(paragraphXml)) return false;
  return true;
}

function applyScalarReplacementsInPlainText(
  plainText: string,
  scalarValues: Record<string, string>,
): { text: string; changed: boolean } {
  let combined = plainText;
  let changed = false;

  for (const field of MV_WORD_MERGE_FIELDS) {
    const value = scalarValues[field.key];
    if (!value?.trim()) continue;

    for (const pattern of field.labelPatterns) {
      const re = new RegExp(pattern.source, pattern.flags);
      const next = combined.replace(re, (match, labelPart: string, oldValue: string) => {
        const trimmedOld = String(oldValue ?? "").trim();
        const trimmedNew = value.trim();
        if (trimmedOld === trimmedNew) return match;
        changed = true;
        return `${labelPart}${sanitizeXmlText(value)}`;
      });
      combined = next;
    }
  }

  return { text: combined, changed };
}

function applyReplacementsInParagraph(
  paragraphXml: string,
  scalarValues: Record<string, string>,
  stats: DocxTextMergeStats,
): string {
  if (!paragraphIsEditable(paragraphXml)) return paragraphXml;
  const combined = extractWtTextNodes(paragraphXml);
  if (!combined.trim()) return paragraphXml;
  const { text, changed } = applyScalarReplacementsInPlainText(combined, scalarValues);
  if (!changed) return paragraphXml;
  stats.paragraphsUpdated += 1;
  return writeWtTextNodes(paragraphXml, text);
}

function extractTableCells(rowXml: string): string[] {
  const cells: string[] = [];
  let cursor = 0;
  const open = "<w:tc";
  const close = "</w:tc>";

  while (cursor < rowXml.length) {
    const start = rowXml.indexOf(open, cursor);
    if (start === -1) break;
    const end = findBalancedTagEnd(rowXml, start, "w:tc");
    if (end < 0) break;
    cells.push(rowXml.slice(start, end));
    cursor = end;
  }

  return cells;
}

function findValueCellIndex(cells: string[], labelIndex: number): number {
  for (let index = labelIndex + 1; index < cells.length; index += 1) {
    const text = extractWtTextNodes(cells[index]!).trim();
    if (!text || /^[:：\-–—•·]$/.test(text)) continue;
    return index;
  }
  return labelIndex + 1 < cells.length ? labelIndex + 1 : -1;
}

function applyTableRowReplacements(
  rowXml: string,
  scalarValues: Record<string, string>,
  stats: DocxTextMergeStats,
): string {
  const cells = extractTableCells(rowXml);
  if (cells.length < 2) {
    return replaceParagraphsInSegment(rowXml, scalarValues, stats);
  }

  const newCells = [...cells];
  let changed = false;

  for (let index = 0; index < cells.length; index += 1) {
    const labelCell = cells[index]!;
    const labelText = extractWtTextNodes(labelCell);
    if (!labelText.trim()) continue;

    for (const field of MV_WORD_MERGE_FIELDS) {
      const value = scalarValues[field.key];
      if (!value?.trim()) continue;
      if (!fieldMatchesLabelCell(labelText, field)) continue;

      const valueCellIndex = findValueCellIndex(cells, index);
      if (valueCellIndex < 0 || valueCellIndex >= cells.length) break;

      const valueCell = cells[valueCellIndex]!;
      const oldValue = extractWtTextNodes(valueCell).trim();
      const nextValue = sanitizeXmlText(value);
      if (oldValue === nextValue.trim()) break;

      newCells[valueCellIndex] = writeWtTextNodes(valueCell, nextValue);
      changed = true;
      stats.tableCellsUpdated += 1;
      break;
    }
  }

  if (!changed) {
    return replaceParagraphsInSegment(rowXml, scalarValues, stats);
  }

  let cellIndex = 0;
  const rowWithCells = rowXml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, () => {
    const next = newCells[cellIndex] ?? "";
    cellIndex += 1;
    return next;
  });
  return replaceParagraphsInSegment(rowWithCells, scalarValues, stats);
}

function replaceParagraphsInSegment(
  segmentXml: string,
  scalarValues: Record<string, string>,
  stats: DocxTextMergeStats,
): string {
  return segmentXml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraphXml) =>
    applyReplacementsInParagraph(paragraphXml, scalarValues, stats),
  );
}

function applyStackedLabelRowReplacements(
  tableXml: string,
  scalarValues: Record<string, string>,
  stats: DocxTextMergeStats,
): string {
  const rowPattern = /<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g;
  const rows = [...tableXml.matchAll(rowPattern)].map((match) => match[0] ?? "");
  if (rows.length < 2) return tableXml;

  const newRows = [...rows];
  let changed = false;

  for (let index = 0; index < rows.length - 1; index += 1) {
    const labelRow = rows[index]!;
    const valueRow = rows[index + 1]!;
    const labelCells = extractTableCells(labelRow);
    const valueCells = extractTableCells(valueRow);
    if (labelCells.length !== 1 || valueCells.length !== 1) continue;

    const labelText = extractWtTextNodes(labelCells[0]!);
    if (!labelText.trim()) continue;

    for (const field of MV_WORD_MERGE_FIELDS) {
      const value = scalarValues[field.key];
      if (!value?.trim()) continue;
      if (!fieldMatchesLabelCell(labelText, field)) continue;

      const valueCell = valueCells[0]!;
      const oldValue = extractWtTextNodes(valueCell).trim();
      const nextValue = sanitizeXmlText(value);
      if (oldValue === nextValue.trim()) break;

      const updatedValueRow = valueRow.replace(
        /<w:tc\b[\s\S]*?<\/w:tc>/,
        writeWtTextNodes(valueCell, nextValue),
      );
      newRows[index + 1] = updatedValueRow;
      changed = true;
      stats.tableCellsUpdated += 1;
      break;
    }
  }

  if (!changed) return tableXml;

  let rowIndex = 0;
  return tableXml.replace(rowPattern, () => newRows[rowIndex++] ?? "");
}

function replaceRowsInTable(
  tableXml: string,
  scalarValues: Record<string, string>,
  stats: DocxTextMergeStats,
): string {
  const stacked = applyStackedLabelRowReplacements(tableXml, scalarValues, stats);
  const withRows = stacked.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g, (rowXml) =>
    applyTableRowReplacements(rowXml, scalarValues, stats),
  );
  return replaceParagraphsInSegment(withRows, scalarValues, stats);
}

/**
 * استبدال ذكي للتسميات داخل document.xml مع دعم الجداول المتداخلة.
 */
export function applySmartLabelReplacementsInDocxXml(
  documentXml: string,
  scalarValues: Record<string, string>,
  stats: DocxTextMergeStats = { paragraphsUpdated: 0, tableCellsUpdated: 0 },
): string {
  if (!documentXml.trim()) return documentXml;

  return walkDocumentXmlSegments(documentXml, {
    onTextSegment: (segment) => replaceParagraphsInSegment(segment, scalarValues, stats),
    onTable: (table) => replaceRowsInTable(table, scalarValues, stats),
  });
}

export function listDocxMergeableXmlPartPaths(zipFileNames: string[]): string[] {
  return zipFileNames.filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/i.test(name));
}
