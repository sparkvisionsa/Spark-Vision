"use client";

import React, { useState, useCallback, useMemo, useContext } from "react";
import { LanguageContext } from "@/components/layout-provider";

import dynamic from "next/dynamic";

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

// ─── i18n ─────────────────────────────────────────────────────────────────────

type Lang = "ar" | "en";

const SC = {
  ar: {
    comparisonTable: "جدول المقارنات",
    settlementTable: "جدول التسويات والتعديلات",
    propertyComparisons: "العقارات المقارنة",
    adjustmentsTable: "جدول التسويات والتعديلات",
    headerTitle: "جدول المقارنة والتسويات",
    headerSubtitle: (useLabel: string, count: number, area?: string) =>
      `نوع الاستخدام: ${useLabel} · ${count} مقارنة${area ? ` · مساحة الأصل: ${area} م²` : ""}`,
    noComparisons: 'لا توجد مقارنات. اضغط "＋ إضافة مقارنة" لإضافة عقار مقارن.',
    addComparison: "＋ إضافة مقارنة",
    addSection2Row: "＋ إضافة بند للقسم الثاني",
    settlementNotes: "ملاحظات التسويات",
    settlementNotesPlaceholder: "ملاحظات حول عملية التسويات والتعديلات...",
    adjustmentHint:
      "سعر المتر يُملأ تلقائياً من بيانات المقارنة أعلاه ويمكن تعديله يدوياً. القسم الأول يشمل تسويات ظروف السوق، والقسم الثاني يشمل خصائص العقار. الخانات المظللة تُحسب تلقائياً.",
    section1Header: "القسم الأول: تعديلات ظروف السوق والتمويل",
    section2Header: "القسم الثاني: تعديلات خصائص العقار",
    meterPriceRow: "💰 سعر المتر (ريال/م²)",
    section1Total: "∑ إجمالي تسويات القسم الأول (%)",
    priceAfterS1: "📊 السعر بعد تسويات القسم الأول",
    section2Total: "∑ إجمالي تسويات القسم الثاني (%)",
    finalPrice: "✅ السعر النهائي بعد جميع التسويات",
    weightRow: "⚖️ الوزن النسبي %",
    weightsMustBe100: "يجب أن يساوي 100%",
    weightsSum: (n: number) => `المجموع: ${n}%`,
    weightOk: "✓",
    weightError: "✗ يجب أن يكون 100",
    contribution: "📐 مساهمة المقارن (مرجح)",
    netMeterPrice: "صافي سعر المتر بعد جميع التسويات",
    totalWeight: "إجمالي الوزن النسبي",
    totalPropertyValue: "إجمالي قيمة العقار",
    enterAreaFirst: "أدخل مساحة الأصل",
    weightsMustEqual: "الأوزان لا تساوي 100%",
    scaleFactor: "نسبة القياس الأساسي (%)",
    scaleFactorHint: "100 = القيمة الأصلية | 50 = النصف | 200 = الضعف",
    roundTo: "التقريب إلى أقرب",
    roundingHint: "مثال: 1,234 مع تقريب 5 يصبح 1,235",
    noRounding: "بدون تقريب",
    nearest: (n: number) => `أقرب ${n}`,
    // Comparison table headers
    colSerial: "م",
    colDate: "التاريخ",
    colType: "النوع",
    colKind: "نوع المقارنة",
    colArea: "المساحة (م²)",
    colMeterPrice: "سعر المتر (ريال)",
    colTotal: "الإجمالي",
    colDistance: "البُعد / الوصف",
    colRoads: "عدد الشوارع",
    colStreet: "عرض الشارع",
    colSource: "المصدر",
    colNotes: "ملاحظات",
    colCoords: "الإحداثيات",
    colDelete: "",
    // Settlement table headers
    settlColItem: "البند",
    settlColSubject: "محل التقييم",
    settlColDesc: "وصف",
    settlColAdj: "تعديل %",
    settlColComp: (n: number) => `مقارنة ${n}`,
    // Input placeholders
    placeholderItemName: "اسم البند",
    placeholderSubjectValue: "قيمة الأصل",
    placeholderDesc: "وصف",
    placeholderCoords: "lat,lng",
    placeholderZero: "0",
    placeholderKind: "النوع",
    // Map button
    mapBtn: "🗺️ خريطة",
    mapBtnTitle: "اختر من الخريطة",
    deleteBtn: "✕",
    deleteBtnTitle: "حذف",
    // Section labels
    sectionLabel1: "١",
    sectionLabel1Title: "العقارات المقارنة",
    sectionLabel2: "٢",
    sectionLabel2Title: "جدول التسويات والتعديلات",
    // SAR unit
    sarUnit: "ريال/م²",
    sarTotal: "ريال",
  },
  en: {
    comparisonTable: "Comparison Table",
    settlementTable: "Adjustments Table",
    propertyComparisons: "Comparable Properties",
    adjustmentsTable: "Settlement & Adjustments Table",
    headerTitle: "Comparison & Settlement Table",
    headerSubtitle: (useLabel: string, count: number, area?: string) =>
      `Usage: ${useLabel} · ${count} comparable${count !== 1 ? "s" : ""}${area ? ` · Subject Area: ${area} m²` : ""}`,
    noComparisons: 'No comparables yet. Click "＋ Add Comparable" to add one.',
    addComparison: "＋ Add Comparable",
    addSection2Row: "＋ Add Section 2 Item",
    settlementNotes: "Adjustment Notes",
    settlementNotesPlaceholder: "Notes about the adjustment process...",
    adjustmentHint:
      "Meter price is auto-filled from the comparables table above and can be overridden. Section 1 covers market condition adjustments; Section 2 covers property characteristics. Shaded cells are auto-calculated.",
    section1Header: "Section 1: Market Conditions & Financing Adjustments",
    section2Header: "Section 2: Property Characteristics Adjustments",
    meterPriceRow: "💰 Meter Price (SAR/m²)",
    section1Total: "∑ Section 1 Total Adjustments (%)",
    priceAfterS1: "📊 Price After Section 1 Adjustments",
    section2Total: "∑ Section 2 Total Adjustments (%)",
    finalPrice: "✅ Final Price After All Adjustments",
    weightRow: "⚖️ Relative Weight %",
    weightsMustBe100: "Must equal 100%",
    weightsSum: (n: number) => `Total: ${n}%`,
    weightOk: "✓",
    weightError: "✗ Must equal 100",
    contribution: "📐 Comparable Contribution (weighted)",
    netMeterPrice: "Net Meter Price After All Adjustments",
    totalWeight: "Total Relative Weight",
    totalPropertyValue: "Total Property Value",
    enterAreaFirst: "Enter subject area",
    weightsMustEqual: "Weights do not equal 100%",
    scaleFactor: "Base Scale Factor (%)",
    scaleFactorHint: "100 = original value | 50 = half | 200 = double",
    roundTo: "Round to nearest",
    roundingHint: "E.g., 1,234 rounded to 5 becomes 1,235",
    noRounding: "No rounding",
    nearest: (n: number) => `Nearest ${n}`,
    // Comparison table headers
    colSerial: "#",
    colDate: "Date",
    colType: "Type",
    colKind: "Comparison Kind",
    colArea: "Area (m²)",
    colMeterPrice: "Meter Price (SAR)",
    colTotal: "Total",
    colDistance: "Distance / Description",
    colRoads: "Road Count",
    colStreet: "Street Width",
    colSource: "Source",
    colNotes: "Notes",
    colCoords: "Coordinates",
    colDelete: "",
    // Settlement table headers
    settlColItem: "Item",
    settlColSubject: "Subject Property",
    settlColDesc: "Description",
    settlColAdj: "Adjustment %",
    settlColComp: (n: number) => `Comparable ${n}`,
    // Input placeholders
    placeholderItemName: "Item name",
    placeholderSubjectValue: "Subject value",
    placeholderDesc: "Description",
    placeholderCoords: "lat,lng",
    placeholderZero: "0",
    placeholderKind: "Kind",
    // Map button
    mapBtn: "🗺️ Map",
    mapBtnTitle: "Pick from map",
    deleteBtn: "✕",
    deleteBtnTitle: "Delete",
    // Section labels
    sectionLabel1: "1",
    sectionLabel1Title: "Comparable Properties",
    sectionLabel2: "2",
    sectionLabel2Title: "Settlement & Adjustments Table",
    // SAR unit
    sarUnit: "SAR/m²",
    sarTotal: "SAR",
  },
} as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_TYPES: Record<Lang, Record<string, string>> = {
  ar: {
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
  },
  en: {
    "1": "Land",
    "2": "Apartment",
    "3": "Residential Villa",
    "4": "Building",
    "5": "Rest House",
    "6": "Farm",
    "7": "Warehouse",
    "9": "Shop",
    "10": "Floor",
    "20": "Agricultural Land",
    "21": "Residential Land",
    "22": "Commercial Land",
    "23": "Mixed-Use Land",
    "24": "Hotel",
    "25": "Building",
    "28": "Commercial Building",
    "47": "Existing Farm",
    "67": "Residential Building",
  },
};

const COMPARISON_KINDS: Record<Lang, string[]> = {
  ar: ["حد", "تنفيذ", "سوم", "عرض", "ايجار", "مزاد"],
  en: ["Boundary", "Executed", "Asking", "Offer", "Rental", "Auction"],
};

const SOURCES: Record<Lang, string[]> = {
  ar: [
    "وزارة العدل",
    "الوسطاء والمكاتب العقارية",
    "البيانات الخاصة بالشركة",
    "البورصة العقارية",
    "السجل العقاري",
  ],
  en: [
    "Ministry of Justice",
    "Real Estate Brokers & Offices",
    "Company Data",
    "Real Estate Exchange",
    "Real Estate Registry",
  ],
};

// Section 1: Market condition items
export const DEFAULT_SECTION1_TITLES: Record<Lang, string[]> = {
  ar: ["ظروف السوق", "شروط التمويل", "عامل الوقت"],
  en: ["Market Conditions", "Financing Terms", "Time Factor"],
};

// Section 2: Property characteristic items
const DEFAULT_SECTION2_TITLES: Record<Lang, string[]> = {
  ar: [
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
  ],
  en: [
    "Location Preference",
    "Area",
    "Comparison Type",
    "Usage",
    "Street Width",
    "Frontages",
    "Age",
    "Main Road Length",
    "Accessibility",
    "Services",
    "Other",
  ],
};

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

const DT = {
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

const cellBase: React.CSSProperties = {
  border: `1px solid ${DT.border}`,
  padding: "4px 6px",
  verticalAlign: "middle",
};

const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "4px 6px",
  border: `1px solid ${DT.border}`,
  borderRadius: 4,
  fontSize: 12,
  background: DT.surface,
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  color: DT.text,
  outline: "none",
};

const readonlyInput: React.CSSProperties = {
  ...inputBase,
  background: DT.surfaceAlt,
  color: DT.textMuted,
  fontWeight: 500,
  border: `1px solid ${DT.border}`,
};

const thBase: React.CSSProperties = {
  background: DT.surfaceAlt,
  border: `1px solid ${DT.border}`,
  padding: "8px 10px",
  fontWeight: 600,
  fontSize: 12,
  whiteSpace: "nowrap" as const,
  textAlign: "center" as const,
  color: DT.text,
};

// ─── Comparison Properties Table ──────────────────────────────────────────────

function ComparisonPropertiesTable({
  rows,
  onChange,
  lang,
}: {
  rows: ComparisonRow[];
  onChange: (rows: ComparisonRow[]) => void;
  lang: Lang;
}) {
  const t = SC[lang];
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
    t.colSerial,
    t.colDate,
    t.colType,
    t.colKind,
    t.colArea,
    t.colMeterPrice,
    t.colTotal,
    t.colDistance,
    t.colRoads,
    t.colStreet,
    t.colSource,
    t.colNotes,
    t.colCoords,
    t.colDelete,
  ];

  return (
    <div>
      <div
        style={{
          overflowX: "auto",
          borderRadius: 8,
          border: `1px solid ${DT.border}`,
          boxShadow: DT.shadow,
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
                    background: DT.blue,
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
                style={{ background: i % 2 === 0 ? DT.surface : DT.surfaceAlt }}
              >
                <td
                  style={{
                    ...cellBase,
                    textAlign: "center",
                    color: DT.textMuted,
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
                      {t.placeholderKind}
                    </option>
                    {Object.entries(PROPERTY_TYPES[lang]).map(([v, l]) => (
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
                    {COMPARISON_KINDS[lang].map((k) => (
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
                    placeholder={t.placeholderZero}
                  />
                </td>
                <td style={cellBase}>
                  <input
                    dir="ltr"
                    type="number"
                    value={row.price}
                    onChange={(e) => updateRow(i, "price", e.target.value)}
                    style={{ ...inputBase, minWidth: 80 }}
                    placeholder={t.placeholderZero}
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
                    {SOURCES[lang].map((s) => (
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
                      placeholder={t.placeholderCoords}
                      value={row.coords}
                      onChange={(e) => updateRow(i, "coords", e.target.value)}
                      style={{ ...inputBase, minWidth: 110, flex: 1 }}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => openMapPicker(i)}
                      style={{
                        background: DT.blueLight,
                        border: `1px solid ${DT.blueMid}`,
                        borderRadius: 4,
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                      title={t.mapBtnTitle}
                    >
                      {t.mapBtn}
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
                      color: DT.red,
                      fontSize: 14,
                      padding: "2px 4px",
                      borderRadius: 4,
                    }}
                    title={t.deleteBtnTitle}
                  >
                    {t.deleteBtn}
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
                    color: DT.textMuted,
                  }}
                >
                  {t.noComparisons}
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
          background: DT.blueLight,
          border: `1px solid ${DT.blueMid}`,
          color: DT.blue,
          cursor: "pointer",
          fontSize: 13,
          padding: "6px 14px",
          borderRadius: 6,
          fontFamily: "inherit",
          fontWeight: 500,
        }}
      >
        {t.addComparison}
      </button>

      {showMapPicker && activeRowIndex !== null && (
        <MapPickerComponent
          value={rows[activeRowIndex]?.coords || ""}
          onChange={updateCoordsFromMap}
          onClose={() => setShowMapPicker(false)}
          lang={lang}
        />
      )}
    </div>
  );
}

// ─── Settlement Table ─────────────────────────────────────────────────────────

type SettlementSection1Row = {
  title: string;
  colAdj: string[];
  cols?: string[];
  valueM?: string;
};
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
  lang,
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
  lang: Lang;
}) {
  const t = SC[lang];
  const n = Math.max(comparisonRows.length, 1);

  const [scaleFactor, setScaleFactor] = useState<string>("100");
  const [roundTo, setRoundTo] = useState<string>("0");

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
        const cols = [...((r as any).cols || [])];
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

  const pctAdj = (base: number, pct: string) => base * (parseNum(pct) / 100);

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
    color: DT.text,
    whiteSpace: "nowrap",
    minWidth: 130,
    background: DT.surfaceAlt,
  };

  const ROUND_OPTIONS = [0, 1, 5, 10, 50, 100, 500, 1000, 5000, 10000];

  return (
    <div>
      <div
        style={{
          overflowX: "auto",
          borderRadius: 8,
          border: `1px solid ${DT.border}`,
          boxShadow: DT.shadow,
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr>
              <th style={{ ...thBase, minWidth: 160 }}>{t.settlColItem}</th>
              <th style={{ ...thBase, minWidth: 100 }}>{t.settlColSubject}</th>
              {Array.from({ length: n }, (_, c) => (
                <th key={c} colSpan={2} style={colSpanStyle(c)}>
                  {t.settlColComp(c + 1)}
                  {comparisonRows[c]?.description
                    ? ` — ${comparisonRows[c].description}`
                    : ""}
                </th>
              ))}
            </tr>
            <tr style={{ background: DT.surfaceAlt }}>
              <th style={thBase}>—</th>
              <th style={thBase}>—</th>
              {Array.from({ length: n }, (_, c) => (
                <React.Fragment key={c}>
                  <th style={{ ...thBase, fontSize: 11, color: DT.textMuted }}>
                    {t.settlColDesc}
                  </th>
                  <th style={{ ...thBase, fontSize: 11, color: DT.textMuted }}>
                    {t.settlColAdj}
                  </th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Base price row */}
            <tr style={{ background: "#e8f3fb" }}>
              <td
                style={{ ...labelCell, background: "#dbeafe", color: DT.blue }}
              >
                {t.meterPriceRow}
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
                    placeholder={t.placeholderZero}
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
                {t.section1Header}
              </td>
            </tr>

            {section1Rows.map((row, i) => (
              <tr
                key={i}
                style={{ background: i % 2 === 0 ? DT.surface : DT.surfaceAlt }}
              >
                <td style={labelCell}>
                  <input
                    value={row.title}
                    onChange={(e) => updateS1Title(i, e.target.value)}
                    placeholder={t.placeholderItemName}
                    style={{ ...inputBase, fontWeight: 500 }}
                  />
                </td>
                <td style={cellBase}>
                  <input
                    value={(row as any).valueM ?? ""}
                    onChange={(e) => updateS1ValueM(i, e.target.value)}
                    style={{ ...inputBase, minWidth: 80 }}
                    placeholder={t.placeholderSubjectValue}
                  />
                </td>
                {Array.from({ length: n }, (_, c) => (
                  <React.Fragment key={c}>
                    <td style={cellBase}>
                      <input
                        value={((row as any).cols || [])[c] ?? ""}
                        onChange={(e) => updateS1Col(i, c, e.target.value)}
                        style={{ ...inputBase, minWidth: 60 }}
                        placeholder={t.placeholderDesc}
                      />
                    </td>
                    <td style={cellBase}>
                      <input
                        dir="ltr"
                        type="number"
                        value={(row.colAdj || [])[c] ?? ""}
                        onChange={(e) => updateS1Adj(i, c, e.target.value)}
                        style={inputBase}
                        placeholder={t.placeholderZero}
                      />
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))}

            {/* Section 1 total */}
            <tr style={{ background: "#e0edff", fontWeight: 600 }}>
              <td
                style={{ ...labelCell, background: "#e0edff", color: DT.blue }}
              >
                {t.section1Total}
              </td>
              <td style={{ ...cellBase, background: "#e0edff" }}>—</td>
              {Array.from({ length: n }, (_, c) => {
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
                        color: sumPercentages < 0 ? DT.red : DT.green,
                      }}
                    />
                  </td>
                );
              })}
            </tr>

            {/* Price after S1 */}
            <tr style={{ fontWeight: 600 }}>
              <td
                style={{ ...labelCell, background: "#cfe3ff", color: DT.blue }}
              >
                {t.priceAfterS1}
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
                      color: DT.blue,
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
                {t.section2Header}
              </td>
            </tr>

            {section2Rows.map((row, i) => (
              <tr
                key={i}
                style={{ background: i % 2 === 0 ? DT.surface : DT.surfaceAlt }}
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
                        accentColor: DT.blue,
                        width: 14,
                        height: 14,
                        flexShrink: 0,
                      }}
                    />
                    <input
                      value={row.title}
                      onChange={(e) => updateS2(i, "title", e.target.value)}
                      placeholder={t.placeholderItemName}
                      style={{ ...inputBase, flex: 1, fontWeight: 500 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeS2Row(i)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: DT.textLight,
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
                    placeholder={t.placeholderSubjectValue}
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
                        placeholder={t.placeholderDesc}
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
                        placeholder={t.placeholderZero}
                      />
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))}

            {/* Section 2 total */}
            <tr style={{ background: "#dcfce7", fontWeight: 600 }}>
              <td
                style={{ ...labelCell, background: "#dcfce7", color: DT.green }}
              >
                {t.section2Total}
              </td>
              <td style={{ ...cellBase, background: "#dcfce7" }}>—</td>
              {Array.from({ length: n }, (_, c) => {
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
                        color: sumPercentages < 0 ? DT.red : DT.green,
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
                {t.finalPrice}
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

            {/* Weights row */}
            <tr style={{ background: "#fef9c3" }}>
              <td style={{ ...labelCell, background: "#fef9c3" }}>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <span>{t.weightRow}</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: weightError
                        ? DT.red
                        : weightOk
                          ? DT.green
                          : DT.textMuted,
                      fontWeight: 600,
                    }}
                  >
                    {totalWeight > 0
                      ? `${t.weightsSum(Math.round(totalWeight))}${weightOk ? ` ${t.weightOk}` : weightError ? ` ${t.weightError}` : ""}`
                      : t.weightsMustBe100}
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
                        ? DT.red
                        : weightOk
                          ? DT.green
                          : DT.border,
                    }}
                    placeholder={t.placeholderZero}
                  />
                </td>
              ))}
            </tr>

            {/* Contributions */}
            <tr style={{ background: "#fef3c7" }}>
              <td style={{ ...labelCell, background: "#fde68a" }}>
                {t.contribution}
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
                      color: DT.amber,
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
          background: DT.surfaceAlt,
          border: `1px solid ${DT.border}`,
          color: DT.blue,
          cursor: "pointer",
          fontSize: 13,
          padding: "6px 14px",
          borderRadius: 6,
          fontFamily: "inherit",
          fontWeight: 500,
        }}
      >
        {t.addSection2Row}
      </button>

      {/* Controls Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginTop: 20,
          marginBottom: 20,
          padding: "16px",
          background: DT.surfaceAlt,
          borderRadius: 10,
          border: `1px solid ${DT.border}`,
        }}
      >
        <div
          style={{
            background: DT.surface,
            borderRadius: 8,
            padding: "12px 16px",
            border: `1px solid ${DT.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: DT.textMuted,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>⚙️</span>
            {t.scaleFactor}
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
          <div style={{ fontSize: 10, color: DT.textMuted, marginTop: 4 }}>
            {t.scaleFactorHint}
          </div>
        </div>

        <div
          style={{
            background: DT.surface,
            borderRadius: 8,
            padding: "12px 16px",
            border: `1px solid ${DT.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: DT.textMuted,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>🔄</span>
            {t.roundTo}
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
            <option value="0">{t.noRounding}</option>
            {ROUND_OPTIONS.slice(1).map((n) => (
              <option key={n} value={String(n)}>
                {t.nearest(n)}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 10, color: DT.textMuted, marginTop: 4 }}>
            {t.roundingHint}
          </div>
        </div>
      </div>

      {/* KPI summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          padding: "16px",
          background: DT.surfaceAlt,
          borderRadius: 10,
          border: `1px solid ${DT.border}`,
        }}
      >
        <KpiCard
          label={t.netMeterPrice}
          value={
            netPricePerMeter
              ? `${fmt(netPricePerMeter)} ${t.sarUnit}`
              : weightError
                ? t.weightsMustEqual
                : "—"
          }
          accent={DT.blue}
          icon="📊"
        />
        <KpiCard
          label={t.totalWeight}
          value={
            totalWeight
              ? `${fmt(totalWeight, 0)}%${weightOk ? ` ${t.weightOk}` : ""}`
              : "—"
          }
          accent={weightOk ? DT.green : weightError ? DT.red : "#7c3aed"}
          icon="⚖️"
        />
        <KpiCard
          label={t.totalPropertyValue}
          value={
            subjectArea && netPricePerMeter
              ? `${fmt(totalPropertyValue, 0)} ${t.sarTotal}`
              : t.enterAreaFirst
          }
          accent={DT.green}
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
        background: DT.surface,
        borderRadius: 8,
        padding: "12px 16px",
        border: `1px solid ${DT.border}`,
        borderRightWidth: 4,
        borderRightColor: accent,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: DT.textMuted,
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

  section1Rows?: { title: string; colAdj: string[] }[];
  onSection1RowsChange?: (rows: { title: string; colAdj: string[] }[]) => void;

  settlementNotes?: string;
  onSettlementNotesChange?: (v: string) => void;
};

export function SettlementComparison({
  useLabel,
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
  // ── language from context ──────────────────────────────────────────────────
  const langContext = useContext(LanguageContext);
  const lang: Lang = langContext?.language === "en" ? "en" : "ar";
  const isRtl = lang === "ar";
  const t = SC[lang];

  const n = Math.max(comparisonRows.length, 1);

  // Default useLabel per language
  const resolvedUseLabel = useLabel ?? (lang === "ar" ? "عام" : "General");

  const [localWeights, setLocalWeights] = useState<string[]>([]);
  const weights = settlementWeights ?? localWeights;
  const handleWeightsChange = onSettlementWeightsChange ?? setLocalWeights;

  const defaultSection1 = DEFAULT_SECTION1_TITLES[lang].map((title) => ({
    title,
    colAdj: Array(n).fill(""),
  }));
  const [localSection1, setLocalSection1] = useState(defaultSection1);
  const section1Rows =
    externalSection1Rows && externalSection1Rows.length > 0
      ? externalSection1Rows
      : localSection1;
  const handleSection1Change = onSection1RowsChange ?? setLocalSection1;

  const section2Rows: SettlementSection2Row[] = (() => {
    if (settlementRows.length > 0) return settlementRows as any;
    return DEFAULT_SECTION2_TITLES[lang].map((title) => ({
      inReport: true,
      title,
      valueM: "",
      cols: Array(n).fill(""),
      colAdj: Array(n).fill(""),
    }));
  })();

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
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
          background: `linear-gradient(135deg, ${DT.blue} 0%, #1558a0 100%)`,
          borderRadius: 8,
          color: "#fff",
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{t.headerTitle}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
            {t.headerSubtitle(
              resolvedUseLabel,
              comparisonRows.length,
              subjectArea || undefined,
            )}
          </div>
        </div>
        <div style={{ fontSize: 24, opacity: 0.7 }}>🏘</div>
      </div>

      {/* Part 1 */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel number={t.sectionLabel1} title={t.sectionLabel1Title} />
        <ComparisonPropertiesTable
          rows={comparisonRows}
          onChange={onComparisonRowsChange}
          lang={lang}
        />
      </div>

      <div style={{ borderTop: `2px dashed ${DT.border}`, margin: "20px 0" }} />

      {/* Part 2 */}
      <div style={{ marginBottom: 20 }}>
        <SectionLabel number={t.sectionLabel2} title={t.sectionLabel2Title} />
        <p
          style={{
            fontSize: 12,
            color: DT.textMuted,
            margin: "0 0 12px",
            lineHeight: 1.6,
          }}
        >
          {t.adjustmentHint}
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
          lang={lang}
        />
      </div>

      {/* Notes */}
      <div style={{ marginTop: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: DT.textMuted,
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          {t.settlementNotes}
        </label>
        <textarea
          value={settlementNotes}
          onChange={(e) => onSettlementNotesChange?.(e.target.value)}
          rows={4}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: `1px solid ${DT.border}`,
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical" as const,
            boxSizing: "border-box" as const,
            color: DT.text,
            outline: "none",
          }}
          placeholder={t.settlementNotesPlaceholder}
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
          background: DT.blue,
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
      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: DT.text }}>
        {title}
      </h4>
    </div>
  );
}
