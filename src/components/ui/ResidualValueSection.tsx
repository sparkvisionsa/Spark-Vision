"use client";

/**
 * ResidualValueSection
 * ────────────────────────────────────────────────────────────────────────
 * Implements the "Residual Value" (القيمة المتبقية) valuation method for
 * the transaction evaluation wizard.
 *
 * Methodology
 * ────────────
 * The Residual (Development) Method is one of the recognised valuation
 * approaches under the International Valuation Standards (IVS 105) as
 * adopted by the Saudi Authority for Accredited Valuers (Taqeem), and is
 * the standard method for valuing raw or under-utilised land ("أرض
 * تطويرية") or a site earmarked for redevelopment ("مبنى"), where no
 * direct sales comparable exists for the land in its current state.
 *
 * The method works backwards from the value of the finished development:
 *
 *   Residual Land Value = GDV − (Construction Costs + Professional Fees
 *                                + Finance Costs + Contingency
 *                                + Developer's Profit)
 *
 * where:
 *   - GDV (Gross Development Value) is the market value of the completed
 *     development once built and sold/let. This is deliberately NOT
 *     re-entered by hand: it is meant to be pulled from the Market
 *     Comparison method's total or the Rental Value method's total
 *     already computed elsewhere in this evaluation, since those are the
 *     project's actual estimates of finished value (a manual override is
 *     still available for cases where neither applies).
 *   - Construction cost is derived the same way as in the Replacement
 *     Cost section (cost/m² × built-up area), and professional fees,
 *     finance costs and contingency are expressed as a % of that cost —
 *     mirroring the indirect-cost convention already used there.
 *   - Developer's profit is expressed as a % of GDV, the standard
 *     residual-appraisal convention (distinct from the cost approach's
 *     profit-on-cost convention).
 *
 * This mirrors the cost-buildup logic already used in
 * `ReplacementCostSection` and reuses the Market/Rental totals rather
 * than inventing a parallel data model, and is kept in its own file so
 * the method can be extended later (e.g. phased cash-flow residual)
 * without touching the rest of the page.
 */

import React from "react";
import { Info } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ResidualDevelopmentType = "land" | "building";

export type ResidualEntry = {
  id: string;
  title: string;
  developmentType: ResidualDevelopmentType; // "land" = أرض تطويرية, "building" = مبنى (redevelopment)

  // Gross Development Value
  gdvManual: string; // manual GDV figure (SAR); used as-is, or overwritten by a "fill" button

  // Construction cost build-up (mirrors ReplacementCostSection's convention)
  builtUpArea: string; // m²
  constructionCostPerSqm: string; // SAR/m²
  professionalFeesPct: string; // % of construction cost
  financeCostPct: string; // % of construction cost
  contingencyPct: string; // % of construction cost

  // Developer's profit, % of GDV (standard residual-method convention)
  developerProfitPct: string;

  notes: string;
};

// ─── Empty-state helpers ────────────────────────────────────────────────────

function cryptoRandomId(prefix: string) {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function emptyResidualEntry(
  title = "",
  developmentType: ResidualDevelopmentType = "land",
): ResidualEntry {
  return {
    id: cryptoRandomId("residual"),
    title,
    developmentType,
    gdvManual: "",
    builtUpArea: "",
    constructionCostPerSqm: "",
    professionalFeesPct: "",
    financeCostPct: "",
    contingencyPct: "",
    developerProfitPct: "",
    notes: "",
  };
}

// ─── Calculation helpers ────────────────────────────────────────────────────

function num(v: string | undefined | null): number {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

export type ResidualEntryComputed = {
  gdv: number;
  constructionCost: number;
  indirectCosts: number; // professional fees + finance + contingency
  totalDevelopmentCosts: number; // construction + indirect
  developerProfit: number; // % of GDV
  totalValue: number; // residual land value
};

export function computeResidualEntry(entry: ResidualEntry): ResidualEntryComputed {
  const gdv = num(entry.gdvManual);
  const builtUpArea = num(entry.builtUpArea);
  const costPerSqm = num(entry.constructionCostPerSqm);
  const constructionCost = builtUpArea * costPerSqm;

  const feesPct = num(entry.professionalFeesPct) / 100;
  const financePct = num(entry.financeCostPct) / 100;
  const contingencyPct = num(entry.contingencyPct) / 100;
  const indirectCosts = constructionCost * (feesPct + financePct + contingencyPct);

  const totalDevelopmentCosts = constructionCost + indirectCosts;

  const profitPct = num(entry.developerProfitPct) / 100;
  const developerProfit = gdv * profitPct;

  const totalValue = gdv - totalDevelopmentCosts - developerProfit;

  return {
    gdv,
    constructionCost,
    indirectCosts,
    totalDevelopmentCosts,
    developerProfit,
    totalValue,
  };
}

export function totalResidualValue(entries: ResidualEntry[]): number {
  return (entries ?? []).reduce((sum, e) => {
    const v = computeResidualEntry(e).totalValue;
    return sum + (v > 0 ? v : 0);
  }, 0);
}

// ─── Local styling (self-contained, matches the host page's design) ───────

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

const thS: React.CSSProperties = {
  border: `1px solid ${DS.border}`,
  padding: "5px 8px",
  fontWeight: 600,
  width: "55%",
};

const tdS: React.CSSProperties = {
  border: `1px solid ${DS.border}`,
  padding: "5px 8px",
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

export function ResidualValueSection({
  lang,
  entries,
  onEntriesChange,
  marketValueTotal,
  rentalValueTotal,
}: {
  lang: "ar" | "en";
  entries: ResidualEntry[];
  onEntriesChange: (entries: ResidualEntry[]) => void;
  /** Market Comparison method total (SAR), offered as a one-click GDV fill */
  marketValueTotal?: number;
  /** Rental Value method total (SAR), offered as a one-click GDV fill */
  rentalValueTotal?: number;
}) {
  const [newTitle, setNewTitle] = React.useState("");
  const [newType, setNewType] = React.useState<ResidualDevelopmentType>("land");

  const addEntry = () => {
    const title = newTitle.trim();
    if (!title) return;
    onEntriesChange([...(entries ?? []), emptyResidualEntry(title, newType)]);
    setNewTitle("");
  };

  const removeEntry = (idx: number) => onEntriesChange(entries.filter((_, i) => i !== idx));

  const updateEntry = (idx: number, patch: Partial<ResidualEntry>) =>
    onEntriesChange(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

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
          ? "تُحتسب القيمة المتبقية وفق طريقة الإحلال التطويرية (Residual Method): القيمة السوقية للمشروع بعد اكتماله (ناتج التطوير الإجمالي) ناقص تكاليف الإنشاء والتكاليف غير المباشرة (رسوم مهنية، تمويل، طوارئ) وناقص هامش ربح المطور، بما يتوافق مع معايير التقييم الدولية المعتمدة من الهيئة السعودية للمقيمين المعتمدين (تقييم). يُفضّل تعبئة ناتج التطوير الإجمالي من قيمة طريقة المقارنة أو القيمة الإيجارية المحسوبتين مسبقاً بدلاً من إدخالها يدوياً."
          : "Residual value is calculated using the Residual (Development) Method: the completed project's market value (Gross Development Value) less construction and indirect costs (professional fees, finance, contingency) less the developer's profit margin, consistent with the International Valuation Standards as adopted by the Saudi Authority for Accredited Valuers (Taqeem). Gross Development Value should preferably be filled from the Market Comparison or Rental Value totals already computed, rather than entered manually."}
      </div>

      {/* Add new entry */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <Field label={lang === "ar" ? "العنوان" : "Title"}>
          <input
            style={inputStyle}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={lang === "ar" ? "تقدير القيمة المتبقية للأرض" : "Residual Land Value Assessment"}
          />
        </Field>
        <Field label={lang === "ar" ? "النوع" : "Type"}>
          <select
            style={inputStyle}
            value={newType}
            onChange={(e) => setNewType(e.target.value as ResidualDevelopmentType)}
          >
            <option value="land">{lang === "ar" ? "أرض تطويرية" : "Developmental Land"}</option>
            <option value="building">{lang === "ar" ? "مبنى (إعادة تطوير)" : "Building (Redevelopment)"}</option>
          </select>
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
          {lang === "ar" ? "لا توجد تقييمات بعد — أضف عنصراً جديداً أعلاه" : "No assessments yet — add one above"}
        </div>
      )}

      {(entries ?? []).map((entry, idx) => {
        const c = computeResidualEntry(entry);
        return (
          <div
            key={entry.id ?? idx}
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
                {entry.title}{" "}
                <span style={{ fontWeight: 500, fontSize: 12, color: DS.textMuted }}>
                  (
                  {entry.developmentType === "land"
                    ? lang === "ar"
                      ? "أرض تطويرية"
                      : "Developmental Land"
                    : lang === "ar"
                      ? "مبنى"
                      : "Building"}
                  )
                </span>
              </h6>
              <button
                type="button"
                onClick={() => removeEntry(idx)}
                style={{ background: "none", border: "none", color: DS.red, cursor: "pointer", fontSize: 18, fontWeight: 700, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 16 }}>
              {/* GDV */}
              <div style={{ marginBottom: 16 }}>
                <Field label={lang === "ar" ? "ناتج التطوير الإجمالي (GDV)" : "Gross Development Value (GDV)"}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="text"
                      dir="ltr"
                      style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                      value={entry.gdvManual}
                      onChange={(e) => updateEntry(idx, { gdvManual: e.target.value })}
                      placeholder="0.00"
                    />
                    {typeof marketValueTotal === "number" && marketValueTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => updateEntry(idx, { gdvManual: marketValueTotal.toFixed(2) })}
                        style={{
                          fontSize: 11,
                          padding: "6px 10px",
                          background: `${DS.primary}12`,
                          border: `1px solid ${DS.primary}30`,
                          borderRadius: DS.radius.sm,
                          color: DS.primary,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lang === "ar" ? "تعبئة من المقارنة" : "Fill from Market"}
                      </button>
                    )}
                    {typeof rentalValueTotal === "number" && rentalValueTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => updateEntry(idx, { gdvManual: rentalValueTotal.toFixed(2) })}
                        style={{
                          fontSize: 11,
                          padding: "6px 10px",
                          background: `${DS.primary}12`,
                          border: `1px solid ${DS.primary}30`,
                          borderRadius: DS.radius.sm,
                          color: DS.primary,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lang === "ar" ? "تعبئة من القيمة الإيجارية" : "Fill from Rental"}
                      </button>
                    )}
                  </div>
                </Field>
              </div>

              {/* cost build-up */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <Field label={lang === "ar" ? "مساحة المسطحات (م²)" : "Built-up Area (m²)"}>
                  <input
                    type="text"
                    dir="ltr"
                    style={inputStyle}
                    value={entry.builtUpArea}
                    onChange={(e) => updateEntry(idx, { builtUpArea: e.target.value })}
                  />
                </Field>
                <Field label={lang === "ar" ? "تكلفة البناء للمتر" : "Construction Cost/m²"}>
                  <input
                    type="text"
                    dir="ltr"
                    style={inputStyle}
                    value={entry.constructionCostPerSqm}
                    onChange={(e) => updateEntry(idx, { constructionCostPerSqm: e.target.value })}
                  />
                </Field>
                <Field label={lang === "ar" ? "نسبة الرسوم المهنية %" : "Professional Fees %"}>
                  <input
                    type="text"
                    dir="ltr"
                    style={inputStyle}
                    value={entry.professionalFeesPct}
                    onChange={(e) => updateEntry(idx, { professionalFeesPct: e.target.value })}
                  />
                </Field>
                <Field label={lang === "ar" ? "نسبة التمويل %" : "Finance Cost %"}>
                  <input
                    type="text"
                    dir="ltr"
                    style={inputStyle}
                    value={entry.financeCostPct}
                    onChange={(e) => updateEntry(idx, { financeCostPct: e.target.value })}
                  />
                </Field>
                <Field label={lang === "ar" ? "نسبة الطوارئ %" : "Contingency %"}>
                  <input
                    type="text"
                    dir="ltr"
                    style={inputStyle}
                    value={entry.contingencyPct}
                    onChange={(e) => updateEntry(idx, { contingencyPct: e.target.value })}
                  />
                </Field>
                <Field label={lang === "ar" ? "هامش ربح المطور % (من GDV)" : "Developer's Profit % (of GDV)"}>
                  <input
                    type="text"
                    dir="ltr"
                    style={inputStyle}
                    value={entry.developerProfitPct}
                    onChange={(e) => updateEntry(idx, { developerProfitPct: e.target.value })}
                  />
                </Field>
              </div>

              {/* result summary */}
              <div style={{ overflowX: "auto", borderRadius: DS.radius.md, border: `1px solid ${DS.border}`, marginBottom: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <tbody>
                    <tr>
                      <td style={thS}>{lang === "ar" ? "ناتج التطوير الإجمالي (GDV)" : "Gross Development Value"}</td>
                      <td style={{ ...tdS, direction: "ltr", textAlign: "right" }}>
                        {c.gdv > 0 ? c.gdv.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
                      </td>
                    </tr>
                    <tr style={{ background: DS.surfaceAlt }}>
                      <td style={thS}>{lang === "ar" ? "تكلفة الإنشاء" : "Construction Cost"}</td>
                      <td style={{ ...tdS, direction: "ltr", textAlign: "right" }}>
                        {c.constructionCost > 0 ? c.constructionCost.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
                      </td>
                    </tr>
                    <tr>
                      <td style={thS}>{lang === "ar" ? "التكاليف غير المباشرة" : "Indirect Costs"}</td>
                      <td style={{ ...tdS, direction: "ltr", textAlign: "right" }}>
                        {c.indirectCosts > 0 ? c.indirectCosts.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
                      </td>
                    </tr>
                    <tr style={{ background: DS.surfaceAlt }}>
                      <td style={thS}>{lang === "ar" ? "إجمالي تكاليف التطوير" : "Total Development Costs"}</td>
                      <td style={{ ...tdS, direction: "ltr", textAlign: "right", fontWeight: 600 }}>
                        {c.totalDevelopmentCosts > 0 ? c.totalDevelopmentCosts.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
                      </td>
                    </tr>
                    <tr>
                      <td style={thS}>{lang === "ar" ? "هامش ربح المطور" : "Developer's Profit"}</td>
                      <td style={{ ...tdS, direction: "ltr", textAlign: "right" }}>
                        {c.developerProfit > 0 ? c.developerProfit.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
                      </td>
                    </tr>
                    <tr style={{ background: "#f0f9ff" }}>
                      <td style={{ ...thS, fontWeight: 700, color: DS.primary }}>
                        {lang === "ar" ? "القيمة المتبقية (الأرض)" : "Residual Value (Land)"}
                      </td>
                      <td
                        style={{
                          ...tdS,
                          direction: "ltr",
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: 14,
                          color: c.totalValue >= 0 ? DS.primary : DS.red,
                        }}
                      >
                        {c.totalValue !== 0
                          ? c.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {c.gdv > 0 && c.totalValue < 0 && (
                <div style={{ fontSize: 11.5, color: DS.red, marginBottom: 12 }}>
                  {lang === "ar"
                    ? "تنبيه: القيمة المتبقية سالبة — التكاليف وهامش الربح يتجاوزان ناتج التطوير الإجمالي."
                    : "Warning: residual value is negative — costs and profit margin exceed the Gross Development Value."}
                </div>
              )}

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
                  onChange={(e) => updateEntry(idx, { notes: e.target.value })}
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
