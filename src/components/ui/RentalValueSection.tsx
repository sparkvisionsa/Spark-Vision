"use client";

/**
 * RentalValueSection
 * ────────────────────────────────────────────────────────────────────────
 * Implements the "Rental Value" (القيمة الإيجارية / أجرة المثل) valuation
 * method for the transaction evaluation wizard.
 *
 * Methodology
 * ────────────
 * Saudi valuation practice (per the Saudi Authority for Accredited Valuers
 * "Taqeem" and the International Valuation Standards adopted locally —
 * IVS 105, Market Approach) determines the fair market rent of a property
 * — referred to in Saudi practice as "أجرة المثل" (lit. "rent of the
 * equivalent") — using the RENTAL COMPARISON METHOD: the valuer collects
 * comparable lease contracts / rental listings for similar assets, derives
 * a rent-per-unit-area figure for each, adjusts each comparable for
 * differences (location, condition, lease terms, timing, etc.), and then
 * takes a weighted rent/m² figure which is applied to the subject
 * property's area to arrive at the total market rental value.
 *
 * This mirrors the same market/sales-comparison logic already used for the
 * capital value in `SettlementComparison`, applied instead to rental
 * evidence rather than sale-price evidence — this is the standard,
 * internationally-recognised way rental value is derived, and is the
 * approach expected in a Taqeem-compliant valuation report (see the
 * report's "vmRental" / "القيمة الإيجارية" method column already present
 * in the report template).
 *
 * This component is intentionally self-contained and modular: it owns its
 * own row/entry types and its own calculation helpers, so it can be
 * extended later (e.g. additional adjustment factors, income-capitalisation
 * cross-check) without touching the rest of the page.
 */

import React from "react";
import { Info } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type RentalComparable = {
  id: string;
  title: string; // brief description / address of the comparable lease
  startDate: string; // lease start date
  endDate: string; // lease end date
  rentAmount: string; // total contract/annual rent for the comparable (SAR)
  area: string; // leased area of the comparable (m²)
  adjustmentPct: string; // net adjustment %, +/- (location, condition, terms, time)
  notes: string;
  inReport: boolean; // whether this comparable is included in the weighted average
};

export type RentalEntry = {
  id: string;
  title: string; // e.g. the building/unit being valued for rental purposes
  subjectArea: string; // area (m²) the derived rent/m² is applied to
  comparables: RentalComparable[];
  notes: string;
};

// ─── Empty-state helpers ────────────────────────────────────────────────────

function cryptoRandomId(prefix: string) {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function emptyRentalComparable(): RentalComparable {
  return {
    id: cryptoRandomId("rcomp"),
    title: "",
    startDate: "",
    endDate: "",
    rentAmount: "",
    area: "",
    adjustmentPct: "",
    notes: "",
    inReport: true,
  };
}

export function emptyRentalEntry(title = ""): RentalEntry {
  return {
    id: cryptoRandomId("rental"),
    title,
    subjectArea: "",
    comparables: [],
    notes: "",
  };
}

// ─── Calculation helpers ────────────────────────────────────────────────────

function num(v: string | undefined | null): number {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

/** rent/m² for a single comparable, before adjustment */
export function comparableRentPerSqm(c: RentalComparable): number {
  const area = num(c.area);
  const rent = num(c.rentAmount);
  return area > 0 ? rent / area : 0;
}

/** rent/m² for a single comparable, after applying its net adjustment % */
export function comparableAdjustedRentPerSqm(c: RentalComparable): number {
  const base = comparableRentPerSqm(c);
  const adj = num(c.adjustmentPct) / 100;
  return base * (1 + adj);
}

/** lease period in whole months, best-effort (for display only) */
export function comparablePeriodMonths(c: RentalComparable): number | null {
  if (!c.startDate || !c.endDate) return null;
  const start = new Date(c.startDate);
  const end = new Date(c.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  return months > 0 ? months : null;
}

export type RentalEntryComputed = {
  includedCount: number;
  averageAdjustedRentPerSqm: number; // simple average of included, adjusted comparables
  totalValue: number; // averageAdjustedRentPerSqm * subjectArea
};

/**
 * Computes the derived market rent for one RentalEntry using a simple
 * average of the adjusted rent/m² across the included comparables — the
 * same weighting logic used elsewhere in this app for comparable-based
 * indicators. (Weighting can be refined later without changing callers,
 * since only this function needs to change.)
 */
export function computeRentalEntry(entry: RentalEntry): RentalEntryComputed {
  const included = (entry.comparables ?? []).filter((c) => c.inReport !== false);
  const validRents = included
    .map((c) => comparableAdjustedRentPerSqm(c))
    .filter((v) => v > 0);

  const averageAdjustedRentPerSqm =
    validRents.length > 0
      ? validRents.reduce((s, v) => s + v, 0) / validRents.length
      : 0;

  const subjectArea = num(entry.subjectArea);
  const totalValue = averageAdjustedRentPerSqm * subjectArea;

  return {
    includedCount: included.length,
    averageAdjustedRentPerSqm,
    totalValue,
  };
}

export function totalRentalValue(entries: RentalEntry[]): number {
  return (entries ?? []).reduce(
    (sum, e) => sum + computeRentalEntry(e).totalValue,
    0,
  );
}

// ─── Local styling (kept self-contained, matches the host page's design) ───

const DS = {
  primary: "#0e7490",
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  text: "#0f172a",
  textMuted: "#64748b",
  textLight: "#94a3b8",
  green: "#059669",
  red: "#dc2626",
  radius: { sm: 6, md: 10, lg: 14 },
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  border: `1px solid ${DS.border}`,
  borderRadius: DS.radius.md,
  fontSize: 13,
  color: DS.text,
  background: DS.surface,
  boxSizing: "border-box",
  fontFamily: "inherit",
  outline: "none",
};

const cellInputS: React.CSSProperties = {
  width: "100%",
  padding: "5px 8px",
  border: `1px solid ${DS.border}`,
  borderRadius: DS.radius.sm,
  fontSize: 12,
  background: DS.surface,
  boxSizing: "border-box",
  fontFamily: "inherit",
  color: DS.text,
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
  padding: "5px",
  verticalAlign: "middle",
};

const linkBtnS: React.CSSProperties = {
  background: "none",
  border: "none",
  color: DS.primary,
  cursor: "pointer",
  fontSize: 12,
  padding: "6px 0",
  fontWeight: 700,
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  gap: 4,
  marginTop: 8,
};

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
      <label
        style={{
          display: "block",
          fontSize: 11,
          color: DS.textMuted,
          marginBottom: 5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function RentalValueSection({
  lang,
  entries,
  onEntriesChange,
  defaultSubjectArea,
}: {
  lang: "ar" | "en";
  entries: RentalEntry[];
  onEntriesChange: (entries: RentalEntry[]) => void;
  /** Subject property area (m²) to prefill new entries with, e.g. from Asset Info */
  defaultSubjectArea?: string;
}) {
  const [newTitle, setNewTitle] = React.useState("");

  const addEntry = () => {
    const title = newTitle.trim();
    if (!title) return;
    const entry = emptyRentalEntry(title);
    entry.subjectArea = defaultSubjectArea ?? "";
    onEntriesChange([...(entries ?? []), entry]);
    setNewTitle("");
  };

  const removeEntry = (entryIdx: number) => {
    onEntriesChange(entries.filter((_, i) => i !== entryIdx));
  };

  const updateEntry = (entryIdx: number, patch: Partial<RentalEntry>) => {
    onEntriesChange(
      entries.map((e, i) => (i === entryIdx ? { ...e, ...patch } : e)),
    );
  };

  const addComparable = (entryIdx: number) => {
    onEntriesChange(
      entries.map((e, i) =>
        i === entryIdx
          ? { ...e, comparables: [...(e.comparables ?? []), emptyRentalComparable()] }
          : e,
      ),
    );
  };

  const updateComparable = (
    entryIdx: number,
    compIdx: number,
    patch: Partial<RentalComparable>,
  ) => {
    onEntriesChange(
      entries.map((e, i) =>
        i !== entryIdx
          ? e
          : {
              ...e,
              comparables: (e.comparables ?? []).map((c, j) =>
                j === compIdx ? { ...c, ...patch } : c,
              ),
            },
      ),
    );
  };

  const removeComparable = (entryIdx: number, compIdx: number) => {
    onEntriesChange(
      entries.map((e, i) =>
        i !== entryIdx
          ? e
          : {
              ...e,
              comparables: (e.comparables ?? []).filter(
                (_, j) => j !== compIdx,
              ),
            },
      ),
    );
  };

  return (
    <div>
      {/* Methodology note */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: "10px 14px",
          borderRadius: DS.radius.md,
          background: "#f0f9ff",
          border: `1px solid ${DS.primary}25`,
          marginBottom: 18,
          fontSize: 12,
          color: DS.primary,
          fontWeight: 500,
          lineHeight: 1.6,
        }}
      >
        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        {lang === "ar"
          ? "يتم تقدير القيمة الإيجارية (أجرة المثل) وفق أسلوب مقارنة العقود/العروض الإيجارية المماثلة (نهج السوق)، بتحليل عقود إيجار مماثلة، اشتقاق سعر إيجار المتر لكل مقارنة، تسويتها حسب الفروقات، ثم تطبيق المتوسط الموزون على مساحة العقار محل التقييم — بما يتوافق مع معايير التقييم الدولية المعتمدة من الهيئة السعودية للمقيمين المعتمدين (تقييم)."
          : "Market rental value (\"fair rent\" / أجرة المثل) is derived using the rental comparison method (market approach): comparable lease contracts/offerings are analysed, a rent/m² figure is derived and adjusted for each, and the resulting weighted rent/m² is applied to the subject property's area — consistent with the International Valuation Standards as adopted by the Saudi Authority for Accredited Valuers (Taqeem)."}
      </div>

      {/* Add new rental entry (subject/building) */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <Field label={lang === "ar" ? "العنوان" : "Title"}>
          <input
            style={inputStyle}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={
              lang === "ar" ? "تقييم إيجاري للمبنى الرئيسي" : "Main Building Rental Assessment"
            }
          />
        </Field>
        <div style={{ paddingBottom: 2 }}>
          <button
            type="button"
            disabled={!newTitle.trim()}
            onClick={addEntry}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              background: DS.green,
              color: "#fff",
              border: "none",
              borderRadius: DS.radius.md,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              opacity: !newTitle.trim() ? 0.4 : 1,
            }}
          >
            + {lang === "ar" ? "إضافة" : "Add"}
          </button>
        </div>
      </div>

      {(entries ?? []).length === 0 && (
        <div
          style={{
            textAlign: "center",
            color: DS.textLight,
            padding: 24,
            border: `1px dashed ${DS.borderStrong}`,
            borderRadius: DS.radius.md,
            fontSize: 12.5,
          }}
        >
          {lang === "ar"
            ? "لا توجد تقييمات إيجارية بعد — أضف عنصراً جديداً أعلاه"
            : "No rental assessments yet — add one above"}
        </div>
      )}

      {(entries ?? []).map((entry, entryIdx) => {
        const computed = computeRentalEntry(entry);
        return (
          <div
            key={entry.id ?? entryIdx}
            style={{
              border: `1px solid ${DS.border}`,
              borderRadius: DS.radius.lg,
              marginBottom: 20,
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            {/* header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 16px",
                background: DS.surfaceAlt,
                borderBottom: `1px solid ${DS.border}`,
              }}
            >
              <h6 style={{ margin: 0, fontWeight: 700, fontSize: 14, color: DS.text }}>
                {lang === "ar" ? "المبنى:" : "Building:"} {entry.title}
              </h6>
              <button
                type="button"
                onClick={() => removeEntry(entryIdx)}
                style={{
                  background: "none",
                  border: "none",
                  color: DS.red,
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 16 }}>
              {/* subject area applied to the derived rent/m² */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <Field
                  label={
                    lang === "ar"
                      ? "مساحة العقار محل التقييم (م²)"
                      : "Subject Property Area (m²)"
                  }
                >
                  <input
                    type="text"
                    dir="ltr"
                    style={inputStyle}
                    value={entry.subjectArea}
                    onChange={(e) =>
                      updateEntry(entryIdx, { subjectArea: e.target.value })
                    }
                  />
                </Field>
              </div>

              {/* comparables table */}
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: DS.radius.md,
                  border: `1px solid ${DS.border}`,
                  marginBottom: 10,
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {[
                        lang === "ar" ? "الوصف / العنوان" : "Description",
                        lang === "ar" ? "بداية المدة" : "Start Date",
                        lang === "ar" ? "نهاية المدة" : "End Date",
                        lang === "ar" ? "الفترة (أشهر)" : "Period (mo.)",
                        lang === "ar" ? "الإيجار الإجمالي" : "Total Rent",
                        lang === "ar" ? "المساحة (م²)" : "Area (m²)",
                        lang === "ar" ? "إيجار المتر" : "Rent/m²",
                        lang === "ar" ? "التسوية %" : "Adj. %",
                        lang === "ar" ? "إيجار المتر المسوّى" : "Adjusted Rent/m²",
                        lang === "ar" ? "ملاحظات" : "Notes",
                        lang === "ar" ? "تضمين" : "Include",
                        lang === "ar" ? "حذف" : "Del.",
                      ].map((h, i) => (
                        <th key={i} style={thS}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(entry.comparables ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={12} style={{ ...tdS, textAlign: "center", color: DS.textLight, padding: 16 }}>
                          {lang === "ar"
                            ? "لا توجد مقارنات إيجارية — أضف مقارنة جديدة"
                            : "No rental comparables — add a new one below"}
                        </td>
                      </tr>
                    ) : (
                      (entry.comparables ?? []).map((c, compIdx) => {
                        const rentPerSqm = comparableRentPerSqm(c);
                        const adjRentPerSqm = comparableAdjustedRentPerSqm(c);
                        const period = comparablePeriodMonths(c);
                        const included = c.inReport !== false;
                        return (
                          <tr
                            key={c.id ?? compIdx}
                            style={{
                              background: !included ? "#fafafa" : compIdx % 2 === 0 ? DS.surface : DS.surfaceAlt,
                              opacity: included ? 1 : 0.5,
                            }}
                          >
                            <td style={tdS}>
                              <input
                                type="text"
                                value={c.title}
                                onChange={(e) => updateComparable(entryIdx, compIdx, { title: e.target.value })}
                                style={cellInputS}
                              />
                            </td>
                            <td style={tdS}>
                              <input
                                type="date"
                                dir="ltr"
                                value={c.startDate}
                                onChange={(e) => updateComparable(entryIdx, compIdx, { startDate: e.target.value })}
                                style={cellInputS}
                              />
                            </td>
                            <td style={tdS}>
                              <input
                                type="date"
                                dir="ltr"
                                value={c.endDate}
                                onChange={(e) => updateComparable(entryIdx, compIdx, { endDate: e.target.value })}
                                style={cellInputS}
                              />
                            </td>
                            <td style={{ ...tdS, textAlign: "center", color: DS.textMuted }}>
                              {period ?? "—"}
                            </td>
                            <td style={tdS}>
                              <input
                                type="text"
                                dir="ltr"
                                value={c.rentAmount}
                                onChange={(e) => updateComparable(entryIdx, compIdx, { rentAmount: e.target.value })}
                                style={cellInputS}
                              />
                            </td>
                            <td style={tdS}>
                              <input
                                type="text"
                                dir="ltr"
                                value={c.area}
                                onChange={(e) => updateComparable(entryIdx, compIdx, { area: e.target.value })}
                                style={cellInputS}
                              />
                            </td>
                            <td
                              style={{
                                ...tdS,
                                textAlign: "right",
                                direction: "ltr",
                                fontVariantNumeric: "tabular-nums",
                                color: DS.textMuted,
                              }}
                            >
                              {rentPerSqm > 0 ? rentPerSqm.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
                            </td>
                            <td style={tdS}>
                              <input
                                type="text"
                                dir="ltr"
                                value={c.adjustmentPct}
                                onChange={(e) => updateComparable(entryIdx, compIdx, { adjustmentPct: e.target.value })}
                                placeholder="0"
                                style={{ ...cellInputS, textAlign: "right" }}
                              />
                            </td>
                            <td
                              style={{
                                ...tdS,
                                fontWeight: 600,
                                textAlign: "right",
                                direction: "ltr",
                                fontVariantNumeric: "tabular-nums",
                                color: DS.primary,
                              }}
                            >
                              {adjRentPerSqm > 0 ? adjRentPerSqm.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
                            </td>
                            <td style={tdS}>
                              <input
                                type="text"
                                value={c.notes}
                                onChange={(e) => updateComparable(entryIdx, compIdx, { notes: e.target.value })}
                                style={cellInputS}
                              />
                            </td>
                            <td style={{ ...tdS, textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={included}
                                onChange={(e) => updateComparable(entryIdx, compIdx, { inReport: e.target.checked })}
                                style={{ accentColor: DS.primary, width: 15, height: 15 }}
                              />
                            </td>
                            <td style={{ ...tdS, textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => removeComparable(entryIdx, compIdx)}
                                style={{ background: "none", border: "none", color: DS.red, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => addComparable(entryIdx)} style={{ ...linkBtnS, color: DS.green, marginBottom: 18 }}>
                + {lang === "ar" ? "مقارنة إيجارية جديدة" : "New Rental Comparable"}
              </button>

              {/* result summary */}
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: DS.radius.md,
                  border: `1px solid ${DS.border}`,
                  marginBottom: 12,
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <tbody>
                    <tr style={{ background: DS.surfaceAlt }}>
                      <td style={{ ...tdS, fontWeight: 600, width: "55%" }}>
                        {lang === "ar" ? "عدد المقارنات المضمّنة" : "Included Comparables"}
                      </td>
                      <td style={{ ...tdS, direction: "ltr", textAlign: "right" }}>
                        {computed.includedCount}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ ...tdS, fontWeight: 600 }}>
                        {lang === "ar" ? "متوسط إيجار المتر المسوّى" : "Average Adjusted Rent/m²"}
                      </td>
                      <td style={{ ...tdS, direction: "ltr", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {computed.averageAdjustedRentPerSqm > 0
                          ? computed.averageAdjustedRentPerSqm.toLocaleString("en-US", { maximumFractionDigits: 2 })
                          : "—"}
                      </td>
                    </tr>
                    <tr style={{ background: "#f0f9ff" }}>
                      <td style={{ ...tdS, fontWeight: 700, color: DS.primary }}>
                        {lang === "ar" ? "القيمة الإيجارية (أجرة المثل)" : "Market Rental Value (Fair Rent)"}
                      </td>
                      <td
                        style={{
                          ...tdS,
                          direction: "ltr",
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: 14,
                          color: DS.primary,
                        }}
                      >
                        {computed.totalValue > 0
                          ? computed.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* notes */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: DS.textMuted,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 5,
                  }}
                >
                  {lang === "ar" ? "ملاحظات:" : "Notes:"}
                </label>
                <textarea
                  rows={3}
                  value={entry.notes ?? ""}
                  onChange={(e) => updateEntry(entryIdx, { notes: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 66 }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
