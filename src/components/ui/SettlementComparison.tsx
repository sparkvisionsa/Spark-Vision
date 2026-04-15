"use client";

import React, { useState, useCallback, useMemo } from "react";

// Import Leaflet dynamically to avoid SSR issues
import dynamic from "next/dynamic";

// Dynamic import for the map component (client-side only)
const MapPickerComponent = dynamic(() => import("./MapPickerComponent"), {
  ssr: false,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type ComparisonRow = {
  evalDate: string;
  propertyTypeId: string;
  comparisonKind: string;
  landSpace: string;
  price: string;
  total: string;
  description: string;
  roads: string;
  street: string;
  source: string;
  notes: string;
  coords: string;
};

export type SettlementRow = {
  inReport: boolean;
  title: string;
  valueM: string;
  cols: string[];
  colAdj: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_TYPES: Record<string, string> = {
  "1": "أرض",
  "2": "شقة",
  "3": "فيلا سكنية",
  "4": "عمارة",
  "5": "إستراحة",
  "6": "مزرعة",
  "7": "مستودع",
  "9": "محل تجاري",
  "10": "دور",
  "20": "أرض زراعية",
  "21": "أرض سكنية",
  "22": "أرض تجارية",
  "23": "أرض سكنية تجارية",
  "24": "فندق",
  "25": "مبنى",
  "28": "مبنى تجاري",
  "47": "مزرعة قائمة",
  "67": "عمارة سكنية",
};

const COMPARISON_KINDS = ["حد", "تنفيذ", "سوم", "عرض", "ايجار", "مزاد"];

const SOURCES = [
  "وزارة العدل",
  "الوسطاء والمكاتب العقارية",
  "البيانات الخاصة بالشركة",
  "البورصة العقارية",
  "السجل العقاري",
];

// Section 1: Market condition items (first 3, always present, editable names)
export const DEFAULT_SECTION1_TITLES = [
  "ظروف السوق",
  "شروط التمويل",
  "عامل الوقت",
];

// Section 2: Property characteristic items (editable names)
const DEFAULT_SECTION2_TITLES = [
  "أفضلية الموقع",
  "المساحة",
  "نوع المقارنة",
  "الإستخدام",
  "عرض الشارع",
  "الواجهات",
  "العمر",
  "طول الطرق الرئيسية",
  "سهولة الوصول",
  "الخدمات",
  "اخرى",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function emptyComparisonRow(): ComparisonRow {
  return {
    evalDate: "",
    propertyTypeId: "",
    comparisonKind: "تنفيذ",
    landSpace: "",
    price: "",
    total: "",
    description: "",
    roads: "",
    street: "",
    source: "",
    notes: "",
    coords: "",
  };
}

export function emptySettlementRow(numCols = 3): SettlementRow {
  return {
    inReport: true,
    title: "",
    valueM: "",
    cols: Array(numCols).fill(""),
    colAdj: Array(numCols).fill(""),
  };
}

function fmt(n: number, decimals = 2): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
function parseNum(v: string | undefined): number {
  if (!v) return 0;
  return parseFloat(v.replace(/,/g, "")) || 0;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  blue: "#1a6fc4",
  blueLight: "#e8f3fb",
  blueMid: "#c5dff6",
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  text: "#1e293b",
  textMuted: "#64748b",
  textLight: "#94a3b8",
  green: "#16a34a",
  greenLight: "#f0fdf4",
  amber: "#d97706",
  amberLight: "#fffbeb",
  red: "#dc2626",
  shadow: "0 1px 3px rgba(0,0,0,0.06)",
};

// ─── Shared cell styles ───────────────────────────────────────────────────────

const cellBase: React.CSSProperties = {
  border: `1px solid ${T.border}`,
  padding: "4px 6px",
  verticalAlign: "middle",
};

const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "4px 6px",
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  fontSize: 12,
  background: T.surface,
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  color: T.text,
  outline: "none",
};

const readonlyInput: React.CSSProperties = {
  ...inputBase,
  background: T.surfaceAlt,
  color: T.textMuted,
  fontWeight: 500,
  border: `1px solid ${T.border}`,
};

const thBase: React.CSSProperties = {
  background: T.surfaceAlt,
  border: `1px solid ${T.border}`,
  padding: "8px 10px",
  fontWeight: 600,
  fontSize: 12,
  whiteSpace: "nowrap" as const,
  textAlign: "center" as const,
  color: T.text,
};

// ─── Comparison Properties Table ──────────────────────────────────────────────

function ComparisonPropertiesTable({
  rows,
  onChange,
}: {
  rows: ComparisonRow[];
  onChange: (rows: ComparisonRow[]) => void;
}) {
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  const addRow = () => onChange([...rows, emptyComparisonRow()]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  const openMapPicker = (index: number) => {
    setActiveRowIndex(index);
    setShowMapPicker(true);
  };

  const updateCoordsFromMap = (coords: string) => {
    if (activeRowIndex !== null) {
      updateRow(activeRowIndex, "coords", coords);
    }
    setShowMapPicker(false);
    setActiveRowIndex(null);
  };

  const updateRow = useCallback(
    (i: number, field: keyof ComparisonRow, val: string) => {
      onChange(
        rows.map((r, idx) => {
          if (idx !== i) return r;
          const updated = { ...r, [field]: val };
          if (field === "landSpace" || field === "price") {
            const area = parseNum(field === "landSpace" ? val : r.landSpace);
            const price = parseNum(field === "price" ? val : r.price);
            updated.total = area && price ? fmt(area * price, 0) : "";
          }
          return updated;
        }),
      );
    },
    [rows, onChange],
  );

  const headers = [
    "م",
    "التاريخ",
    "النوع",
    "نوع المقارنة",
    "المساحة (م²)",
    "سعر المتر (ريال)",
    "الإجمالي",
    "البُعد / الوصف",
    "عدد الشوارع",
    "عرض الشارع",
    "المصدر",
    "ملاحظات",
    "الإحداثيات",
    "",
  ];

  return (
    <div>
      <div
        style={{
          overflowX: "auto",
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadow,
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    ...thBase,
                    background: T.blue,
                    color: "#fff",
                    border: `1px solid rgba(255,255,255,0.15)`,
                    padding: "10px 8px",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{ background: i % 2 === 0 ? T.surface : T.surfaceAlt }}
              >
                <td
                  style={{
                    ...cellBase,
                    textAlign: "center",
                    color: T.textMuted,
                    fontWeight: 600,
                    fontSize: 11,
                    width: 28,
                  }}
                >
                  {i + 1}
                </td>
                <td style={cellBase}>
                  <input
                    type="date"
                    value={row.evalDate}
                    onChange={(e) => updateRow(i, "evalDate", e.target.value)}
                    style={{ ...inputBase, minWidth: 120 }}
                  />
                </td>
                <td style={cellBase}>
                  <select
                    value={row.propertyTypeId}
                    onChange={(e) =>
                      updateRow(i, "propertyTypeId", e.target.value)
                    }
                    style={{ ...inputBase, minWidth: 100 }}
                  >
                    <option value="" disabled>
                      النوع
                    </option>
                    {Object.entries(PROPERTY_TYPES).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={cellBase}>
                  <select
                    value={row.comparisonKind}
                    onChange={(e) =>
                      updateRow(i, "comparisonKind", e.target.value)
                    }
                    style={{ ...inputBase, minWidth: 80 }}
                  >
                    {COMPARISON_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={cellBase}>
                  <input
                    dir="ltr"
                    type="number"
                    value={row.landSpace}
                    onChange={(e) => updateRow(i, "landSpace", e.target.value)}
                    style={{ ...inputBase, minWidth: 80 }}
                    placeholder="0"
                  />
                </td>
                <td style={cellBase}>
                  <input
                    dir="ltr"
                    type="number"
                    value={row.price}
                    onChange={(e) => updateRow(i, "price", e.target.value)}
                    style={{ ...inputBase, minWidth: 80 }}
                    placeholder="0"
                  />
                </td>
                <td style={cellBase}>
                  <input
                    dir="ltr"
                    readOnly
                    value={row.total}
                    style={{ ...readonlyInput, minWidth: 100 }}
                  />
                </td>
                <td style={cellBase}>
                  <input
                    value={row.description}
                    onChange={(e) =>
                      updateRow(i, "description", e.target.value)
                    }
                    style={{ ...inputBase, minWidth: 80 }}
                  />
                </td>
                <td style={cellBase}>
                  <input
                    type="number"
                    value={row.roads}
                    onChange={(e) => updateRow(i, "roads", e.target.value)}
                    style={{ ...inputBase, minWidth: 50 }}
                  />
                </td>
                <td style={cellBase}>
                  <input
                    type="number"
                    value={row.street}
                    onChange={(e) => updateRow(i, "street", e.target.value)}
                    style={{ ...inputBase, minWidth: 50 }}
                  />
                </td>
                <td style={cellBase}>
                  <input
                    list={`src-list-${i}`}
                    value={row.source}
                    onChange={(e) => updateRow(i, "source", e.target.value)}
                    style={{ ...inputBase, minWidth: 120 }}
                  />
                  <datalist id={`src-list-${i}`}>
                    {SOURCES.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </td>
                <td style={cellBase}>
                  <input
                    value={row.notes}
                    onChange={(e) => updateRow(i, "notes", e.target.value)}
                    style={{ ...inputBase, minWidth: 80 }}
                  />
                </td>
                <td style={cellBase}>
                  <div
                    style={{ display: "flex", gap: 4, alignItems: "center" }}
                  >
                    <input
                      placeholder="lat,lng"
                      value={row.coords}
                      onChange={(e) => updateRow(i, "coords", e.target.value)}
                      style={{ ...inputBase, minWidth: 110, flex: 1 }}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => openMapPicker(i)}
                      style={{
                        background: T.blueLight,
                        border: `1px solid ${T.blueMid}`,
                        borderRadius: 4,
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                      title="اختر من الخريطة"
                    >
                      🗺️ خريطة
                    </button>
                  </div>
                </td>
                <td style={{ ...cellBase, textAlign: "center", width: 32 }}>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: T.red,
                      fontSize: 14,
                      padding: "2px 4px",
                      borderRadius: 4,
                    }}
                    title="حذف"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={headers.length}
                  style={{
                    ...cellBase,
                    textAlign: "center",
                    padding: 24,
                    color: T.textMuted,
                  }}
                >
                  لا توجد مقارنات. اضغط "＋ إضافة مقارنة" لإضافة عقار مقارن.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        style={{
          marginTop: 10,
          background: T.blueLight,
          border: `1px solid ${T.blueMid}`,
          color: T.blue,
          cursor: "pointer",
          fontSize: 13,
          padding: "6px 14px",
          borderRadius: 6,
          fontFamily: "inherit",
          fontWeight: 500,
        }}
      >
        ＋ إضافة مقارنة
      </button>

      {showMapPicker && activeRowIndex !== null && (
        <MapPickerComponent
          value={rows[activeRowIndex]?.coords || ""}
          onChange={updateCoordsFromMap}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
}

// ─── Settlement Table ─────────────────────────────────────────────────────────

type SettlementSection1Row = { title: string; colAdj: string[] };
type SettlementSection2Row = {
  inReport: boolean;
  title: string;
  valueM: string;
  cols: string[];
  colAdj: string[];
};

function SettlementAdjustmentsTable({
  comparisonRows,
  bases,
  onBasesChange,
  section1Rows,
  onSection1Change,
  section2Rows,
  onSection2Change,
  subjectArea,
  weights,
  onWeightsChange,
}: {
  comparisonRows: ComparisonRow[];
  bases: string[];
  onBasesChange: (b: string[]) => void;
  section1Rows: SettlementSection1Row[];
  onSection1Change: (r: SettlementSection1Row[]) => void;
  section2Rows: SettlementSection2Row[];
  onSection2Change: (r: SettlementSection2Row[]) => void;
  subjectArea: string;
  weights: string[];
  onWeightsChange: (w: string[]) => void;
}) {
  const n = Math.max(comparisonRows.length, 1);

  const [scaleFactor, setScaleFactor] = useState<string>("100");
  const [roundTo, setRoundTo] = useState<string>("0");

  // Rounding helper function
  const roundValue = (value: number, roundTo: string): number => {
    const roundBase = parseNum(roundTo);
    if (roundBase <= 0) return value;
    return Math.round(value / roundBase) * roundBase;
  };

  const effectiveBases = useMemo(
    () =>
      Array.from({ length: n }, (_, c) =>
        bases[c] !== undefined && bases[c] !== ""
          ? bases[c]
          : (comparisonRows[c]?.price ?? ""),
      ),
    [n, bases, comparisonRows],
  );

  const updateBase = (c: number, val: string) => {
    const nb = [...bases];
    while (nb.length < n) nb.push("");
    nb[c] = val;
    onBasesChange(nb);
  };

  const updateS1Adj = (i: number, c: number, val: string) => {
    onSection1Change(
      section1Rows.map((r, ri) => {
        if (ri !== i) return r;
        const arr = [...(r.colAdj || [])];
        while (arr.length < n) arr.push("");
        arr[c] = val;
        return { ...r, colAdj: arr };
      }),
    );
  };

  const updateS1Title = (i: number, val: string) =>
    onSection1Change(
      section1Rows.map((r, ri) => (ri === i ? { ...r, title: val } : r)),
    );

  const updateS1ValueM = (i: number, val: string) =>
    onSection1Change(
      section1Rows.map((r, ri) => (ri === i ? { ...r, valueM: val } : r)),
    );

  const updateS1Col = (i: number, c: number, val: string) =>
    onSection1Change(
      section1Rows.map((r, ri) => {
        if (ri !== i) return r;
        const cols = [...(r.cols || [])];
        while (cols.length < n) cols.push("");
        cols[c] = val;
        return { ...r, cols };
      }),
    );

  const updateS2 = (i: number, field: keyof SettlementSection2Row, val: any) =>
    onSection2Change(
      section2Rows.map((r, ri) => (ri === i ? { ...r, [field]: val } : r)),
    );

  const updateS2Col = (
    i: number,
    c: number,
    field: "cols" | "colAdj",
    val: string,
  ) =>
    onSection2Change(
      section2Rows.map((r, ri) => {
        if (ri !== i) return r;
        const arr = [...(r[field] || [])];
        while (arr.length < n) arr.push("");
        arr[c] = val;
        return { ...r, [field]: arr };
      }),
    );

  const addS2Row = () =>
    onSection2Change([
      ...section2Rows,
      {
        inReport: true,
        title: "",
        valueM: "",
        cols: Array(n).fill(""),
        colAdj: Array(n).fill(""),
      },
    ]);

  const removeS2Row = (i: number) =>
    onSection2Change(section2Rows.filter((_, ri) => ri !== i));

  // Percentage-based adjustment: pct% of the base price
  const pctAdj = (base: number, pct: string) => base * (parseNum(pct) / 100);

  // Section 1 totals (sum of % adjustments applied to each base)
  const s1AdjAmounts = useMemo(
    () =>
      Array.from({ length: n }, (_, c) => {
        const base = parseNum(effectiveBases[c]);
        return section1Rows.reduce(
          (sum, r) => sum + pctAdj(base, (r.colAdj || [])[c]),
          0,
        );
      }),
    [section1Rows, effectiveBases, n],
  );

  const priceAfterS1 = useMemo(
    () =>
      Array.from({ length: n }, (_, c) => {
        const base = parseNum(effectiveBases[c]);
        return base ? base + s1AdjAmounts[c] : 0;
      }),
    [effectiveBases, s1AdjAmounts, n],
  );

  // Section 2 totals (% of price-after-s1)
  const s2AdjAmounts = useMemo(
    () =>
      Array.from({ length: n }, (_, c) => {
        const base = priceAfterS1[c];
        return section2Rows.reduce(
          (sum, r) => sum + pctAdj(base, (r.colAdj || [])[c]),
          0,
        );
      }),
    [section2Rows, priceAfterS1, n],
  );

  const priceAfterAll = useMemo(
    () =>
      Array.from({ length: n }, (_, c) => priceAfterS1[c] + s2AdjAmounts[c]),
    [priceAfterS1, s2AdjAmounts, n],
  );

  const totalWeight = useMemo(
    () => weights.slice(0, n).reduce((s, w) => s + parseNum(w), 0),
    [weights, n],
  );

  const weightError = totalWeight > 0 && Math.abs(totalWeight - 100) > 0.01;
  const weightOk = Math.abs(totalWeight - 100) <= 0.01;

  const contributions = useMemo(
    () =>
      Array.from({ length: n }, (_, c) => {
        if (!totalWeight) return 0;
        // Show the price after applying weight (price × weight%)
        return priceAfterAll[c] * (parseNum(weights[c]) / 100);
      }),
    [priceAfterAll, weights, n],
  );

  const netPricePerMeterRaw = useMemo(
    () => (weightOk ? contributions.reduce((s, v) => s + v, 0) : 0),
    [contributions, weightOk],
  );

  const scaleFactorNum = useMemo(() => parseNum(scaleFactor), [scaleFactor]);

  const netPricePerMeter = useMemo(() => {
    if (scaleFactorNum === 0) return 0;
    const scaled = netPricePerMeterRaw * (scaleFactorNum / 100);
    return roundValue(scaled, roundTo);
  }, [netPricePerMeterRaw, scaleFactorNum, roundTo]);

  const totalPropertyValue = useMemo(() => {
    const rawValue = netPricePerMeter * parseNum(subjectArea);
    return roundValue(rawValue, roundTo);
  }, [netPricePerMeter, subjectArea, roundTo]);

  const colColors = [
    "#1a6fc4",
    "#0f766e",
    "#7c3aed",
    "#b45309",
    "#be185d",
    "#047857",
    "#1d4ed8",
    "#9d174d",
  ];
  const colSpanStyle = (c: number): React.CSSProperties => ({
    background: colColors[c % colColors.length],
    border: `1px solid rgba(255,255,255,0.2)`,
    color: "#fff",
    padding: "8px 6px",
    fontWeight: 600,
    fontSize: 12,
    textAlign: "center",
    whiteSpace: "nowrap",
  });

  const labelCell: React.CSSProperties = {
    ...cellBase,
    fontWeight: 500,
    fontSize: 12,
    color: T.text,
    whiteSpace: "nowrap",
    minWidth: 130,
    background: T.surfaceAlt,
  };

  return (
    <div>
      <div
        style={{
          overflowX: "auto",
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadow,
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr>
              <th style={{ ...thBase, minWidth: 160 }}>البند</th>
              <th style={{ ...thBase, minWidth: 100 }}>محل التقييم</th>
              {Array.from({ length: n }, (_, c) => (
                <th key={c} colSpan={2} style={colSpanStyle(c)}>
                  مقارنة {c + 1}
                  {comparisonRows[c]?.description
                    ? ` — ${comparisonRows[c].description}`
                    : ""}
                </th>
              ))}
            </tr>
            <tr style={{ background: T.surfaceAlt }}>
              <th style={thBase}>—</th>
              <th style={thBase}>—</th>
              {Array.from({ length: n }, (_, c) => (
                <React.Fragment key={c}>
                  <th style={{ ...thBase, fontSize: 11, color: T.textMuted }}>
                    وصف
                  </th>
                  <th style={{ ...thBase, fontSize: 11, color: T.textMuted }}>
                    تعديل %
                  </th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Base price row */}
            <tr style={{ background: "#e8f3fb" }}>
              <td
                style={{ ...labelCell, background: "#dbeafe", color: T.blue }}
              >
                💰 سعر المتر (ريال/م²)
              </td>
              <td style={{ ...cellBase, background: "#dbeafe" }}>—</td>
              {Array.from({ length: n }, (_, c) => (
                <td
                  key={c}
                  colSpan={2}
                  style={{ ...cellBase, background: "#dbeafe" }}
                >
                  <input
                    dir="ltr"
                    type="number"
                    value={effectiveBases[c]}
                    onChange={(e) => updateBase(c, e.target.value)}
                    style={{
                      ...inputBase,
                      background: "#fff",
                      fontWeight: 600,
                    }}
                    placeholder="0"
                  />
                </td>
              ))}
            </tr>

            {/* Section 1 divider */}
            <tr>
              <td
                colSpan={2 + n * 2}
                style={{
                  background: "#1e3a5f",
                  color: "#fff",
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                }}
              >
                القسم الأول: تعديلات ظروف السوق والتمويل
              </td>
            </tr>

            {section1Rows.map((row, i) => (
              <tr
                key={i}
                style={{ background: i % 2 === 0 ? T.surface : T.surfaceAlt }}
              >
                <td style={labelCell}>
                  <input
                    value={row.title}
                    onChange={(e) => updateS1Title(i, e.target.value)}
                    placeholder="اسم البند"
                    style={{ ...inputBase, fontWeight: 500 }}
                  />
                </td>
                <td style={cellBase}>
                  <input
                    value={(row as any).valueM ?? ""}
                    onChange={(e) => updateS1ValueM(i, e.target.value)}
                    style={{ ...inputBase, minWidth: 80 }}
                    placeholder="قيمة الأصل"
                  />
                </td>
                {Array.from({ length: n }, (_, c) => (
                  <React.Fragment key={c}>
                    <td style={cellBase}>
                      <input
                        value={((row as any).cols || [])[c] ?? ""}
                        onChange={(e) => updateS1Col(i, c, e.target.value)}
                        style={{ ...inputBase, minWidth: 60 }}
                        placeholder="وصف"
                      />
                    </td>
                    <td style={cellBase}>
                      <input
                        dir="ltr"
                        type="number"
                        value={(row.colAdj || [])[c] ?? ""}
                        onChange={(e) => updateS1Adj(i, c, e.target.value)}
                        style={inputBase}
                        placeholder="0"
                      />
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))}

            {/* Section 1 total - sum of percentages */}
            <tr style={{ background: "#e0edff", fontWeight: 600 }}>
              <td
                style={{ ...labelCell, background: "#e0edff", color: T.blue }}
              >
                ∑ إجمالي تسويات القسم الأول (%)
              </td>
              <td style={{ ...cellBase, background: "#e0edff" }}>—</td>
              {Array.from({ length: n }, (_, c) => {
                // Calculate sum of all adjustment percentages for this column
                const sumPercentages = section1Rows.reduce(
                  (sum, row) => sum + parseNum((row.colAdj || [])[c]),
                  0,
                );
                return (
                  <td
                    key={c}
                    colSpan={2}
                    style={{ ...cellBase, background: "#e0edff" }}
                  >
                    <input
                      dir="ltr"
                      readOnly
                      value={fmt(sumPercentages, 0)}
                      style={{
                        ...readonlyInput,
                        fontWeight: 600,
                        color: sumPercentages < 0 ? T.red : T.green,
                      }}
                    />
                  </td>
                );
              })}
            </tr>

            {/* Price after S1 */}
            <tr style={{ fontWeight: 600 }}>
              <td
                style={{ ...labelCell, background: "#cfe3ff", color: T.blue }}
              >
                📊 السعر بعد تسويات القسم الأول
              </td>
              <td style={{ ...cellBase, background: "#cfe3ff" }}>—</td>
              {Array.from({ length: n }, (_, c) => (
                <td
                  key={c}
                  colSpan={2}
                  style={{ ...cellBase, background: "#cfe3ff" }}
                >
                  <input
                    dir="ltr"
                    readOnly
                    value={priceAfterS1[c] ? fmt(priceAfterS1[c]) : "—"}
                    style={{
                      ...readonlyInput,
                      background: "#cfe3ff",
                      fontWeight: 700,
                      color: T.blue,
                    }}
                  />
                </td>
              ))}
            </tr>

            {/* Section 2 divider */}
            <tr>
              <td
                colSpan={2 + n * 2}
                style={{
                  background: "#1e3a5f",
                  color: "#fff",
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                }}
              >
                القسم الثاني: تعديلات خصائص العقار
              </td>
            </tr>

            {section2Rows.map((row, i) => (
              <tr
                key={i}
                style={{ background: i % 2 === 0 ? T.surface : T.surfaceAlt }}
              >
                <td style={labelCell}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <input
                      type="checkbox"
                      checked={!!row.inReport}
                      onChange={(e) =>
                        updateS2(i, "inReport", e.target.checked)
                      }
                      style={{
                        accentColor: T.blue,
                        width: 14,
                        height: 14,
                        flexShrink: 0,
                      }}
                    />
                    <input
                      value={row.title}
                      onChange={(e) => updateS2(i, "title", e.target.value)}
                      placeholder="اسم البند"
                      style={{ ...inputBase, flex: 1, fontWeight: 500 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeS2Row(i)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: T.textLight,
                        fontSize: 12,
                        padding: "2px",
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </td>
                <td style={cellBase}>
                  <input
                    value={row.valueM}
                    onChange={(e) => updateS2(i, "valueM", e.target.value)}
                    style={{ ...inputBase, minWidth: 80 }}
                    placeholder="قيمة الأصل"
                  />
                </td>
                {Array.from({ length: n }, (_, c) => (
                  <React.Fragment key={c}>
                    <td style={cellBase}>
                      <input
                        value={(row.cols || [])[c] ?? ""}
                        onChange={(e) =>
                          updateS2Col(i, c, "cols", e.target.value)
                        }
                        style={{ ...inputBase, minWidth: 60 }}
                        placeholder="وصف"
                      />
                    </td>
                    <td style={cellBase}>
                      <input
                        dir="ltr"
                        type="number"
                        value={(row.colAdj || [])[c] ?? ""}
                        onChange={(e) =>
                          updateS2Col(i, c, "colAdj", e.target.value)
                        }
                        style={inputBase}
                        placeholder="0"
                      />
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))}

            {/* Section 2 total - sum of percentages */}
            <tr style={{ background: "#dcfce7", fontWeight: 600 }}>
              <td
                style={{ ...labelCell, background: "#dcfce7", color: T.green }}
              >
                ∑ إجمالي تسويات القسم الثاني (%)
              </td>
              <td style={{ ...cellBase, background: "#dcfce7" }}>—</td>
              {Array.from({ length: n }, (_, c) => {
                // Calculate sum of all adjustment percentages for this column from section 2
                const sumPercentages = section2Rows.reduce(
                  (sum, row) => sum + parseNum((row.colAdj || [])[c]),
                  0,
                );
                return (
                  <td
                    key={c}
                    colSpan={2}
                    style={{ ...cellBase, background: "#dcfce7" }}
                  >
                    <input
                      dir="ltr"
                      readOnly
                      value={fmt(sumPercentages, 0)}
                      style={{
                        ...readonlyInput,
                        fontWeight: 600,
                        color: sumPercentages < 0 ? T.red : T.green,
                      }}
                    />
                  </td>
                );
              })}
            </tr>

            {/* Final price */}
            <tr>
              <td
                style={{
                  ...labelCell,
                  background: "#bbf7d0",
                  color: "#065f46",
                }}
              >
                ✅ السعر النهائي بعد جميع التسويات
              </td>
              <td style={{ ...cellBase, background: "#bbf7d0" }}>—</td>
              {Array.from({ length: n }, (_, c) => (
                <td
                  key={c}
                  colSpan={2}
                  style={{ ...cellBase, background: "#bbf7d0" }}
                >
                  <input
                    dir="ltr"
                    readOnly
                    value={priceAfterAll[c] ? fmt(priceAfterAll[c]) : "—"}
                    style={{
                      ...readonlyInput,
                      background: "#bbf7d0",
                      fontWeight: 700,
                      color: "#065f46",
                    }}
                  />
                </td>
              ))}
            </tr>

            {/* Weights row — with live sum indicator */}
            <tr style={{ background: "#fef9c3" }}>
              <td style={{ ...labelCell, background: "#fef9c3" }}>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <span>⚖️ الوزن النسبي %</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: weightError
                        ? T.red
                        : weightOk
                          ? T.green
                          : T.textMuted,
                      fontWeight: 600,
                    }}
                  >
                    {totalWeight > 0
                      ? `المجموع: ${fmt(totalWeight, 0)}%${weightOk ? " ✓" : weightError ? " ✗ يجب أن يكون 100" : ""}`
                      : "يجب أن يساوي 100%"}
                  </span>
                </div>
              </td>
              <td style={{ ...cellBase, background: "#fef9c3" }}>—</td>
              {Array.from({ length: n }, (_, c) => (
                <td
                  key={c}
                  colSpan={2}
                  style={{ ...cellBase, background: "#fef9c3" }}
                >
                  <input
                    dir="ltr"
                    type="number"
                    min="0"
                    max="100"
                    value={weights[c] ?? ""}
                    onChange={(e) => {
                      const w = [...weights];
                      while (w.length < n) w.push("");
                      w[c] = e.target.value;
                      onWeightsChange(w);
                    }}
                    style={{
                      ...inputBase,
                      background: "#fef9c3",
                      borderColor: weightError
                        ? T.red
                        : weightOk
                          ? T.green
                          : T.border,
                    }}
                    placeholder="0"
                  />
                </td>
              ))}
            </tr>

            {/* Contributions */}
            <tr style={{ background: "#fef3c7" }}>
              <td style={{ ...labelCell, background: "#fde68a" }}>
                📐 مساهمة المقارن (مرجح)
              </td>
              <td style={{ ...cellBase, background: "#fde68a" }}>—</td>
              {Array.from({ length: n }, (_, c) => (
                <td
                  key={c}
                  colSpan={2}
                  style={{ ...cellBase, background: "#fde68a" }}
                >
                  <input
                    dir="ltr"
                    readOnly
                    value={contributions[c] ? fmt(contributions[c]) : "—"}
                    style={{
                      ...readonlyInput,
                      background: "#fde68a",
                      fontWeight: 600,
                      color: T.amber,
                    }}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addS2Row}
        style={{
          marginTop: 10,
          background: T.surfaceAlt,
          border: `1px solid ${T.border}`,
          color: T.blue,
          cursor: "pointer",
          fontSize: 13,
          padding: "6px 14px",
          borderRadius: 6,
          fontFamily: "inherit",
          fontWeight: 500,
        }}
      >
        ＋ إضافة بند للقسم الثاني
      </button>

      {/* Controls Row - Scale Factor and Rounding */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginTop: 20,
          marginBottom: 20,
          padding: "16px",
          background: T.surfaceAlt,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
        }}
      >
        {/* Scale Factor Control */}
        <div
          style={{
            background: T.surface,
            borderRadius: 8,
            padding: "12px 16px",
            border: `1px solid ${T.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: T.textMuted,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>⚙️</span>
            نسبة القياس الأساسي (%)
          </div>
          <input
            dir="ltr"
            type="number"
            value={scaleFactor}
            onChange={(e) => setScaleFactor(e.target.value)}
            style={{
              ...inputBase,
              fontSize: 16,
              fontWeight: 600,
              textAlign: "center",
            }}
            placeholder="100"
          />
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>
            100 = القيمة الأصلية | 50 = النصف | 200 = الضعف
          </div>
        </div>

        {/* Rounding Control */}
        <div
          style={{
            background: T.surface,
            borderRadius: 8,
            padding: "12px 16px",
            border: `1px solid ${T.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: T.textMuted,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>🔄</span>
            التقريب إلى أقرب
          </div>
          <select
            value={roundTo}
            onChange={(e) => setRoundTo(e.target.value)}
            style={{
              ...inputBase,
              fontSize: 14,
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            <option value="0">بدون تقريب</option>
            <option value="1">أقرب 1</option>
            <option value="5">أقرب 5</option>
            <option value="10">أقرب 10</option>
            <option value="50">أقرب 50</option>
            <option value="100">أقرب 100</option>
            <option value="500">أقرب 500</option>
            <option value="1000">أقرب 1000</option>
            <option value="5000">أقرب 5000</option>
            <option value="10000">أقرب 10000</option>
          </select>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>
            مثال: 1,234 مع تقريب 5 يصبح 1,235
          </div>
        </div>
      </div>

      {/* KPI summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginTop: 0,
          padding: "16px",
          background: T.surfaceAlt,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
        }}
      >
        <KpiCard
          label="صافي سعر المتر بعد جميع التسويات"
          value={
            netPricePerMeter
              ? `${fmt(netPricePerMeter)} ريال/م²`
              : weightError
                ? "الأوزان لا تساوي 100%"
                : "—"
          }
          accent={T.blue}
          icon="📊"
        />
        <KpiCard
          label="إجمالي الوزن النسبي"
          value={
            totalWeight ? `${fmt(totalWeight, 0)}%${weightOk ? " ✓" : ""}` : "—"
          }
          accent={weightOk ? T.green : weightError ? T.red : "#7c3aed"}
          icon="⚖️"
        />
        <KpiCard
          label="إجمالي قيمة العقار"
          value={
            subjectArea && netPricePerMeter
              ? `${fmt(totalPropertyValue, 0)} ريال`
              : "أدخل مساحة الأصل"
          }
          accent={T.green}
          icon="🏠"
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: string;
}) {
  return (
    <div
      style={{
        background: T.surface,
        borderRadius: 8,
        padding: "12px 16px",
        borderRight: `4px solid ${accent}`,
        border: `1px solid ${T.border}`,
        borderRightWidth: 4,
        borderRightColor: accent,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: T.textMuted,
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: accent,
          direction: "ltr",
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Main export: SettlementComparison ───────────────────────────────────────

export type SettlementComparisonProps = {
  useLabel?: string;
  subjectArea?: string;

  comparisonRows: ComparisonRow[];
  onComparisonRowsChange: (rows: ComparisonRow[]) => void;

  settlementRows: SettlementRow[];
  onSettlementRowsChange: (rows: SettlementRow[]) => void;

  settlementWeights?: string[];
  onSettlementWeightsChange?: (w: string[]) => void;

  settlementBases: string[];
  onSettlementBasesChange: (bases: string[]) => void;

  // Section 1 rows (market conditions — 3 default rows, editable names)
  section1Rows?: { title: string; colAdj: string[] }[];
  onSection1RowsChange?: (rows: { title: string; colAdj: string[] }[]) => void;

  settlementNotes?: string;
  onSettlementNotesChange?: (v: string) => void;
};

export function SettlementComparison({
  useLabel = "عام",
  subjectArea = "",
  comparisonRows,
  onComparisonRowsChange,
  settlementRows,
  onSettlementRowsChange,
  settlementBases,
  onSettlementBasesChange,
  settlementWeights,
  onSettlementWeightsChange,
  section1Rows: externalSection1Rows,
  onSection1RowsChange,
  settlementNotes = "",
  onSettlementNotesChange,
}: SettlementComparisonProps) {
  const n = Math.max(comparisonRows.length, 1);

  // Weights — lifted or local
  const [localWeights, setLocalWeights] = useState<string[]>([]);
  const weights = settlementWeights ?? localWeights;
  const handleWeightsChange = onSettlementWeightsChange ?? setLocalWeights;

  // AFTER
  const defaultSection1 = DEFAULT_SECTION1_TITLES.map((title) => ({
    title,
    colAdj: Array(n).fill(""),
  }));
  const [localSection1, setLocalSection1] = useState(defaultSection1);
  const section1Rows =
    externalSection1Rows && externalSection1Rows.length > 0
      ? externalSection1Rows
      : localSection1;
  const handleSection1Change = onSection1RowsChange ?? setLocalSection1;

  // Section 2 rows — use settlementRows from parent, but ensure default titles
  const section2Rows: SettlementSection2Row[] = (() => {
    if (settlementRows.length > 0) return settlementRows as any;
    return DEFAULT_SECTION2_TITLES.map((title) => ({
      inReport: true,
      title,
      valueM: "",
      cols: Array(n).fill(""),
      colAdj: Array(n).fill(""),
    }));
  })();

  return (
    <div
      dir="rtl"
      style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          padding: "10px 14px",
          background: `linear-gradient(135deg, ${T.blue} 0%, #1558a0 100%)`,
          borderRadius: 8,
          color: "#fff",
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            جدول المقارنة والتسويات
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
            نوع الاستخدام: {useLabel} · {comparisonRows.length} مقارنة
            {subjectArea ? ` · مساحة الأصل: ${subjectArea} م²` : ""}
          </div>
        </div>
        <div style={{ fontSize: 24, opacity: 0.7 }}>🏘</div>
      </div>

      {/* Part 1 */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel number="١" title="العقارات المقارنة" />
        <ComparisonPropertiesTable
          rows={comparisonRows}
          onChange={onComparisonRowsChange}
        />
      </div>

      <div style={{ borderTop: `2px dashed ${T.border}`, margin: "20px 0" }} />

      {/* Part 2 */}
      <div style={{ marginBottom: 20 }}>
        <SectionLabel number="٢" title="جدول التسويات والتعديلات" />
        <p
          style={{
            fontSize: 12,
            color: T.textMuted,
            margin: "0 0 12px",
            lineHeight: 1.6,
          }}
        >
          سعر المتر يُملأ تلقائياً من بيانات المقارنة أعلاه ويمكن تعديله يدوياً.
          القسم الأول يشمل تسويات ظروف السوق، والقسم الثاني يشمل خصائص العقار.
          الخانات المظللة تُحسب تلقائياً.
        </p>
        <SettlementAdjustmentsTable
          comparisonRows={comparisonRows}
          bases={settlementBases}
          onBasesChange={onSettlementBasesChange}
          section1Rows={section1Rows}
          onSection1Change={handleSection1Change}
          section2Rows={section2Rows}
          onSection2Change={onSettlementRowsChange as any}
          subjectArea={subjectArea}
          weights={weights}
          onWeightsChange={handleWeightsChange}
        />
      </div>

      {/* Notes */}
      <div style={{ marginTop: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: T.textMuted,
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          ملاحظات التسويات
        </label>
        <textarea
          value={settlementNotes}
          onChange={(e) => onSettlementNotesChange?.(e.target.value)}
          rows={4}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical" as const,
            boxSizing: "border-box" as const,
            color: T.text,
            outline: "none",
          }}
          placeholder="ملاحظات حول عملية التسويات والتعديلات..."
        />
      </div>
    </div>
  );
}

function SectionLabel({ number, title }: { number: string; title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: T.blue,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.text }}>
        {title}
      </h4>
    </div>
  );
}
