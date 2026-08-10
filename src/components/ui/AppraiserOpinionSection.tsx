"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MethodKey = "market" | "cost" | "income" | "rvl" | "dcf" | "rental";

export type MethodState = {
  weight: string;
  role: string;
  inReport: boolean;
};

/** All the fields this section owns — stored inside ev.appraiser in the parent */
export type AppraiserData = {
  // method weights / roles / report flags
  marketWeight: string;
  marketRole: string;
  inMarket: boolean;
  costWeight: string;
  costRole: string;
  inCost: boolean;
  incomeWeight: string;
  incomeRole: string;
  inIncome: boolean;
  rvlWeight: string;
  rvlRole: string;
  inRvl: boolean;
  dcfWeight: string;
  dcfRole: string;
  inDcf: boolean;
  rentalWeight: string;
  rentalRole: string;
  inRental: boolean;

  // final value controls
  totalValue: string;
  discountPct: string;
  upcountPct: string;
  roundPrice: string;

  // dates
  evalDate: string;
  completedDate: string;
  reportDate: string;

  // report options
  isDraft: boolean;
  nearProposal: boolean;
  nearPlace: boolean;
  isDocs: boolean;
  photoCount: string;

  // text fields
  appraiserDesc: string;
  appraiserNotes: string;
  internalNotes: string;
  documents: string;
  justifications: string;

  // computed read-only (written by this component so parent can save them)
  finalAssetValue: string;
};

export function emptyAppraiserData(): AppraiserData {
  return {
    marketWeight: "0",
    marketRole: "أساسي",
    inMarket: false,
    costWeight: "0",
    costRole: "أساسي",
    inCost: false,
    incomeWeight: "0",
    incomeRole: "أساسي",
    inIncome: false,
    rvlWeight: "0",
    rvlRole: "أساسي",
    inRvl: false,
    dcfWeight: "0",
    dcfRole: "أساسي",
    inDcf: false,
    rentalWeight: "0",
    rentalRole: "أساسي",
    inRental: false,
    totalValue: "",
    discountPct: "",
    upcountPct: "",
    roundPrice: "0",
    evalDate: "",
    completedDate: "",
    reportDate: "",
    isDraft: false,
    nearProposal: false,
    nearPlace: false,
    isDocs: false,
    photoCount: "",
    appraiserDesc: "",
    appraiserNotes: "",
    internalNotes: "",
    documents: "",
    justifications: "",
    finalAssetValue: "",
  };
}

export type MethodTotals = {
  market: number;
  cost: number;
  income: number;
  rvl: number;
  dcf: number;
  rental: number;
};

export type AppraiserOpinionSectionProps = {
  lang?: "ar" | "en";
  /** Computed totals fed in from parent (settlement net meter × area, replacement cost, etc.) */
  methodTotals: MethodTotals;
  /** Current value of this section's data slice */
  data: AppraiserData;
  /** Called on every change — parent merges this into its ev state */
  onChange: (updated: AppraiserData) => void;
};

// ─── Design System (mirrors parent DS object) ─────────────────────────────────

const DS = {
  primary: "#0e7490",
  primaryLight: "#f0f9ff",
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  textLight: "#94a3b8",
  green: "#059669",
  red: "#dc2626",
  radius: { sm: 6, md: 10, lg: 14, xl: 18 },
} as const;

// ─── Style constants ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: `1px solid ${DS.border}`,
  borderRadius: DS.radius.md,
  fontSize: 13,
  color: DS.text,
  background: DS.surface,
  boxSizing: "border-box",
  fontFamily: "inherit",
  outline: "none",
};

const disabledStyle: React.CSSProperties = {
  ...inputStyle,
  background: DS.surfaceAlt,
  color: DS.textMuted,
};

const thS: React.CSSProperties = {
  background: DS.surfaceAlt,
  border: `1px solid ${DS.border}`,
  padding: "8px 10px",
  fontWeight: 700,
  whiteSpace: "nowrap",
  textAlign: "center",
  fontSize: 10,
  color: DS.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdS: React.CSSProperties = {
  border: `1px solid ${DS.border}`,
  padding: "6px 8px",
  verticalAlign: "middle",
  fontSize: 13,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUND_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "بدون تقريب" },
  { value: "0.5", label: "0.5" },
  { value: "1", label: "1" },
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "500", label: "500" },
  { value: "1000", label: "1000" },
  { value: "5000", label: "5000" },
  { value: "10000", label: "10000" },
  { value: "50000", label: "50000" },
  { value: "100000", label: "100000" },
  { value: "1000000", label: "1000000" },
];

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "أساسي", label: "أساسي" },
  { value: "مساعد", label: "مساعد" },
  { value: "لم يستخدم", label: "لم يستخدم" },
  { value: "مستبعد", label: "مستبعد" },
];

type VmMethodDef = {
  key: MethodKey;
  labelAr: string;
  labelEn: string;
  weightField: keyof AppraiserData;
  roleField: keyof AppraiserData;
  inReportField: keyof AppraiserData;
};

const VM_METHODS: VmMethodDef[] = [
  {
    key: "market",
    labelAr: "المقارنة",
    labelEn: "Comparison",
    weightField: "marketWeight",
    roleField: "marketRole",
    inReportField: "inMarket",
  },
  {
    key: "cost",
    labelAr: "تكلفة الإحلال",
    labelEn: "Replacement Cost",
    weightField: "costWeight",
    roleField: "costRole",
    inReportField: "inCost",
  },
  {
    key: "income",
    labelAr: "الاستثمار",
    labelEn: "Investment",
    weightField: "incomeWeight",
    roleField: "incomeRole",
    inReportField: "inIncome",
  },
  {
    key: "rvl",
    labelAr: "القيمة المتبقية",
    labelEn: "Residual Value",
    weightField: "rvlWeight",
    roleField: "rvlRole",
    inReportField: "inRvl",
  },
  {
    key: "dcf",
    labelAr: "التدفقات النقدية المخصومة (DCF)",
    labelEn: "DCF",
    weightField: "dcfWeight",
    roleField: "dcfRole",
    inReportField: "inDcf",
  },
  {
    key: "rental",
    labelAr: "القيمة الإيجارية",
    labelEn: "Rental Value",
    weightField: "rentalWeight",
    roleField: "rentalRole",
    inReportField: "inRental",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundValue(value: number, roundTo: string): number {
  const rt = parseFloat(roundTo);
  if (!rt) return value;
  return Math.round(value / rt) * rt;
}

function fmtNumber(n: number, locale: string): string {
  if (!n || n <= 0) return "";
  return n.toLocaleString(locale, { maximumFractionDigits: 2 });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 10,
        color: DS.textMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 5,
      }}
    >
      {children}
    </label>
  );
}

function FieldWrap({
  label,
  full,
  children,
}: {
  label: React.ReactNode;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AppraiserOpinionSection({
  lang = "ar",
  methodTotals,
  data,
  onChange,
}: AppraiserOpinionSectionProps) {
  const isRtl = lang === "ar";
  const locale = "en-US";
  const fmt = (n: number) => fmtNumber(n, locale);

  // Single updater: merges a partial into data and calls onChange once
  const set = useCallback(
    (partial: Partial<AppraiserData>) => {
      onChange({ ...data, ...partial });
    },
    [data, onChange],
  );

  // ── Derived calculations ───────────────────────────────────────────────────

  const computedWeightedTotal: number = VM_METHODS.reduce((sum, m) => {
    const raw = methodTotals[m.key] ?? 0;
    const w = parseFloat(data[m.weightField] as string) || 0;
    return sum + raw * (w / 100);
  }, 0);

  const baseForFinal =
    data.totalValue !== ""
      ? parseFloat(data.totalValue) || 0
      : computedWeightedTotal;

  const disc = parseFloat(data.discountPct) || 0;
  const up = parseFloat(data.upcountPct) || 0;
  let adjusted = baseForFinal;
  if (disc > 0) adjusted *= 1 - disc / 100;
  if (up > 0) adjusted *= 1 + up / 100;

  const finalValue = roundValue(adjusted, data.roundPrice);

  // Keep finalAssetValue in sync so parent saves the computed number
  const finalValueStr = finalValue > 0 ? String(finalValue) : "";
  useEffect(() => {
    if (data.finalAssetValue !== finalValueStr) {
      set({ finalAssetValue: finalValueStr });
    }
  }, [finalValueStr, data.finalAssetValue, set]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div dir={isRtl ? "rtl" : "ltr"} style={{ color: DS.text }}>
      {/* ── Valuation Methods Summary Table ── */}
      <div
        style={{
          overflowX: "auto",
          borderRadius: DS.radius.md,
          border: `1px solid ${DS.border}`,
          marginBottom: 20,
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr>
              {(isRtl
                ? [
                    "الطريقة",
                    "المجموع",
                    "النسبة الموزونة",
                    "الإجمالي",
                    "نمط الاستخدام",
                    "عرض بالتقرير",
                  ]
                : [
                    "Method",
                    "Total",
                    "Weighted %",
                    "Weighted Total",
                    "Usage Pattern",
                    "Show in Report",
                  ]
              ).map((h, i) => (
                <th
                  key={i}
                  style={{
                    ...thS,
                    width: ["15%", "22%", "10%", "22%", "16%", "10%"][i],
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VM_METHODS.map((m) => {
              const raw = methodTotals[m.key] ?? 0;
              const weight = parseFloat(data[m.weightField] as string) || 0;
              const weighted = raw * (weight / 100);
              return (
                <tr key={m.key} style={{ background: DS.surface }}>
                  <td style={{ ...tdS, fontWeight: 600 }}>
                    {isRtl ? m.labelAr : m.labelEn}
                  </td>

                  {/* Total (read-only, from parent) */}
                  <td style={tdS}>
                    <input
                      type="text"
                      disabled
                      value={fmt(raw)}
                      style={{
                        ...disabledStyle,
                        textAlign: "right",
                        direction: "ltr",
                      }}
                    />
                  </td>

                  {/* Weight % (editable) */}
                  <td style={tdS}>
                    <input
                      type="text"
                      dir="ltr"
                      value={data[m.weightField] as string}
                      onChange={(e) => set({ [m.weightField]: e.target.value })}
                      style={{ ...inputStyle, textAlign: "center" }}
                    />
                  </td>

                  {/* Weighted total (read-only, computed) */}
                  <td style={tdS}>
                    <input
                      type="text"
                      disabled
                      value={fmt(weighted)}
                      style={{
                        ...disabledStyle,
                        textAlign: "right",
                        direction: "ltr",
                      }}
                    />
                  </td>

                  {/* Role dropdown */}
                  <td style={tdS}>
                    <select
                      value={data[m.roleField] as string}
                      onChange={(e) => set({ [m.roleField]: e.target.value })}
                      style={inputStyle}
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Show in report checkbox */}
                  <td style={{ ...tdS, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={data[m.inReportField] as boolean}
                      onChange={(e) =>
                        set({ [m.inReportField]: e.target.checked })
                      }
                      style={{ accentColor: DS.primary, width: 16, height: 16 }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Divider (matches reference) ── */}
      <hr
        style={{
          border: "none",
          borderTop: "2px solid #9a9a9a",
          margin: "0 0 20px",
        }}
      />

      {/* ── Final Value Grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {/* القيمة الإجمالية */}
        <FieldWrap label={isRtl ? "القيمة الإجمالية" : "Total Value"}>
          <input
            type="text"
            dir="ltr"
            value={data.totalValue}
            onChange={(e) => set({ totalValue: e.target.value })}
            placeholder={fmt(computedWeightedTotal) || "0"}
            style={{ ...inputStyle, textAlign: "right" }}
          />
        </FieldWrap>

        {/* نسبة الخصم */}
        <FieldWrap label={isRtl ? "نسبة الخصم" : "Discount %"}>
          <input
            type="text"
            dir="ltr"
            value={data.discountPct}
            onChange={(e) => set({ discountPct: e.target.value })}
            placeholder="0"
            style={{ ...inputStyle, textAlign: "right" }}
          />
          <p style={{ fontSize: 10, color: DS.textLight, margin: "3px 0 0" }}>
            {isRtl ? "في حال البيع القسري" : "For forced sale scenarios"}
          </p>
        </FieldWrap>

        {/* نسبة الزيادة */}
        <FieldWrap label={isRtl ? "نسبة الزيادة" : "Increase %"}>
          <input
            type="text"
            dir="ltr"
            value={data.upcountPct}
            onChange={(e) => set({ upcountPct: e.target.value })}
            placeholder="0"
            style={{ ...inputStyle, textAlign: "right" }}
          />
          <p style={{ fontSize: 10, color: DS.textLight, margin: "3px 0 0" }}>
            {isRtl
              ? "عوضًا عن النزع أو وضع اليد المؤقت"
              : "In lieu of expropriation or temporary seizure"}
          </p>
        </FieldWrap>

        {/* معدل التقريب */}
        <FieldWrap label={isRtl ? "معدل التقريب" : "Rounding"}>
          <select
            value={data.roundPrice}
            onChange={(e) => set({ roundPrice: e.target.value })}
            style={inputStyle}
          >
            {ROUND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldWrap>

        {/* القيمة النهائية للأصل — full width, prominent */}
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel>
            {isRtl ? "القيمة النهائية للأصل" : "Final Asset Value"}
          </FieldLabel>
          <input
            type="text"
            disabled
            value={finalValue > 0 ? fmt(finalValue) : ""}
            style={{
              ...disabledStyle,
              fontSize: 15,
              fontWeight: 700,
              color: DS.primary,
              textAlign: "right",
              direction: "ltr",
              border: `2px solid ${DS.primary}30`,
              background: DS.primaryLight,
            }}
          />
        </div>

        {/* نسبة التباين -10% */}
        <FieldWrap
          label={
            <span>
              {isRtl ? "نسبة التباين" : "Variance"} (
              <span style={{ color: DS.red }}>-10%</span>)
            </span>
          }
        >
          <input
            type="text"
            disabled
            value={finalValue > 0 ? fmt(finalValue * 0.9) : ""}
            style={{ ...disabledStyle, textAlign: "right", direction: "ltr" }}
          />
        </FieldWrap>

        {/* نسبة التباين +10% */}
        <FieldWrap
          label={
            <span>
              {isRtl ? "نسبة التباين" : "Variance"} (
              <span style={{ color: DS.green }}>+10%</span>)
            </span>
          }
        >
          <input
            type="text"
            disabled
            value={finalValue > 0 ? fmt(finalValue * 1.1) : ""}
            style={{ ...disabledStyle, textAlign: "right", direction: "ltr" }}
          />
        </FieldWrap>
      </div>

      {/* ── Dates ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <FieldWrap label={isRtl ? "تاريخ المعاينة" : "Inspection Date"}>
          <input
            type="date"
            value={data.evalDate}
            onChange={(e) => set({ evalDate: e.target.value })}
            style={inputStyle}
          />
        </FieldWrap>
        <FieldWrap label={isRtl ? "تاريخ التقييم" : "Valuation Date"}>
          <input
            type="date"
            value={data.completedDate}
            onChange={(e) => set({ completedDate: e.target.value })}
            style={inputStyle}
          />
        </FieldWrap>
        <FieldWrap label={isRtl ? "تاريخ التقرير" : "Report Date"}>
          <input
            type="date"
            value={data.reportDate}
            onChange={(e) => set({ reportDate: e.target.value })}
            style={inputStyle}
          />
        </FieldWrap>
      </div>

      {/* ── Report Options ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 10,
          marginBottom: 20,
          padding: "14px 16px",
          background: DS.surfaceAlt,
          border: `1px solid ${DS.border}`,
          borderRadius: DS.radius.md,
        }}
      >
        {(
          [
            { field: "isDraft" as const, labelAr: "مسودة", labelEn: "Draft" },
            {
              field: "nearProposal" as const,
              labelAr: "عرض المقارنات القريبة على الخريطة",
              labelEn: "Show nearby comparisons on map",
            },
            {
              field: "nearPlace" as const,
              labelAr: "عرض نقاط الجذب",
              labelEn: "Show attractions",
            },
            {
              field: "isDocs" as const,
              labelAr: "عرض المستندات الرسمية",
              labelEn: "Show official documents",
            },
          ] as {
            field: keyof AppraiserData;
            labelAr: string;
            labelEn: string;
          }[]
        ).map(({ field, labelAr, labelEn }) => (
          <label
            key={field}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              cursor: "pointer",
              fontSize: 13,
              color: DS.text,
              padding: "5px 0",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={data[field] as boolean}
              onChange={(e) => set({ [field]: e.target.checked })}
              style={{
                accentColor: DS.primary,
                width: 15,
                height: 15,
                flexShrink: 0,
              }}
            />
            {isRtl ? labelAr : labelEn}
          </label>
        ))}

        {/* عدد الصور */}
        <div>
          <FieldLabel>
            {isRtl ? "عدد الصور بالتقرير" : "Photo count in report"}{" "}
            <sub style={{ color: DS.red }}>
              {isRtl ? "الإفتراضي (12)" : "default (12)"}
            </sub>
          </FieldLabel>
          <input
            type="text"
            dir="ltr"
            value={data.photoCount}
            onChange={(e) => set({ photoCount: e.target.value })}
            placeholder="12"
            style={{ ...inputStyle, maxWidth: 120 }}
          />
        </div>
      </div>

      {/* ── Appraiser Description ── */}
      <div style={{ marginBottom: 14 }}>
        <FieldLabel>
          {isRtl
            ? "وصف المقيم ورأيه حول الأصل:"
            : "Appraiser description & opinion:"}
        </FieldLabel>
        <textarea
          rows={4}
          value={data.appraiserDesc}
          onChange={(e) => set({ appraiserDesc: e.target.value })}
          style={{ ...inputStyle, resize: "vertical", minHeight: 88 }}
        />
      </div>

      {/* ── Notes / Deficiencies ── */}
      <div style={{ marginBottom: 14 }}>
        <FieldLabel>
          {isRtl ? "الملاحظات أو النواقص:" : "Notes or deficiencies:"}
        </FieldLabel>
        <textarea
          rows={3}
          value={data.appraiserNotes}
          onChange={(e) => set({ appraiserNotes: e.target.value })}
          style={{ ...inputStyle, resize: "vertical", minHeight: 66 }}
        />
      </div>

      {/* ── Internal Notes (amber tinted, not in report) ── */}
      <div
        style={{
          marginBottom: 14,
          padding: "12px 14px",
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: DS.radius.md,
        }}
      >
        <FieldLabel>{isRtl ? "ملاحظات داخلية:" : "Internal notes:"}</FieldLabel>
        <textarea
          rows={3}
          value={data.internalNotes}
          onChange={(e) => set({ internalNotes: e.target.value })}
          style={{
            ...inputStyle,
            resize: "vertical",
            minHeight: 66,
            background: "#fffff8",
          }}
        />
      </div>

      {/* ── Documents Received ── */}
      <div style={{ marginBottom: 14 }}>
        <FieldLabel>
          {isRtl
            ? "المستندات المستلمة من العميل:"
            : "Documents received from client:"}
        </FieldLabel>
        <textarea
          rows={2}
          value={data.documents}
          onChange={(e) => set({ documents: e.target.value })}
          placeholder={
            isRtl
              ? "اختر أو اكتب المستند المستلم من العميل"
              : "Enter or select documents received"
          }
          style={{ ...inputStyle, resize: "vertical", minHeight: 44 }}
        />
      </div>

      {/* ── Justifications ── */}
      <div style={{ marginBottom: 14 }}>
        <FieldLabel>
          {isRtl
            ? "مبررات استخدام اسلوب وطريقة التقييم:"
            : "Justifications for valuation method:"}
        </FieldLabel>
        <textarea
          rows={2}
          value={data.justifications}
          onChange={(e) => set({ justifications: e.target.value })}
          placeholder={isRtl ? "اختر أو اكتب المبرر" : "Enter justification"}
          style={{ ...inputStyle, resize: "vertical", minHeight: 44 }}
        />
      </div>
    </div>
  );
}
