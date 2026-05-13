import { DetailedCellError, HyperFormula } from "hyperformula";

export const MV_FORMULA_SHEET = "MV";

export type MvColumnFormatKind =
  | "general"
  | "number"
  | "currency"
  | "percent"
  | "date";

export function cellToA1(row: number, col: number): string {
  return `${excelColumnLetter(col)}${row + 1}`;
}

/** Excel-style range ref, e.g. A1 or A1:C4 */
export function rangeToA1(
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): string {
  const a = cellToA1(r1, c1);
  const b = cellToA1(r2, c2);
  if (r1 === r2 && c1 === c2) return a;
  return `${a}:${b}`;
}

function excelColumnLetter(zeroBasedIndex: number): string {
  let n = zeroBasedIndex + 1;
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

export function isFormulaRaw(
  v: string | number | null | undefined,
): v is string {
  return typeof v === "string" && v.trimStart().startsWith("=");
}

export function buildMvHyperFormula(
  rows: (string | number | null)[][],
): HyperFormula | null {
  const height = rows.length;
  if (height === 0) return null;
  const width = Math.max(...rows.map((r) => r.length), 0);
  if (width === 0) return null;

  const matrix: (string | number | boolean | null)[][] = [];
  for (let r = 0; r < height; r++) {
    const row: (string | number | boolean | null)[] = [];
    for (let c = 0; c < width; c++) {
      const v = rows[r][c];
      if (v === null || v === undefined || v === "") row.push(null);
      else if (typeof v === "number") row.push(v);
      else row.push(v);
    }
    matrix.push(row);
  }

  try {
    return HyperFormula.buildFromSheets(
      { [MV_FORMULA_SHEET]: matrix },
      { licenseKey: "gpl-v3" },
    );
  } catch {
    return null;
  }
}

export function getFormulaComputedDisplay(
  hf: HyperFormula | null,
  r: number,
  c: number,
  raw: string | number | null,
): string {
  if (!isFormulaRaw(raw)) return "";
  if (!hf) return raw;
  const sheetId = hf.getSheetId(MV_FORMULA_SHEET);
  if (sheetId === undefined) return raw;
  const val = hf.getCellValue({ sheet: sheetId, row: r, col: c });
  if (val instanceof DetailedCellError) return val.message;
  if (val === null || val === undefined) return "";
  return String(val);
}

export function formatValueByColumnKind(
  value: string | number | boolean | null | undefined,
  kind: MvColumnFormatKind,
): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "string") return value;

  const n = value;
  if (!Number.isFinite(n)) return String(n);

  switch (kind) {
    case "number":
      return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 6,
      }).format(n);
    case "currency":
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(n);
    case "percent":
      return new Intl.NumberFormat(undefined, {
        style: "percent",
        maximumFractionDigits: 4,
      }).format(n);
    case "date": {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const ms = epoch.getTime() + n * 86400000;
      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) return String(n);
      return d.toLocaleDateString();
    }
    default:
      return String(n);
  }
}

/** Parse user text or computed value as finite number when possible */
export function tryParseNumberLoose(
  v: string | number | null | undefined,
): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
