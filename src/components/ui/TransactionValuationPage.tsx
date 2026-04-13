"use client";

import { useEffect, useState } from "react";
import { toApiUrl } from "@/lib/api-url";

// ─── constants ────────────────────────────────────────────────────────────────

const VALUATION_PURPOSES: Record<string, string> = {
  "1": "التمويل",
  "2": "الشراء",
  "3": "البيع",
  "4": "الرهن",
  "5": "محاسبة",
  "6": "إفلاس",
  "7": "استحواذ",
  "8": "التقرير المالي",
  "9": "الضرائب",
  "10": "الأغراض التأمينية",
  "11": "تقاضي",
  "12": "أغراض داخلية",
  "13": "نزع الملكية",
  "14": "نقل",
  "15": "ورث",
  "16": "اخرى",
  "17": "توزيع تركه",
  "18": "البيع القسري",
  "19": "معرفة القيمة السوقية",
  "20": "معرفة القيمة الإيجارية",
  "21": "التصفية",
  "50": "أغراض إستثمارية",
  "54": "التعويض",
};

const VALUATION_BASES: Record<string, string> = {
  "1": "القيمة السوقية",
  "2": "القيمة الاستثمارية",
  "3": "القيمة المنصفة",
  "4": "قيمة التصفية",
  "5": "القيمة التكاملية",
  "6": "الايجار السوقي",
  "7": "القيمة السوقية / قيمة الايجار السوقي",
  "8": "القيمة العادلة",
  "10": "الإدراج في القوائم المالية",
};

const OWNERSHIP_TYPES: Record<string, string> = {
  "1": "الملكية المطلقة",
  "2": "الملكية المشروطة",
  "3": "الملكية المقيدة",
  "4": "ملكية مدى الحياة",
  "5": "منفعة",
  "6": "مشاع",
  "7": "ملكية مرهونة",
};

const VALUATION_HYPOTHESES: Record<string, string> = {
  "1": "الاستخدام الحالي",
  "2": "الاستخدام الأعلى والأفضل",
  "3": "التصفية المنظمة",
  "4": "البيع القسري",
};

const WORKFLOW_STATUSES = [
  { value: "new", label: "جديدة" },
  { value: "inspection", label: "معاينة" },
  { value: "review", label: "مراجعة" },
  { value: "audit", label: "تدقيق" },
  { value: "approved", label: "معتمدة" },
  { value: "sent", label: "مرسلة" },
  { value: "cancelled", label: "ملغية" },
  { value: "pending", label: "معلقة" },
];

const IMPORTANT_LINKS = [
  { href: "https://srem.moj.gov.sa/deed-inquiry", label: "استعلام عن الصك" },
  {
    href: "https://apps.balady.gov.sa/Eservices/Inquiries/inquiry",
    label: "استعلام عن الرخصة (بلدي)",
  },
  { href: "https://umaps.balady.gov.sa/", label: "يو ماب (مخططات)" },
  {
    href: "https://mapservice.alriyadh.gov.sa/geoportal/geomap",
    label: "البوابة المكانية الرياض",
  },
  {
    href: "https://gis.qassim.gov.sa/QMENEW/",
    label: "المستكشف الجغرافي - القصيم",
  },
  { href: "https://smartmap.jeddah.gov.sa/", label: "المستكشف الجغرافي-جدة" },
  { href: "https://maps.holymakkah.gov.sa/", label: "المستكشف الجغرافي-مكة" },
  {
    href: "https://geomed.amana-md.gov.sa/madinah-explorer/#/ar",
    label: "المستكشف الجغرافي-المدينة",
  },
  {
    href: "https://srem.moj.gov.sa/transactions-info",
    label: "البورصة العقارية",
  },
  { href: "https://sa.aqar.fm/map/", label: "عقار (عروض مقارنة)" },
  { href: "https://aqarsas.sa/ulanding/", label: "عقار ساس" },
  { href: "https://qaren.ai/comparisons", label: "منصة قارن" },
  { href: "https://paseetah.com/", label: "موقع بسيطة" },
  { href: "https://earth.google.com/web/", label: "رابط قوقل ايرث" },
  {
    href: "https://eservices.rer.sa/#/title-verification",
    label: "استعلام عن صك (السجل العقاري)",
  },
  {
    href: "https://webgis.eamana.gov.sa/eexplorer/",
    label: "المستكشف الجغرافي-الشرقية",
  },
];

const PROPERTY_TYPES_OPTIONS = [
  { value: "1", label: "أرض" },
  { value: "2", label: "شقة" },
  { value: "3", label: "فيلا سكنية" },
  { value: "4", label: "عمارة" },
  { value: "5", label: "إستراحة" },
  { value: "6", label: "مزرعة" },
  { value: "7", label: "مستودع" },
  { value: "9", label: "محل تجاري" },
  { value: "10", label: "دور" },
  { value: "21", label: "أرض سكنية" },
  { value: "22", label: "أرض تجارية" },
  { value: "24", label: "فندق" },
  { value: "28", label: "مبنى تجاري" },
  { value: "67", label: "عمارة سكنية" },
];

const COMPARISON_KINDS = ["حد", "تنفيذ", "سوم", "عرض", "ايجار", "مزاد"];

const REGIONS = [
  { value: "1", label: "منطقة الرياض" },
  { value: "2", label: "منطقة مكة المكرمة" },
  { value: "3", label: "منطقة المدينة المنورة" },
  { value: "4", label: "منطقة القصيم" },
  { value: "5", label: "المنطقة الشرقية" },
  { value: "6", label: "منطقة عسير" },
  { value: "7", label: "منطقة تبوك" },
  { value: "8", label: "منطقة حائل" },
  { value: "9", label: "منطقة الحدود الشمالية" },
  { value: "10", label: "منطقة جازان" },
  { value: "11", label: "منطقة نجران" },
  { value: "12", label: "منطقة الباحة" },
  { value: "13", label: "منطقة الجوف" },
];

// ─── helper: build label→value map from templateFieldValues ──────────────────

function buildByLabel(
  templateFieldValues:
    | Record<string, { label: string; value: string }>
    | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!templateFieldValues) return map;
  Object.values(templateFieldValues).forEach((entry) => {
    if (entry?.label) map[entry.label] = entry.value ?? "";
  });
  return map;
}

function resolveRegionId(nameOrId: string): string {
  if (!nameOrId) return "";
  const match = REGIONS.find((r) => r.label === nameOrId);
  return match ? match.value : nameOrId;
}

// ─── FIX 1 & 2: Clean read-only display components ───────────────────────────
// Replaced fake-input InfoItem with clean label/value text layout.
// No input boxes, no borders — just a muted label above a plain value.

function ReadOnlyGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "16px 24px",
      }}
    >
      {children}
    </div>
  );
}

function ReadOnlyItem({
  label,
  value,
  full = false,
}: {
  label: string;
  value?: string;
  full?: boolean;
}) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <div
        style={{
          fontSize: 11,
          color: "#888",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: value ? "#1a1a1a" : "#bbb",
          fontWeight: value ? 500 : 400,
          lineHeight: 1.4,
          paddingBottom: 8,
          borderBottom: "1px solid #eee",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

// ─── shared sub-components ────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  defaultOpen = false,
  accentColor,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const headBg = accentColor ?? "#fafbfc";
  const headColor = accentColor ? "#fff" : "#222";
  return (
    <div style={styles.sectionCard}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...styles.sectionHead,
          background: headBg,
          color: headColor,
        }}
      >
        <span>{title}</span>
        <span
          style={{
            transition: "transform 0.2s",
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>
      {open && <div style={styles.sectionBody}>{children}</div>}
    </div>
  );
}

function GridFields({
  children,
  tight = false,
}: {
  children: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <div style={{ ...styles.gridFields, gap: tight ? "8px" : "14px" }}>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function Input({
  type = "text",
  readOnly = false,
  value,
  onChange,
  placeholder,
  dir,
}: {
  type?: string;
  readOnly?: boolean;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  dir?: string;
}) {
  return (
    <input
      type={type}
      readOnly={readOnly}
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      dir={dir}
      style={{ ...styles.input, background: readOnly ? "#f8f9fa" : "#fff" }}
    />
  );
}

function Textarea({
  readOnly = false,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  readOnly?: boolean;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      readOnly={readOnly}
      value={value ?? ""}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      style={{
        ...styles.input,
        resize: "vertical",
        minHeight: `${rows * 24}px`,
      }}
    />
  );
}

function Select({
  value,
  onChange,
  children,
  disabled = false,
}: {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={onChange}
      disabled={disabled}
      style={styles.input}
    >
      {children}
    </select>
  );
}

function StatusMsg({
  type,
  children,
}: {
  type: string;
  children: React.ReactNode;
}) {
  const bg =
    type === "ok" ? "#d4edda" : type === "error" ? "#f8d7da" : "#fff3cd";
  const color =
    type === "ok" ? "#155724" : type === "error" ? "#721c24" : "#856404";
  return (
    <div
      style={{
        padding: "6px 12px",
        borderRadius: 4,
        background: bg,
        color,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

// ─── comparison table ─────────────────────────────────────────────────────────

function emptyComparisonRow() {
  return {
    evalDate: "",
    propertyTypeId: "",
    comparisonKind: "حد",
    landSpace: "",
    price: "",
    total: "",
    description: "",
    roads: "",
    street: "",
    notes: "",
    services: "",
    coords: "",
  };
}

function ComparisonTable({
  rows,
  onChange,
}: {
  rows: any[];
  onChange: (rows: any[]) => void;
}) {
  const addRow = () => onChange([...rows, emptyComparisonRow()]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, val: string) => {
    onChange(
      rows.map((r, idx) => {
        if (idx !== i) return r;
        const updated = { ...r, [field]: val };
        if (field === "landSpace" || field === "price") {
          const area =
            parseFloat(field === "landSpace" ? val : r.landSpace) || 0;
          const price = parseFloat(field === "price" ? val : r.price) || 0;
          updated.total =
            area && price ? (area * price).toLocaleString("ar-SA") : "";
        }
        return updated;
      }),
    );
  };

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {[
                "التاريخ",
                "النوع",
                "نوع المقارنة",
                "المساحة",
                "سعر المتر",
                "الإجمالي",
                "البَعد",
                "عدد الشوارع",
                "عرض الشارع",
                "المصدر",
                "ملاحظات",
                "الإحداثيات",
                "حذف",
              ].map((h) => (
                <th key={h} style={styles.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={styles.td}>
                  <input
                    type="date"
                    value={row.evalDate}
                    onChange={(e) => updateRow(i, "evalDate", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <select
                    value={row.propertyTypeId}
                    onChange={(e) =>
                      updateRow(i, "propertyTypeId", e.target.value)
                    }
                    style={styles.cellInput}
                  >
                    <option value="" disabled>
                      نوع
                    </option>
                    {PROPERTY_TYPES_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={styles.td}>
                  <select
                    value={row.comparisonKind}
                    onChange={(e) =>
                      updateRow(i, "comparisonKind", e.target.value)
                    }
                    style={styles.cellInput}
                  >
                    {COMPARISON_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={styles.td}>
                  <input
                    dir="ltr"
                    value={row.landSpace}
                    onChange={(e) => updateRow(i, "landSpace", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    dir="ltr"
                    value={row.price}
                    onChange={(e) => updateRow(i, "price", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    dir="ltr"
                    value={row.total}
                    readOnly
                    style={{ ...styles.cellInput, background: "#f0f0f0" }}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    value={row.description}
                    onChange={(e) =>
                      updateRow(i, "description", e.target.value)
                    }
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    value={row.roads}
                    onChange={(e) => updateRow(i, "roads", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    value={row.street}
                    onChange={(e) => updateRow(i, "street", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    value={row.notes}
                    onChange={(e) => updateRow(i, "notes", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    value={row.services}
                    onChange={(e) => updateRow(i, "services", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    placeholder="lat,lng"
                    value={row.coords}
                    onChange={(e) => updateRow(i, "coords", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    style={styles.iconBtn}
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addRow} style={styles.linkBtn}>
        ＋ مقارنة جديدة
      </button>
    </div>
  );
}

// ─── settlement table ─────────────────────────────────────────────────────────

function emptySettlementRow() {
  return {
    inReport: true,
    title: "",
    valueM: "",
    cols: ["", "", ""],
    colAdj: ["", "", ""],
  };
}

function SettlementTable({
  rows,
  onChange,
  bases,
  numCols,
}: {
  rows: any[];
  onChange: (rows: any[]) => void;
  bases: string[];
  numCols: number;
}) {
  const n = Math.min(numCols, 8);
  const addRow = () => onChange([...rows, emptySettlementRow()]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, val: any) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  const updateCol = (i: number, c: number, field: string, val: string) =>
    onChange(
      rows.map((r, idx) => {
        if (idx !== i) return r;
        const arr = [...(r[field] || [])];
        arr[c] = val;
        return { ...r, [field]: arr };
      }),
    );
  const colTotals = Array.from({ length: n }, (_, c) =>
    rows.reduce((sum, r) => sum + (parseFloat((r.colAdj || [])[c]) || 0), 0),
  );
  const colAfter = Array.from({ length: n }, (_, c) =>
    ((parseFloat(bases[c]) || 0) + colTotals[c]).toFixed(2),
  );

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>البند</th>
              <th style={styles.th}>محل التقييم</th>
              {Array.from({ length: n }, (_, c) => (
                <th key={c} colSpan={2} style={styles.th}>
                  المقارنة {c + 1}
                </th>
              ))}
            </tr>
            <tr>
              <th style={styles.th}>—</th>
              <th style={styles.th}>—</th>
              {Array.from({ length: n }, (_, c) => (
                <React.Fragment key={c}>
                  <th style={styles.th}>وصف</th>
                  <th style={styles.th}>تعديل</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#e8f4fd" }}>
              <td colSpan={2} style={styles.td}>
                <strong>سعر المتر</strong>
              </td>
              {Array.from({ length: n }, (_, c) => (
                <td key={c} colSpan={2} style={styles.td}>
                  <input
                    dir="ltr"
                    value={bases[c] || ""}
                    readOnly
                    style={styles.cellInput}
                  />
                </td>
              ))}
            </tr>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={styles.td}>
                  <div
                    style={{ display: "flex", gap: 4, alignItems: "center" }}
                  >
                    <input
                      type="checkbox"
                      checked={!!row.inReport}
                      onChange={(e) =>
                        updateRow(i, "inReport", e.target.checked)
                      }
                    />
                    <input
                      value={row.title}
                      onChange={(e) => updateRow(i, "title", e.target.value)}
                      placeholder="بند التسوية"
                      style={{ ...styles.cellInput, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      style={styles.iconBtn}
                    >
                      🗑
                    </button>
                  </div>
                </td>
                <td style={styles.td}>
                  <input
                    value={row.valueM}
                    onChange={(e) => updateRow(i, "valueM", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                {Array.from({ length: n }, (_, c) => (
                  <React.Fragment key={c}>
                    <td style={styles.td}>
                      <input
                        value={(row.cols || [])[c] || ""}
                        onChange={(e) =>
                          updateCol(i, c, "cols", e.target.value)
                        }
                        style={styles.cellInput}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        dir="ltr"
                        value={(row.colAdj || [])[c] || ""}
                        onChange={(e) =>
                          updateCol(i, c, "colAdj", e.target.value)
                        }
                        style={styles.cellInput}
                      />
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))}
            <tr style={{ background: "#f5f5f5" }}>
              <td colSpan={2} style={styles.td}>
                <strong>مجموع التسويات</strong>
              </td>
              {Array.from({ length: n }, (_, c) => (
                <td key={c} colSpan={2} style={styles.td}>
                  <input
                    dir="ltr"
                    readOnly
                    value={colTotals[c].toFixed(2)}
                    style={{ ...styles.cellInput, background: "#eee" }}
                  />
                </td>
              ))}
            </tr>
            <tr style={{ background: "#f5f5f5" }}>
              <td colSpan={2} style={styles.td}>
                <strong>سعر المقارن بعد التسوية</strong>
              </td>
              {Array.from({ length: n }, (_, c) => (
                <td key={c} colSpan={2} style={styles.td}>
                  <input
                    dir="ltr"
                    readOnly
                    value={colAfter[c]}
                    style={{ ...styles.cellInput, background: "#eee" }}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addRow} style={styles.linkBtn}>
        ＋ بند تسوية
      </button>
    </div>
  );
}

// ─── replacement table ────────────────────────────────────────────────────────

function emptyReplacementLine() {
  return {
    title: "",
    space: "",
    unitPrice: "",
    notes: "",
    useSpace: true,
    total: "",
  };
}

function ReplacementTable({
  lines,
  onChange,
}: {
  lines: any[];
  onChange: (lines: any[]) => void;
}) {
  const addLine = () => onChange([...lines, emptyReplacementLine()]);
  const removeLine = (i: number) =>
    onChange(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, val: any) =>
    onChange(
      lines.map((l, idx) => {
        if (idx !== i) return l;
        const updated = { ...l, [field]: val };
        if (field === "space" || field === "unitPrice") {
          const s = parseFloat(field === "space" ? val : l.space) || 0;
          const p = parseFloat(field === "unitPrice" ? val : l.unitPrice) || 0;
          updated.total =
            updated.useSpace && s && p ? (s * p).toFixed(2) : p.toFixed(2);
        }
        return updated;
      }),
    );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {[
              "العنوان",
              "المساحة",
              "السعر",
              "الإجمالي",
              "ملاحظات",
              "يُحتسب بالمساحة",
              "حذف",
            ].map((h) => (
              <th key={h} style={styles.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td style={styles.td}>
                <input
                  value={line.title}
                  onChange={(e) => updateLine(i, "title", e.target.value)}
                  style={styles.cellInput}
                />
              </td>
              <td style={styles.td}>
                <input
                  dir="ltr"
                  value={line.space}
                  onChange={(e) => updateLine(i, "space", e.target.value)}
                  style={styles.cellInput}
                />
              </td>
              <td style={styles.td}>
                <input
                  dir="ltr"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                  style={styles.cellInput}
                />
              </td>
              <td style={styles.td}>
                <input
                  dir="ltr"
                  readOnly
                  value={line.total || ""}
                  style={{ ...styles.cellInput, background: "#eee" }}
                />
              </td>
              <td style={styles.td}>
                <input
                  value={line.notes}
                  onChange={(e) => updateLine(i, "notes", e.target.value)}
                  style={styles.cellInput}
                />
              </td>
              <td style={styles.td}>
                <input
                  type="checkbox"
                  checked={!!line.useSpace}
                  onChange={(e) => updateLine(i, "useSpace", e.target.checked)}
                />
              </td>
              <td style={styles.td}>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  style={styles.iconBtn}
                >
                  🗑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addLine} style={styles.linkBtn}>
        ＋ بند جديد
      </button>
    </div>
  );
}

import React from "react";

// ─── empty evalData default ───────────────────────────────────────────────────

function emptyEval() {
  return {
    status: "new",
    location: {
      regionId: "",
      cityName: "",
      neighborhoodName: "",
      assetCategoryId: "",
      propertyTypeId: "",
    },
    basic: {
      propertyCode: "",
      deedNumber: "",
      deedDate: "",
      ownerName: "",
      clientName: "",
      authorizedName: "",
    },
    boundaries: {
      northBoundary: "",
      northLength: "",
      southBoundary: "",
      southLength: "",
      eastBoundary: "",
      eastLength: "",
      westBoundary: "",
      westLength: "",
    },
    finishing: {
      buildingState: "",
      floorsCount: "",
      propertyAge: "",
      finishLevel: "",
      buildQuality: "",
    },
    services: { street: "" },
    map: {
      coords: "",
      lat: "",
      lng: "",
      zoomMap: "",
      zoomAerial: "",
      zoomComparisons: "",
    },
    appraiser: {
      evalDate: "",
      completedDate: "",
      reportDate: "",
      finalAssetValue: "",
      appraiserDesc: "",
      appraiserNotes: "",
    },
    methodsMarket: {
      marketMeterPrice: "",
      marketWeightPct: "",
      marketMethodTotal: "",
      marketReason: "",
      propertyAreaMethod: "",
    },
    methodsCost: {
      costNetBuildings: "",
      costNetLandPrice: "",
      costLandBuildTotal: "",
      costReason: "",
    },
    methodsIncome: { incomeTotal: "", incomeReason: "" },
    reportItems: { standards: "", scope: "", assumptions: "", risks: "" },
    authors: {
      author1Id: "",
      author1Title: "",
      author2Id: "",
      author2Title: "",
      author3Id: "",
      author3Title: "",
      author4Id: "",
      author4Title: "",
    },
    comparisonRows: [emptyComparisonRow(), emptyComparisonRow()],
    settlementRows: [
      emptySettlementRow(),
      emptySettlementRow(),
      emptySettlementRow(),
    ],
    settlementBases: ["", "", ""],
    replacementLines: [
      emptyReplacementLine(),
      emptyReplacementLine(),
      emptyReplacementLine(),
    ],
    meterPriceLand: "",
    landSpace: "",
    replacementFields: {
      managementPct: "",
      professionalPct: "",
      utilityNetworkPct: "",
      emergencyPct: "",
      financePct: "",
      yearDev: "",
      earningsRate: "",
      buildAge: "",
      defaultAge: "",
      depreciationPct: "",
      economicPct: "",
      careerPct: "",
      maintenancePrice: "",
      finishesPrice: "",
      completionPct: "",
    },
  };
}

// ─── main page ────────────────────────────────────────────────────────────────

export function TransactionEvaluationPage({
  transactionId,
  onBack,
}: {
  transactionId: string;
  onBack: () => void;
}) {
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) {
      setLoading(false);
      setFetchError("لم يتم تحديد معرف المعاملة");
      return;
    }
    setLoading(true);
    setFetchError(null);
    fetch(toApiUrl(`/api/transactions/${transactionId}`), {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then((data) => setTx(data))
      .catch((e) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, [transactionId]);

  const [statusMsg, setStatusMsg] = useState({
    type: "ok",
    text: "تم التحميل.",
  });
  const [saving, setSaving] = useState(false);

  const [ev, setEv] = useState(emptyEval());

  const setField = (section: keyof typeof ev, field: string, val: string) =>
    setEv((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as any), [field]: val },
    }));

  useEffect(() => {
    if (!tx) return;

    const e: Record<string, any> = tx.evalData ?? {};
    const bl = buildByLabel(tx.templateFieldValues);

    const pick = (...candidates: (string | undefined)[]): string =>
      candidates.find((v) => v !== undefined && v !== "") ?? "";

    setEv({
      status: pick(e.status, "new"),
      location: {
        regionId: pick(e.regionId, resolveRegionId(bl["المنطقة"] ?? "")),
        cityName: pick(e.cityName, bl["المدينة"]),
        neighborhoodName: pick(e.neighborhoodName, bl["الحي"]),
        assetCategoryId: pick(e.assetCategoryId),
        propertyTypeId: pick(e.propertyTypeId),
      },
      basic: {
        propertyCode: pick(e.propertyCode, bl["رمز العقار"]),
        deedNumber: pick(e.deedNumber, bl["رقم الصك"]),
        deedDate: pick(e.deedDate, bl["تاريخ الصك"]),
        ownerName: pick(e.ownerName, bl["اسم المالك"]),
        clientName: pick(e.clientName, bl["اسم العميل"]),
        authorizedName: pick(e.authorizedName, bl["اسم المفوض بطلب التقييم"]),
      },
      boundaries: {
        northBoundary: pick(e.northBoundary, bl["الحد الشمالي"]),
        northLength: pick(e.northLength, bl["طول الحد الشمالي"]),
        southBoundary: pick(e.southBoundary, bl["الحد الجنوبي"]),
        southLength: pick(e.southLength, bl["طول الحد الجنوبي"]),
        eastBoundary: pick(e.eastBoundary, bl["الحد الشرقي"]),
        eastLength: pick(e.eastLength, bl["طول الحد الشرقي"]),
        westBoundary: pick(e.westBoundary, bl["الحد الغربي"]),
        westLength: pick(e.westLength, bl["طول الحد الغربي"]),
      },
      finishing: {
        buildingState: pick(e.buildingState),
        floorsCount: pick(e.floorsCount),
        propertyAge: pick(e.propertyAge),
        finishLevel: pick(e.finishLevel),
        buildQuality: pick(e.buildQuality),
      },
      services: {
        street: pick(e.street),
      },
      map: {
        coords: pick(e.coords),
        lat: pick(e.lat),
        lng: pick(e.lng),
        zoomMap: pick(e.zoomMap),
        zoomAerial: pick(e.zoomAerial),
        zoomComparisons: pick(e.zoomComparisons),
      },
      appraiser: {
        evalDate: pick(e.evalDate),
        completedDate: pick(e.completedDate),
        reportDate: pick(e.reportDate),
        finalAssetValue: pick(e.finalAssetValue),
        appraiserDesc: pick(e.appraiserDesc),
        appraiserNotes: pick(e.appraiserNotes),
      },
      methodsMarket: {
        marketMeterPrice: pick(e.marketMeterPrice),
        marketWeightPct: pick(e.marketWeightPct),
        marketMethodTotal: pick(e.marketMethodTotal),
        marketReason: pick(e.marketReason),
        propertyAreaMethod: pick(e.propertyAreaMethod),
      },
      methodsCost: {
        costNetBuildings: pick(e.costNetBuildings),
        costNetLandPrice: pick(e.costNetLandPrice),
        costLandBuildTotal: pick(e.costLandBuildTotal),
        costReason: pick(e.costReason),
      },
      methodsIncome: {
        incomeTotal: pick(e.incomeTotal),
        incomeReason: pick(e.incomeReason),
      },
      reportItems: {
        standards: pick(e.standards),
        scope: pick(e.scope),
        assumptions: pick(e.assumptions),
        risks: pick(e.risks),
      },
      authors: {
        author1Id: pick(e.author1Id),
        author1Title: pick(e.author1Title),
        author2Id: pick(e.author2Id),
        author2Title: pick(e.author2Title),
        author3Id: pick(e.author3Id),
        author3Title: pick(e.author3Title),
        author4Id: pick(e.author4Id),
        author4Title: pick(e.author4Title),
      },
      comparisonRows: e.comparisonRows?.length
        ? e.comparisonRows
        : [emptyComparisonRow(), emptyComparisonRow()],
      settlementRows: e.settlementRows?.length
        ? e.settlementRows
        : [emptySettlementRow(), emptySettlementRow(), emptySettlementRow()],
      settlementBases: e.settlementBases?.length
        ? e.settlementBases
        : ["", "", ""],
      replacementLines: e.replacementLines?.length
        ? e.replacementLines
        : [
            emptyReplacementLine(),
            emptyReplacementLine(),
            emptyReplacementLine(),
          ],
      meterPriceLand: pick(e.meterPriceLand),
      landSpace: pick(e.landSpace),
      replacementFields: {
        managementPct: pick(e.managementPct),
        professionalPct: pick(e.professionalPct),
        utilityNetworkPct: pick(e.utilityNetworkPct),
        emergencyPct: pick(e.emergencyPct),
        financePct: pick(e.financePct),
        yearDev: pick(e.yearDev),
        earningsRate: pick(e.earningsRate),
        buildAge: pick(e.buildAge),
        defaultAge: pick(e.defaultAge),
        depreciationPct: pick(e.depreciationPct),
        economicPct: pick(e.economicPct),
        careerPct: pick(e.careerPct),
        maintenancePrice: pick(e.maintenancePrice),
        finishesPrice: pick(e.finishesPrice),
        completionPct: pick(e.completionPct),
      },
    });
  }, [tx]);

  const [settlementNumCols, setSettlementNumCols] = useState(3);
  const [settlementNotes, setSettlementNotes] = useState("");
  const [activeVmTab, setActiveVmTab] = useState("vm-m");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const VM_TABS = [
    { id: "vm-m", label: "المقارنة" },
    { id: "vm-c", label: "تكلفة الإحلال" },
    { id: "vm-i", label: "الاستثمار" },
    { id: "vm-r", label: "القيمة المتبقية" },
    { id: "vm-d", label: "DCF" },
    { id: "vm-e", label: "القيمة الإيجارية" },
  ];

  const weightedAvg = (() => {
    const vals = ev.settlementBases
      .slice(0, settlementNumCols)
      .map((b) => parseFloat(b) || 0)
      .filter((v) => v > 0);
    return vals.length
      ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
      : "0.00";
  })();
  const landValue = (
    (parseFloat(ev.meterPriceLand) || 0) * (parseFloat(ev.landSpace) || 0)
  ).toFixed(2);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg({ type: "info", text: "جاري الحفظ..." });
    try {
      const evalData = {
        status: ev.status,
        ...ev.location,
        ...ev.basic,
        ...ev.boundaries,
        ...ev.finishing,
        ...ev.services,
        ...ev.map,
        ...ev.appraiser,
        ...ev.methodsMarket,
        ...ev.methodsCost,
        ...ev.methodsIncome,
        ...ev.reportItems,
        ...ev.authors,
        comparisonRows: ev.comparisonRows,
        settlementRows: ev.settlementRows,
        settlementBases: ev.settlementBases,
        replacementLines: ev.replacementLines,
        meterPriceLand: ev.meterPriceLand,
        landSpace: ev.landSpace,
        ...ev.replacementFields,
      };

      const res = await fetch(toApiUrl(`/api/transactions/${transactionId}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evalData }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const updated = await res.json();
      setTx(updated);
      setStatusMsg({ type: "ok", text: "✓ تم الحفظ بنجاح" });
    } catch {
      setStatusMsg({
        type: "error",
        text: "✗ فشل الحفظ. يرجى المحاولة مجدداً.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div
        dir="rtl"
        style={{
          ...styles.shell,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 16, color: "#555" }}>
          جاري تحميل بيانات المعاملة...
        </div>
      </div>
    );
  if (fetchError)
    return (
      <div
        dir="rtl"
        style={{
          ...styles.shell,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 16, color: "#c00" }}>
          خطأ في تحميل البيانات: {fetchError}
        </div>
      </div>
    );

  const bl = buildByLabel(tx?.templateFieldValues);

  return (
    <div dir="rtl" style={styles.shell}>
      {/* ── Sticky save bar ─────────────────────────────────────────────── */}
      <div style={styles.stickyBar}>
        <button type="button" onClick={onBack} style={styles.btnSecondary}>
          ← العودة
        </button>
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}
        >
          <Select
            value={ev.status}
            onChange={(e) => setEv((p) => ({ ...p, status: e.target.value }))}
          >
            {WORKFLOW_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <StatusMsg type={statusMsg.type}>{statusMsg.text}</StatusMsg>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            ...styles.btnPrimary,
            opacity: saving ? 0.7 : 1,
            minWidth: 130,
          }}
        >
          {saving ? "جاري الحفظ..." : "💾 حفظ في قاعدة البيانات"}
        </button>
        <button type="button" style={styles.btnSecondary}>
          ⬇ تحميل
        </button>
      </div>

      <h1 style={{ ...styles.pageTitle, marginTop: 8 }}>تفاصيل المعاملة</h1>

      {/* ── FIX 1: معلومات الطلب — collapsible, read-only, clean text display ── */}
      <SectionCard title="معلومات الطلب" defaultOpen={true}>
        <ReadOnlyGrid>
          <ReadOnlyItem label="الرقم المرجعي" value={transactionId} />
          <ReadOnlyItem label="رقم التكليف" value={tx?.assignmentNumber} />
          <ReadOnlyItem label="تاريخ التكليف" value={tx?.assignmentDate} />
          <ReadOnlyItem
            label="الغرض من التقييم"
            value={
              VALUATION_PURPOSES[tx?.valuationPurpose] ?? tx?.valuationPurpose
            }
          />
          <ReadOnlyItem
            label="أساس القيمة"
            value={VALUATION_BASES[tx?.valuationBasis] ?? tx?.valuationBasis}
          />
          <ReadOnlyItem
            label="نوع الملكية"
            value={OWNERSHIP_TYPES[tx?.ownershipType] ?? tx?.ownershipType}
          />
          <ReadOnlyItem
            label="فرضية التقييم"
            value={
              VALUATION_HYPOTHESES[tx?.valuationHypothesis] ??
              tx?.valuationHypothesis
            }
          />
          <ReadOnlyItem label="عدد الأصول" value="1" />
          <ReadOnlyItem label="العميل" value={tx?.clientName ?? tx?.clientId} />
          <ReadOnlyItem label="النموذج" value={tx?.templateId} />
          <ReadOnlyItem label="ملاحظات" value={tx?.intendedUse} full />
        </ReadOnlyGrid>
      </SectionCard>

      {/* important links */}
      <details style={styles.sectionCard}>
        <summary
          style={{
            ...styles.sectionHead,
            cursor: "pointer",
            listStyle: "none",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          🔗 الروابط الهامة (استعلامات ومخططات)
        </summary>
        <div style={styles.sectionBody}>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              columns: 2,
              gap: 8,
            }}
          >
            {IMPORTANT_LINKS.map((l) => (
              <li key={l.href} style={{ marginBottom: 6 }}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0066cc", fontSize: 13 }}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* asset details header + action buttons */}
      <div style={{ marginBottom: 8, marginTop: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>
          تفاصيل الأصول
        </h2>
        <div
          style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}
        >
          {[
            "📷 الصور",
            "📎 المرفقات",
            "✏️ تعديل",
            "🗺 المقارنات القريبة",
            "📌 نسخ المقارنات",
            "🖨 عرض",
            "📄 تحميل PDF",
            "💬 ملاحظات",
          ].map((btn) => (
            <button key={btn} type="button" style={styles.actionBtn}>
              {btn}
            </button>
          ))}
        </div>
      </div>

      {/* معلومات الأصل — read-only, sits with the other collapsible sections */}
      <SectionCard title="معلومات الأصل">
        <ReadOnlyGrid>
          <ReadOnlyItem label="العنوان" value={bl["العنوان"]} full />
          <ReadOnlyItem label="نوع الأصل" value={bl["نوع الأصل"]} />
          <ReadOnlyItem label="مساحة الأصل" value={bl["مساحة الأصل"]} />
          <ReadOnlyItem label="الاستخدام" value={bl["الاستخدام"]} />
          <ReadOnlyItem label="المعاين" value={bl["المعاين"]} />
          <ReadOnlyItem label="رقم التواصل" value={bl["رقم التواصل"]} />
          <ReadOnlyItem label="المراجع" value={bl["المراجع"]} />
        </ReadOnlyGrid>
      </SectionCard>

      {/* الموقع وتصنيف الأصل */}
      <SectionCard title="الموقع وتصنيف الأصل">
        <GridFields>
          <Field label="المنطقة">
            <Select
              value={ev.location.regionId}
              onChange={(e) => setField("location", "regionId", e.target.value)}
            >
              <option value="" disabled>
                الرجاء اختيار المنطقة
              </option>
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المدينة">
            <Input
              value={ev.location.cityName}
              onChange={(e) => setField("location", "cityName", e.target.value)}
              placeholder="الرجاء إدخال المدينة"
            />
          </Field>
          <Field label="الحي">
            <Input
              value={ev.location.neighborhoodName}
              onChange={(e) =>
                setField("location", "neighborhoodName", e.target.value)
              }
              placeholder="الرجاء إدخال الحي"
            />
          </Field>
          <Field label="تصنيف الأصل">
            <Select
              value={ev.location.assetCategoryId}
              onChange={(e) =>
                setField("location", "assetCategoryId", e.target.value)
              }
            >
              <option value="" disabled>
                الرجاء اختيار التصنيف
              </option>
              <option value="1">أراضي</option>
              <option value="2">مباني</option>
            </Select>
          </Field>
          <Field label="نوع الأصل">
            <Select
              value={ev.location.propertyTypeId}
              onChange={(e) =>
                setField("location", "propertyTypeId", e.target.value)
              }
            >
              <option value="" disabled>
                الرجاء اختيار نوع العقار
              </option>
              {PROPERTY_TYPES_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </GridFields>
      </SectionCard>

      {/* البيانات الأساسية */}
      <SectionCard title="البيانات الأساسية">
        <GridFields>
          <Field label="رمز العقار">
            <Input
              value={ev.basic.propertyCode}
              onChange={(e) =>
                setField("basic", "propertyCode", e.target.value)
              }
            />
          </Field>
          <Field label="اسم العميل">
            <Input
              value={ev.basic.clientName}
              onChange={(e) => setField("basic", "clientName", e.target.value)}
            />
          </Field>
          <Field label="اسم المفوض بطلب التقييم">
            <Input
              value={ev.basic.authorizedName}
              onChange={(e) =>
                setField("basic", "authorizedName", e.target.value)
              }
            />
          </Field>
          <Field label="اسم المالك">
            <Input
              value={ev.basic.ownerName}
              onChange={(e) => setField("basic", "ownerName", e.target.value)}
            />
          </Field>
          <Field label="رقم الصك">
            <Input
              value={ev.basic.deedNumber}
              onChange={(e) => setField("basic", "deedNumber", e.target.value)}
            />
          </Field>
          <Field label="تاريخ الصك">
            <Input
              value={ev.basic.deedDate}
              onChange={(e) => setField("basic", "deedDate", e.target.value)}
            />
          </Field>
        </GridFields>
      </SectionCard>

      {/* الحدود والأطوال */}
      <SectionCard title="الحدود والأطوال">
        <GridFields>
          {(
            [
              "northBoundary",
              "northLength",
              "southBoundary",
              "southLength",
              "eastBoundary",
              "eastLength",
              "westBoundary",
              "westLength",
            ] as const
          ).map((f) => {
            const labels: Record<string, string> = {
              northBoundary: "الحد الشمالي",
              northLength: "طول الحد الشمالي",
              southBoundary: "الحد الجنوبي",
              southLength: "طول الحد الجنوبي",
              eastBoundary: "الحد الشرقي",
              eastLength: "طول الحد الشرقي",
              westBoundary: "الحد الغربي",
              westLength: "طول الحد الغربي",
            };
            return (
              <Field key={f} label={labels[f]}>
                <Input
                  value={(ev.boundaries as any)[f]}
                  onChange={(e) => setField("boundaries", f, e.target.value)}
                />
              </Field>
            );
          })}
        </GridFields>
      </SectionCard>

      {/* بيانات التشطيب */}
      <SectionCard title="بيانات التشطيب">
        <GridFields>
          <Field label="حالة المبنى">
            <Select
              value={ev.finishing.buildingState}
              onChange={(e) =>
                setField("finishing", "buildingState", e.target.value)
              }
            >
              <option value="">الرجاء اختيار قيمة</option>
              <option value="10001">جديد</option>
              <option value="10002">مستخدم</option>
              <option value="10003">تحت الإنشاء</option>
              <option value="10004">اخرى</option>
            </Select>
          </Field>
          <Field label="عدد الادوار">
            <Input
              value={ev.finishing.floorsCount}
              onChange={(e) =>
                setField("finishing", "floorsCount", e.target.value)
              }
            />
          </Field>
          <Field label="عمر العقار">
            <Input
              value={ev.finishing.propertyAge}
              onChange={(e) =>
                setField("finishing", "propertyAge", e.target.value)
              }
            />
          </Field>
          <Field label="مستوى التشطيب">
            <Select
              value={ev.finishing.finishLevel}
              onChange={(e) =>
                setField("finishing", "finishLevel", e.target.value)
              }
            >
              <option value="">الرجاء اختيار قيمة</option>
              <option value="23">تشطيب فاخر</option>
              <option value="24">تشطيب متوسط</option>
              <option value="25">تشطيب عادي</option>
              <option value="10006">بدون تشطيب</option>
            </Select>
          </Field>
          <Field label="حالة البناء">
            <Select
              value={ev.finishing.buildQuality}
              onChange={(e) =>
                setField("finishing", "buildQuality", e.target.value)
              }
            >
              <option value="">الرجاء اختيار قيمة</option>
              <option value="44">ممتاز</option>
              <option value="45">جيد جداً</option>
              <option value="46">ردئ</option>
              <option value="10058">جيد</option>
            </Select>
          </Field>
        </GridFields>
      </SectionCard>

      {/* خدمات العقار */}
      <SectionCard title="خدمات العقار">
        <GridFields>
          <Field label="الشارع">
            <Input
              value={ev.services.street}
              onChange={(e) => setField("services", "street", e.target.value)}
            />
          </Field>
          {(
            [
              "electricity",
              "water",
              "phone",
              "drainage",
              "pavedStreets",
              "lighting",
              "internet",
            ] as const
          ).map((f) => {
            const labels: Record<string, string> = {
              electricity: "الكهرباء",
              water: "المياه",
              phone: "الهاتف",
              drainage: "التصريف",
              pavedStreets: "الشوارع مسفلته",
              lighting: "الإنارة",
              internet: "الإنترنت",
            };
            return (
              <div
                key={f}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <input type="checkbox" id={`svc-${f}`} />
                <label htmlFor={`svc-${f}`} style={{ fontSize: 13 }}>
                  {labels[f]}
                </label>
              </div>
            );
          })}
        </GridFields>
      </SectionCard>

      {/* الموقع على الخارطة */}
      <SectionCard title="الموقع على الخارطة">
        <GridFields>
          {(
            [
              "coords",
              "lat",
              "lng",
              "zoomMap",
              "zoomAerial",
              "zoomComparisons",
            ] as const
          ).map((f) => {
            const labels: Record<string, string> = {
              coords: "الاحداثيات",
              lat: "خط العرض",
              lng: "خط الطول",
              zoomMap: "الزوم (الخارطة)",
              zoomAerial: "الزوم (الصورة الجوية)",
              zoomComparisons: "الزوم (خريطة المقارنات)",
            };
            return (
              <Field key={f} label={labels[f]}>
                <Input
                  value={(ev.map as any)[f]}
                  onChange={(e) => setField("map", f, e.target.value)}
                />
              </Field>
            );
          })}
        </GridFields>
      </SectionCard>

      {/* ── FIX 3: المقارنة — now a proper collapsible SectionCard ── */}
      <SectionCard title="المقارنة" accentColor="#1a6fc4">
        <ComparisonTable
          rows={ev.comparisonRows}
          onChange={(rows) => setEv((p) => ({ ...p, comparisonRows: rows }))}
        />
        <div
          style={{
            margin: "20px 0 8px",
            borderTop: "2px dashed #ccc",
            paddingTop: 12,
          }}
        >
          <strong style={{ fontSize: 14 }}>جدول التسويات</strong>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={styles.fieldLabel}>عدد أعمدة المقارنات</label>
            <Input
              type="number"
              dir="ltr"
              value={String(settlementNumCols)}
              onChange={(e) =>
                setSettlementNumCols(Math.max(1, Math.min(8, +e.target.value)))
              }
            />
          </div>
        </div>
        <SettlementTable
          rows={ev.settlementRows}
          onChange={(rows) => setEv((p) => ({ ...p, settlementRows: rows }))}
          bases={ev.settlementBases}
          numCols={settlementNumCols}
        />
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={styles.kpi}>
            <span style={styles.kpiLabel}>متوسط مرجّح بعد التسوية</span>
            <div style={styles.kpiVal}>{weightedAvg}</div>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={styles.fieldLabel}>ملاحظات التسويات</label>
          <Textarea
            value={settlementNotes}
            onChange={(e) => setSettlementNotes(e.target.value)}
            rows={3}
          />
        </div>
      </SectionCard>

      {/* ── FIX 3: تكلفة الإحلال — now a proper collapsible SectionCard ── */}
      <SectionCard title="تكلفة الإحلال" accentColor="#1a6fc4">
        <GridFields tight>
          <Field label="سعر المتر للأرض">
            <Input
              dir="ltr"
              value={ev.meterPriceLand}
              onChange={(e) =>
                setEv((p) => ({ ...p, meterPriceLand: e.target.value }))
              }
            />
          </Field>
          <Field label="مساحة الأرض">
            <Input
              dir="ltr"
              value={ev.landSpace}
              onChange={(e) =>
                setEv((p) => ({ ...p, landSpace: e.target.value }))
              }
            />
          </Field>
          <Field label="قيمة الأرض (محسوبة)">
            <Input dir="ltr" value={landValue} readOnly />
          </Field>
        </GridFields>
        <div style={{ marginTop: 12 }}>
          <ReplacementTable
            lines={ev.replacementLines}
            onChange={(lines) =>
              setEv((p) => ({ ...p, replacementLines: lines }))
            }
          />
        </div>
        <GridFields tight>
          {(
            Object.keys(ev.replacementFields) as Array<
              keyof typeof ev.replacementFields
            >
          ).map((f) => {
            const labels: Record<string, string> = {
              managementPct: "نسبة الرسوم الإدارية %",
              professionalPct: "نسبة الرسوم المهنية %",
              utilityNetworkPct: "نسبة شبكة المرافق %",
              emergencyPct: "نسبة التكاليف الطارئة %",
              financePct: "نسبة التمويل %",
              yearDev: "مدة التطوير (سنوات)",
              earningsRate: "هامش ربح المطور %",
              buildAge: "عمر الأصل الفعلي",
              defaultAge: "عمر الأصل الافتراضي",
              depreciationPct: "التقادم المادي %",
              economicPct: "التقادم الاقتصادي %",
              careerPct: "التقادم الوظيفي %",
              maintenancePrice: "تكاليف الصيانة",
              finishesPrice: "تكاليف التشطيبات المتبقية",
              completionPct: "نسبة إكتمال البناء %",
            };
            return (
              <Field key={f} label={labels[f]}>
                <Input
                  dir="ltr"
                  value={ev.replacementFields[f]}
                  onChange={(e) =>
                    setEv((p) => ({
                      ...p,
                      replacementFields: {
                        ...p.replacementFields,
                        [f]: e.target.value,
                      },
                    }))
                  }
                />
              </Field>
            );
          })}
        </GridFields>
      </SectionCard>

      {/* ── FIX 3: طرق التقييم — now a proper collapsible SectionCard ── */}
      <SectionCard title="طرق التقييم">
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          {VM_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveVmTab(t.id)}
              style={{
                ...styles.vmTab,
                ...(activeVmTab === t.id ? styles.vmTabActive : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {activeVmTab === "vm-m" && (
          <GridFields tight>
            <Field label="سعر المتر (جدول)">
              <Input
                value={ev.methodsMarket.marketMeterPrice}
                onChange={(e) =>
                  setField("methodsMarket", "marketMeterPrice", e.target.value)
                }
              />
            </Field>
            <Field label="النسبة الموزونة">
              <Input
                value={ev.methodsMarket.marketWeightPct}
                onChange={(e) =>
                  setField("methodsMarket", "marketWeightPct", e.target.value)
                }
              />
            </Field>
            <Field label="مساحة العقار">
              <Input
                value={ev.methodsMarket.propertyAreaMethod}
                onChange={(e) =>
                  setField(
                    "methodsMarket",
                    "propertyAreaMethod",
                    e.target.value,
                  )
                }
              />
            </Field>
            <Field label="المجموع">
              <Input
                value={ev.methodsMarket.marketMethodTotal}
                onChange={(e) =>
                  setField("methodsMarket", "marketMethodTotal", e.target.value)
                }
              />
            </Field>
            <Field label="سبب الإستخدام" full>
              <Textarea
                value={ev.methodsMarket.marketReason}
                onChange={(e) =>
                  setField("methodsMarket", "marketReason", e.target.value)
                }
                rows={4}
              />
            </Field>
          </GridFields>
        )}
        {activeVmTab === "vm-c" && (
          <GridFields tight>
            <Field label="صافي تكلفة المباني">
              <Input
                value={ev.methodsCost.costNetBuildings}
                onChange={(e) =>
                  setField("methodsCost", "costNetBuildings", e.target.value)
                }
              />
            </Field>
            <Field label="صافي سعر الأرض">
              <Input
                value={ev.methodsCost.costNetLandPrice}
                onChange={(e) =>
                  setField("methodsCost", "costNetLandPrice", e.target.value)
                }
              />
            </Field>
            <Field label="صافي قيمة الأرض والمباني">
              <Input
                value={ev.methodsCost.costLandBuildTotal}
                onChange={(e) =>
                  setField("methodsCost", "costLandBuildTotal", e.target.value)
                }
              />
            </Field>
            <Field label="سبب الإستخدام" full>
              <Textarea
                value={ev.methodsCost.costReason}
                onChange={(e) =>
                  setField("methodsCost", "costReason", e.target.value)
                }
                rows={4}
              />
            </Field>
          </GridFields>
        )}
        {activeVmTab === "vm-i" && (
          <GridFields tight>
            <Field label="إجمالي الدخل">
              <Input
                value={ev.methodsIncome.incomeTotal}
                onChange={(e) =>
                  setField("methodsIncome", "incomeTotal", e.target.value)
                }
              />
            </Field>
            <Field label="سبب الإستخدام" full>
              <Textarea
                value={ev.methodsIncome.incomeReason}
                onChange={(e) =>
                  setField("methodsIncome", "incomeReason", e.target.value)
                }
                rows={4}
              />
            </Field>
          </GridFields>
        )}
        {(activeVmTab === "vm-r" ||
          activeVmTab === "vm-d" ||
          activeVmTab === "vm-e") && (
          <p style={{ color: "#888", fontSize: 13 }}>هذا القسم قيد التطوير.</p>
        )}
      </SectionCard>

      {/* رأي المقيم */}
      <SectionCard title="رأي المقيم">
        <GridFields>
          <Field label="تاريخ المعاينة">
            <Input
              type="date"
              value={ev.appraiser.evalDate}
              onChange={(e) =>
                setField("appraiser", "evalDate", e.target.value)
              }
            />
          </Field>
          <Field label="تاريخ التقييم">
            <Input
              type="date"
              value={ev.appraiser.completedDate}
              onChange={(e) =>
                setField("appraiser", "completedDate", e.target.value)
              }
            />
          </Field>
          <Field label="تاريخ التقرير">
            <Input
              type="date"
              value={ev.appraiser.reportDate}
              onChange={(e) =>
                setField("appraiser", "reportDate", e.target.value)
              }
            />
          </Field>
          <Field label="القيمة النهائية للأصل">
            <Input
              dir="ltr"
              value={ev.appraiser.finalAssetValue}
              onChange={(e) =>
                setField("appraiser", "finalAssetValue", e.target.value)
              }
            />
          </Field>
          <Field label="وصف المقيم ورأيه حول الأصل" full>
            <Textarea
              value={ev.appraiser.appraiserDesc}
              onChange={(e) =>
                setField("appraiser", "appraiserDesc", e.target.value)
              }
              rows={4}
            />
          </Field>
          <Field label="الملاحظات أو النواقص" full>
            <Textarea
              value={ev.appraiser.appraiserNotes}
              onChange={(e) =>
                setField("appraiser", "appraiserNotes", e.target.value)
              }
              rows={3}
            />
          </Field>
        </GridFields>
      </SectionCard>

      {/* بنود التقرير */}
      <SectionCard title="بنود التقرير">
        <GridFields>
          <Field label="معايير التقييم المتبعة" full>
            <Textarea
              value={ev.reportItems.standards}
              onChange={(e) =>
                setField("reportItems", "standards", e.target.value)
              }
              rows={3}
            />
          </Field>
          <Field label="نطاق البحث والاستقصاء" full>
            <Textarea
              value={ev.reportItems.scope}
              onChange={(e) => setField("reportItems", "scope", e.target.value)}
              rows={6}
            />
          </Field>
          <Field label="الافتراضات" full>
            <Textarea
              value={ev.reportItems.assumptions}
              onChange={(e) =>
                setField("reportItems", "assumptions", e.target.value)
              }
              rows={4}
            />
          </Field>
          <Field label="المخاطر أو عدم اليقين" full>
            <Textarea
              value={ev.reportItems.risks}
              onChange={(e) => setField("reportItems", "risks", e.target.value)}
              rows={2}
            />
          </Field>
        </GridFields>
      </SectionCard>

      {/* معدي التقرير */}
      <SectionCard title="معدي التقرير">
        <GridFields>
          {[1, 2, 3, 4].map((n) => (
            <React.Fragment key={n}>
              <Field label={`معد ${n} — معرف/اسم`}>
                <Input
                  value={(ev.authors as any)[`author${n}Id`] ?? ""}
                  onChange={(e) =>
                    setField("authors", `author${n}Id`, e.target.value)
                  }
                />
              </Field>
              <Field label={`معد ${n} — المنصب`}>
                <Input
                  value={(ev.authors as any)[`author${n}Title`] ?? ""}
                  onChange={(e) =>
                    setField("authors", `author${n}Title`, e.target.value)
                  }
                />
              </Field>
            </React.Fragment>
          ))}
        </GridFields>
      </SectionCard>

      {/* side rail */}
      <div style={styles.sideRail}>
        <button
          type="button"
          onClick={() => setDrawerOpen((o) => !o)}
          style={styles.railBtn}
          title="الملخص المالي"
        >
          💰
        </button>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={styles.railBtn}
          title="للأعلى"
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  shell: {
    fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif",
    fontSize: 14,
    color: "#222",
    background: "#f4f6f9",
    minHeight: "100vh",
    padding: "16px",
    paddingTop: 68,
    position: "relative",
  },
  stickyBar: {
    position: "fixed",
    top: 0,
    right: 0,
    left: 0,
    zIndex: 300,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 16px",
    background: "#fff",
    borderBottom: "1px solid #dde",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    flexWrap: "wrap",
  },
  pageTitle: { fontSize: 20, fontWeight: 700, margin: "0 0 14px" },
  sectionCard: {
    background: "#fff",
    border: "1px solid #dde",
    borderRadius: 6,
    marginBottom: 10,
    overflow: "hidden",
  },
  sectionHead: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "#fafbfc",
    border: "none",
    borderBottom: "1px solid #eee",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    color: "#222",
    textAlign: "right",
  },
  sectionBody: { padding: "14px 16px" },
  gridFields: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
    gap: 14,
  },
  fieldLabel: {
    display: "block",
    fontSize: 12,
    color: "#555",
    marginBottom: 4,
    fontWeight: 500,
  },
  input: {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontSize: 13,
    color: "#222",
    background: "#fff",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    marginBottom: 8,
  },
  th: {
    background: "#f0f4f8",
    border: "1px solid #ddd",
    padding: "6px 8px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  td: { border: "1px solid #ddd", padding: "4px", verticalAlign: "middle" },
  cellInput: {
    width: "100%",
    padding: "4px 6px",
    border: "1px solid #ddd",
    borderRadius: 3,
    fontSize: 12,
    background: "#fff",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#0066cc",
    cursor: "pointer",
    fontSize: 13,
    padding: "4px 0",
    textDecoration: "underline",
  },
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 4px",
    color: "#c00",
  },
  btnPrimary: {
    background: "#1a6fc4",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  btnSecondary: {
    background: "#fff",
    color: "#444",
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  actionBtn: {
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: "5px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
  },
  vmTab: {
    padding: "6px 14px",
    border: "1px solid #ccc",
    borderRadius: 4,
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    color: "#444",
  },
  vmTabActive: { background: "#1a6fc4", color: "#fff", borderColor: "#1a6fc4" },
  kpi: { background: "#f0f7ff", padding: "8px 12px", borderRadius: 4 },
  kpiLabel: { fontSize: 11, color: "#555" },
  kpiVal: { fontSize: 18, fontWeight: 700, color: "#1a6fc4" },
  sideRail: {
    position: "fixed",
    left: 0,
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    zIndex: 201,
  },
  railBtn: {
    width: 36,
    height: 36,
    background: "#1a6fc4",
    color: "#fff",
    border: "none",
    borderRadius: "0 4px 4px 0",
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
