"use client";

import React from "react";

// ─── Types ─────────────────────────────────────────────────────────────────
// A DCF valuation projects income/expenses year-by-year over a holding
// period, discounts each year's net operating income (NOI) back to present
// value, then adds the discounted "terminal value" — the estimated resale
// value of the asset at the end of the holding period (usually derived by
// capitalizing the NOI of the year right after the holding period ends).
// This mirrors standard income-approach DCF practice (IVS 103/105, RICS),
// and is method-agnostic enough to fit local (Taqeem) reporting too.

export type DCFYearLine = {
  year: number; // 1-indexed year within the holding period
  income: string; // projected gross/rental income for that year
  expenses: string; // operating expenses for that year
  notes: string;
};

export type DCFEntry = {
  id: string;
  title: string; // e.g. "Main Building" / "المبنى الرئيسي"
  startDate: string;
  holdingYears: string; // number of years in the explicit forecast period
  discountRate: string; // % — required rate of return / discount rate
  terminalCapRate: string; // % — cap rate used to derive terminal (reversion) value
  terminalGrowthPct: string; // % — growth assumed on the year-after-holding NOI
  sellingCostsPct: string; // % — costs of sale deducted from terminal value
  lines: DCFYearLine[];
  notes: string;
};

export function emptyDCFYearLine(year: number): DCFYearLine {
  return { year, income: "", expenses: "", notes: "" };
}

export function emptyDCFEntry(title = ""): DCFEntry {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dcf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    startDate: "",
    holdingYears: "5",
    discountRate: "",
    terminalCapRate: "",
    terminalGrowthPct: "0",
    sellingCostsPct: "",
    lines: Array.from({ length: 5 }, (_, i) => emptyDCFYearLine(i + 1)),
    notes: "",
  };
}

// Keeps `lines` in sync with `holdingYears` (adds/trims trailing years).
function resizeLines(entry: DCFEntry, years: number): DCFYearLine[] {
  const n = Math.max(0, Math.min(50, years || 0));
  const current = entry.lines;
  if (n === current.length) return current;
  if (n < current.length) return current.slice(0, n);
  const extra = Array.from({ length: n - current.length }, (_, i) =>
    emptyDCFYearLine(current.length + i + 1),
  );
  return [...current, ...extra];
}

// ─── Calculations ────────────────────────────────────────────────────────────

const p = (s: string | undefined) => parseFloat(String(s ?? "")) || 0;

export function computeDCFEntry(entry: DCFEntry) {
  const r = p(entry.discountRate) / 100;
  const capRate = p(entry.terminalCapRate) / 100;
  const growth = p(entry.terminalGrowthPct) / 100;
  const sellingCostsPct = p(entry.sellingCostsPct) / 100;

  const yearRows = entry.lines.map((line) => {
    const income = p(line.income);
    const expenses = p(line.expenses);
    const noi = income - expenses;
    const discountFactor = r > 0 ? 1 / Math.pow(1 + r, line.year) : 1;
    const pv = noi * discountFactor;
    return { ...line, income, expenses, noi, discountFactor, pv };
  });

  const lastNoi = yearRows.length > 0 ? yearRows[yearRows.length - 1].noi : 0;
  const terminalYearNoi = lastNoi * (1 + growth);
  const terminalValueGross = capRate > 0 ? terminalYearNoi / capRate : 0;
  const terminalValueNet = terminalValueGross * (1 - sellingCostsPct);
  const holdingYears = entry.lines.length;
  const terminalDiscountFactor =
    r > 0 ? 1 / Math.pow(1 + r, holdingYears) : 1;
  const pvTerminal = terminalValueNet * terminalDiscountFactor;

  const pvCashflows = yearRows.reduce((s, y) => s + y.pv, 0);
  const totalValue = pvCashflows + pvTerminal;

  return {
    yearRows,
    terminalYearNoi,
    terminalValueGross,
    terminalValueNet,
    pvTerminal,
    pvCashflows,
    totalValue,
  };
}

// ─── Local design tokens (kept self-contained on purpose) ───────────────────

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
  primaryLight: "#f0f9ff",
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

const linkBtnS: React.CSSProperties = {
  background: "none",
  border: "none",
  color: DS.green,
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

function fmt(n: number, digits = 0) {
  return n
    ? n.toLocaleString("en-US", { maximumFractionDigits: digits })
    : "—";
}

// ─── Component ────────────────────────────────────────────────────────────

export function DCFSection({
  lang,
  entries,
  onEntriesChange,
}: {
  lang: "ar" | "en";
  entries: DCFEntry[];
  onEntriesChange: (entries: DCFEntry[]) => void;
}) {
  const isRtl = lang === "ar";
  const [newTitle, setNewTitle] = React.useState("");

  const updateEntry = (id: string, patch: Partial<DCFEntry>) => {
    onEntriesChange(
      entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  };

  const updateHoldingYears = (id: string, years: string) => {
    onEntriesChange(
      entries.map((e) => {
        if (e.id !== id) return e;
        const n = parseInt(years, 10) || 0;
        return { ...e, holdingYears: years, lines: resizeLines(e, n) };
      }),
    );
  };

  const updateLine = (
    entryId: string,
    lineIdx: number,
    patch: Partial<DCFYearLine>,
  ) => {
    onEntriesChange(
      entries.map((e) =>
        e.id !== entryId
          ? e
          : {
              ...e,
              lines: e.lines.map((l, i) =>
                i === lineIdx ? { ...l, ...patch } : l,
              ),
            },
      ),
    );
  };

  const removeEntry = (id: string) =>
    onEntriesChange(entries.filter((e) => e.id !== id));

  const addEntry = () => {
    if (!newTitle.trim()) return;
    onEntriesChange([...entries, emptyDCFEntry(newTitle.trim())]);
    setNewTitle("");
  };

  return (
    <div>
      {/* Add new DCF scenario */}
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
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={
              lang === "ar" ? "المبنى الرئيسي" : "Main Building"
            }
            style={inputStyle}
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

      {entries.length === 0 && (
        <div
          style={{
            textAlign: "center",
            color: DS.textLight,
            padding: 24,
            fontSize: 13,
            border: `1px dashed ${DS.border}`,
            borderRadius: DS.radius.md,
          }}
        >
          {lang === "ar"
            ? "لا توجد سيناريوهات تدفقات نقدية مخصومة بعد"
            : "No DCF scenarios yet"}
        </div>
      )}

      {entries.map((entry) => {
        const calc = computeDCFEntry(entry);
        return (
          <div
            key={entry.id}
            style={{
              border: `1px solid ${DS.border}`,
              borderRadius: DS.radius.lg,
              marginBottom: 24,
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            {/* Header */}
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
                onClick={() => removeEntry(entry.id)}
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
              {/* Assumptions */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <Field label={lang === "ar" ? "تاريخ بداية الاستثمار" : "Start Date"}>
                  <input
                    type="date"
                    value={entry.startDate}
                    onChange={(e) =>
                      updateEntry(entry.id, { startDate: e.target.value })
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label={lang === "ar" ? "عدد سنوات الاستثمار" : "Holding Period (years)"}>
                  <input
                    type="number"
                    dir="ltr"
                    min={1}
                    max={30}
                    value={entry.holdingYears}
                    onChange={(e) =>
                      updateHoldingYears(entry.id, e.target.value)
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label={lang === "ar" ? "معدل الخصم %" : "Discount Rate %"}>
                  <input
                    type="text"
                    dir="ltr"
                    value={entry.discountRate}
                    onChange={(e) =>
                      updateEntry(entry.id, { discountRate: e.target.value })
                    }
                    placeholder="10"
                    style={inputStyle}
                  />
                </Field>
                <Field label={lang === "ar" ? "معدل رسملة الخروج %" : "Terminal Cap Rate %"}>
                  <input
                    type="text"
                    dir="ltr"
                    value={entry.terminalCapRate}
                    onChange={(e) =>
                      updateEntry(entry.id, { terminalCapRate: e.target.value })
                    }
                    placeholder="9"
                    style={inputStyle}
                  />
                </Field>
                <Field label={lang === "ar" ? "نمو دخل نهاية المدة %" : "Terminal Growth %"}>
                  <input
                    type="text"
                    dir="ltr"
                    value={entry.terminalGrowthPct}
                    onChange={(e) =>
                      updateEntry(entry.id, {
                        terminalGrowthPct: e.target.value,
                      })
                    }
                    placeholder="0"
                    style={inputStyle}
                  />
                </Field>
                <Field label={lang === "ar" ? "تكاليف البيع %" : "Selling Costs %"}>
                  <input
                    type="text"
                    dir="ltr"
                    value={entry.sellingCostsPct}
                    onChange={(e) =>
                      updateEntry(entry.id, { sellingCostsPct: e.target.value })
                    }
                    placeholder="2"
                    style={inputStyle}
                  />
                </Field>
              </div>

              {/* Yearly cash-flow table */}
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
                        lang === "ar" ? "السنة" : "Year",
                        lang === "ar" ? "الدخل المتوقع" : "Projected Income",
                        lang === "ar" ? "المصاريف التشغيلية" : "Operating Expenses",
                        lang === "ar" ? "صافي الدخل التشغيلي" : "NOI",
                        lang === "ar" ? "معامل الخصم" : "Discount Factor",
                        lang === "ar" ? "القيمة الحالية" : "Present Value",
                        lang === "ar" ? "ملاحظات" : "Notes",
                      ].map((h, i) => (
                        <th key={i} style={thS}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calc.yearRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ ...tdS, textAlign: "center", color: DS.textLight, padding: 16 }}>
                          {lang === "ar" ? "حدد عدد سنوات الاستثمار" : "Set the holding period above"}
                        </td>
                      </tr>
                    ) : (
                      calc.yearRows.map((row, idx) => (
                        <tr
                          key={idx}
                          style={{ background: idx % 2 === 0 ? DS.surface : DS.surfaceAlt }}
                        >
                          <td style={{ ...tdS, textAlign: "center", fontWeight: 700, color: DS.textMuted }}>
                            {row.year}
                          </td>
                          <td style={tdS}>
                            <input
                              type="text"
                              dir="ltr"
                              value={entry.lines[idx].income}
                              onChange={(e) =>
                                updateLine(entry.id, idx, { income: e.target.value })
                              }
                              style={cellInputS}
                            />
                          </td>
                          <td style={tdS}>
                            <input
                              type="text"
                              dir="ltr"
                              value={entry.lines[idx].expenses}
                              onChange={(e) =>
                                updateLine(entry.id, idx, { expenses: e.target.value })
                              }
                              style={cellInputS}
                            />
                          </td>
                          <td
                            style={{
                              ...tdS,
                              fontWeight: 600,
                              direction: "ltr",
                              textAlign: "right",
                            }}
                          >
                            {fmt(row.noi)}
                          </td>
                          <td style={{ ...tdS, direction: "ltr", textAlign: "right" }}>
                            {row.discountFactor.toFixed(4)}
                          </td>
                          <td
                            style={{
                              ...tdS,
                              fontWeight: 700,
                              color: DS.primary,
                              direction: "ltr",
                              textAlign: "right",
                            }}
                          >
                            {fmt(row.pv)}
                          </td>
                          <td style={tdS}>
                            <input
                              type="text"
                              value={entry.lines[idx].notes}
                              onChange={(e) =>
                                updateLine(entry.id, idx, { notes: e.target.value })
                              }
                              style={cellInputS}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {calc.yearRows.length > 0 && (
                    <tfoot>
                      <tr style={{ background: DS.surfaceAlt }}>
                        <td colSpan={5} style={{ ...tdS, fontWeight: 700 }}>
                          {lang === "ar"
                            ? "مجموع القيمة الحالية للتدفقات"
                            : "Sum of PV of Cash Flows"}
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            ...tdS,
                            fontWeight: 700,
                            color: DS.primary,
                            direction: "ltr",
                            textAlign: "right",
                          }}
                        >
                          {fmt(calc.pvCashflows)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Terminal value + summary */}
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: DS.radius.md,
                  border: `1px solid ${DS.border}`,
                  marginTop: 14,
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <tbody>
                    {[
                      {
                        label:
                          lang === "ar"
                            ? "صافي دخل سنة ما بعد المدة (للرسملة)"
                            : "NOI Used for Terminal Value",
                        value: fmt(calc.terminalYearNoi),
                      },
                      {
                        label:
                          lang === "ar" ? "القيمة النهائية (قبل تكاليف البيع)" : "Terminal Value (before selling costs)",
                        value: fmt(calc.terminalValueGross),
                      },
                      {
                        label:
                          lang === "ar" ? "صافي القيمة النهائية" : "Net Terminal Value",
                        value: fmt(calc.terminalValueNet),
                      },
                      {
                        label:
                          lang === "ar" ? "القيمة الحالية للقيمة النهائية" : "PV of Terminal Value",
                        value: fmt(calc.pvTerminal),
                      },
                      {
                        label:
                          lang === "ar" ? "قيمة الأصل (DCF)" : "Property Value (DCF)",
                        value: fmt(calc.totalValue),
                        highlight: true,
                      },
                    ].map(({ label, value, highlight }, ri) => (
                      <tr
                        key={ri}
                        style={{
                          background: highlight
                            ? DS.primaryLight
                            : ri % 2 === 0
                              ? DS.surface
                              : DS.surfaceAlt,
                        }}
                      >
                        <td
                          style={{
                            ...tdS,
                            fontWeight: 600,
                            color: highlight ? DS.primary : DS.text,
                            width: "60%",
                          }}
                        >
                          {label}
                        </td>
                        <td
                          style={{
                            ...tdS,
                            fontWeight: highlight ? 700 : 500,
                            fontSize: highlight ? 14 : 13,
                            color: highlight ? DS.primary : DS.text,
                            direction: "ltr",
                            textAlign: isRtl ? "right" : "left",
                          }}
                        >
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              <div style={{ marginTop: 14 }}>
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
                  value={entry.notes}
                  onChange={(e) => updateEntry(entry.id, { notes: e.target.value })}
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

// Total DCF value across all scenarios — used by the Appraiser Opinion
// section as the "DCF method total" input, mirroring how the Investment
// section total feeds the Income method.
export function totalDCFValue(entries: DCFEntry[]): number {
  return entries.reduce((sum, e) => sum + computeDCFEntry(e).totalValue, 0);
}
