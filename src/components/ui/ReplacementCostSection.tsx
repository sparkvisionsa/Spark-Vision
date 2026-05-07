"use client";

import React from "react";

// ─── types ────────────────────────────────────────────────────────────────────

export type ReplacementLine = {
  title: string;
  space: string;
  unitPrice: string;
  notes: string;
  useSpace: boolean;
  total: string;
};

export type ReplacementFields = {
  managementPct: string;
  professionalPct: string;
  utilityNetworkPct: string;
  emergencyPct: string;
  financePct: string;
  yearDev: string;
  earningsRate: string;
  buildAge: string;
  defaultAge: string;
  depreciationPct: string;
  economicPct: string;
  careerPct: string;
  maintenancePrice: string;
  finishesPrice: string;
  maintenanceDesc: string;
  finishesDesc: string;
  landTitle: string;
  landSpace: string;
  meterPriceLand: string;
  completionPct: string;
  replacementNotes: string;
};

type Lang = "ar" | "en";

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T: Record<
  Lang,
  {
    part1Title: string;
    landTitle: string;
    landSpace: string;
    meterPriceLand: string;
    landTotal: string;
    colTitle: string;
    colArea: string;
    colPrice: string;
    colTotal: string;
    colNotes: string;
    addLine: string;
    sumArea: string;
    sumValue: string;
    part2Title: string;
    managementPct: string;
    professionalPct: string;
    utilityNetworkPct: string;
    emergencyPct: string;
    financePct: string;
    yearDev: string;
    earningsRate: string;
    buildAge: string;
    defaultAge: string;
    depreciationPct: string;
    economicPct: string;
    careerPct: string;
    unitYear: string;
    unitPct: string;
    c_totalArea: string;
    c_totalVal: string;
    c_indirect: string;
    c_direct: string;
    c_devprofitVal: string;
    c_assetVal: string;
    c_remlife: string;
    c_totaldep: string;
    c_depVal: string;
    c_netAsset: string;
    c_netMeter: string;
    c_landAsset: string;
    part3Title: string;
    maintenancePrice: string;
    finishesPrice: string;
    completionPct: string;
    maintenanceDesc: string;
    finishesDesc: string;
    replacementNotes: string;
    descPlaceholderMaint: string;
    descPlaceholderFinish: string;
    notesPlaceholder: string;
    itemPlaceholder: string;
  }
> = {
  ar: {
    part1Title: "تفاصيل مساحة الأصل",
    landTitle: "العنوان",
    landSpace: "مساحة الأرض",
    meterPriceLand: "سعر المتر للأرض",
    landTotal: "المجموع",
    colTitle: "العنوان",
    colArea: "المساحة (م²)",
    colPrice: "سعر الوحدة",
    colTotal: "الإجمالي",
    colNotes: "ملاحظات",
    addLine: "＋ إضافة بند",
    sumArea: "إجمالي المساحة",
    sumValue: "إجمالي القيمة",
    part2Title: "تفاصيل تكلفة الإحلال",
    managementPct: "نسبة الرسوم الإدارية",
    professionalPct: "نسبة الرسوم المهنية",
    utilityNetworkPct: "نسبة شبكة المرافق",
    emergencyPct: "نسبة التكاليف الطارئة",
    financePct: "نسبة التمويل",
    yearDev: "مدة التطوير",
    earningsRate: "هامش ربح المطور",
    buildAge: "عمر الأصل الفعال",
    defaultAge: "عمر الأصل الإفتراضي",
    depreciationPct: "التقادم المادي",
    economicPct: "التقادم الاقتصادي",
    careerPct: "التقادم الوظيفي",
    unitYear: "سنة",
    unitPct: "%",
    c_totalArea: "إجمالي مساحة الأصل",
    c_totalVal: "إجمالي قيمة الأصل (التكاليف المباشرة)",
    c_indirect: "التكاليف الغير مباشرة",
    c_direct: "التكاليف المباشرة + الغير مباشرة",
    c_devprofitVal: "قيمة هامش ربح المطور",
    c_assetVal: "قيمة الأصل (قبل الإهلاك)",
    c_remlife: "العمر المتبقي",
    c_totaldep: "مجموع الإهلاك",
    c_depVal: "القيمة المهلكة للأصول",
    c_netAsset: "صافي قيمة الأصل بعد الإهلاك",
    c_netMeter: "صافي سعر متر الأصل بعد الإهلاك",
    c_landAsset: "قيمة الأرض والأصل",
    part3Title: "بيانات إضافية",
    maintenancePrice: "تكاليف الصيانة في حال كان الأصل مكتملاً",
    finishesPrice: "تكاليف التشطيبات المتبقية",
    completionPct: "نسبة إكتمال البناء",
    maintenanceDesc: "وصف الصيانة في حال كان الأصل مكتملاً",
    finishesDesc: "وصف التشطيبات المتبقية",
    replacementNotes: "ملاحظات",
    descPlaceholderMaint: "أدخل وصف الصيانة...",
    descPlaceholderFinish: "أدخل وصف التشطيبات...",
    notesPlaceholder: "أدخل الملاحظات العامة...",
    itemPlaceholder: "وصف البند",
  },
  en: {
    part1Title: "Asset Area Details",
    colTitle: "Title",
    landTitle: "Title",
    landSpace: "Land Area (m²)",
    meterPriceLand: "Land Meter Price",
    landTotal: "Total",
    colArea: "Area (m²)",
    colPrice: "Unit Price",
    colTotal: "Total",
    colNotes: "Notes",
    addLine: "＋ Add Item",
    sumArea: "Total Area",
    sumValue: "Total Value",
    part2Title: "Replacement Cost Details",
    managementPct: "Management Fees %",
    professionalPct: "Professional Fees %",
    utilityNetworkPct: "Utility Network %",
    emergencyPct: "Contingency Costs %",
    financePct: "Finance %",
    yearDev: "Development Period",
    earningsRate: "Developer Profit Margin %",
    buildAge: "Effective Asset Age",
    defaultAge: "Assumed Asset Age",
    depreciationPct: "Physical Depreciation %",
    economicPct: "Economic Obsolescence %",
    careerPct: "Functional Obsolescence %",
    unitYear: "yrs",
    unitPct: "%",
    c_totalArea: "Total Asset Area",
    c_totalVal: "Total Asset Value (Direct Costs)",
    c_indirect: "Indirect Costs",
    c_direct: "Direct + Indirect Costs",
    c_devprofitVal: "Developer Profit Value",
    c_assetVal: "Asset Value (Before Depreciation)",
    c_remlife: "Remaining Life",
    c_totaldep: "Total Depreciation",
    c_depVal: "Depreciated Asset Value",
    c_netAsset: "Net Asset Value After Depreciation",
    c_netMeter: "Net Asset Meter Price After Depreciation",
    c_landAsset: "Land + Asset Value",
    part3Title: "Additional Data",
    maintenancePrice: "Maintenance Costs (if asset is complete)",
    finishesPrice: "Remaining Finishing Costs",
    completionPct: "Construction Completion %",
    maintenanceDesc: "Maintenance Description (if asset is complete)",
    finishesDesc: "Remaining Finishes Description",
    replacementNotes: "Notes",
    descPlaceholderMaint: "Enter maintenance description...",
    descPlaceholderFinish: "Enter finishes description...",
    notesPlaceholder: "Enter general notes...",
    itemPlaceholder: "Item description",
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, lang: Lang): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function p(s: string): number {
  return parseFloat(s) || 0;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function PartHeader({ title }: { title: string }) {
  return <div style={s.partHeader}>{title}</div>;
}

function InputRow({
  label,
  value,
  onChange,
  unit,
  isYear = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  isYear?: boolean;
}) {
  return (
    <div style={s.fieldRow}>
      <span style={s.fieldLabel}>{label}</span>
      <div style={s.fieldValue}>
        <input
          type="number"
          step={isYear ? "1" : "0.01"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          style={s.rowInput}
        />
        {unit && <span style={s.unitLabel}>{unit}</span>}
      </div>
    </div>
  );
}

function CalcRow({
  label,
  value,
  unit,
  bold = false,
  accent = false,
  light = false,
}: {
  label: string;
  value: string;
  unit?: string;
  bold?: boolean;
  accent?: boolean;
  light?: boolean;
}) {
  return (
    <div
      style={{
        ...s.fieldRow,
        background: light ? "#fff" : "#f8f9fb",
      }}
    >
      <span
        style={{
          ...s.fieldLabel,
          fontWeight: bold ? 600 : 400,
        }}
      >
        {label}
      </span>
      <div style={s.fieldValue}>
        <div
          style={{
            ...s.calcValue,
            color: accent ? "#1a6fc4" : "#222",
            fontWeight: accent || bold ? 600 : 500,
            fontSize: accent ? 15 : 13,
          }}
        >
          {value}
        </div>
        {unit && <span style={s.unitLabel}>{unit}</span>}
      </div>
    </div>
  );
}

function RowDivider() {
  return <div style={{ height: 1, background: "#eee", margin: "2px 0" }} />;
}

// ─── area table ───────────────────────────────────────────────────────────────

// FIX: Typed t prop explicitly instead of using raw indexed expression
type TDict = (typeof T)[Lang];

function AreaTable({
  lines,
  onChange,
  lang,
  t,
}: {
  lines: ReplacementLine[];
  onChange: (lines: ReplacementLine[]) => void;
  lang: Lang;
  t: TDict;
}) {
  const addLine = () =>
    onChange([
      ...lines,
      {
        title: "",
        space: "",
        unitPrice: "",
        notes: "",
        useSpace: true,
        total: "",
      },
    ]);

  const removeLine = (i: number) =>
    onChange(lines.filter((_, idx) => idx !== i));

  // FIX: updateLine had broken total logic when useSpace=false.
  // Previously the else branch read `pr > 0 ? pr.toFixed(2) : ""`
  // which used the OLD `l.unitPrice` before the field update was applied.
  // Now we derive sp and pr from the already-merged `updated` object.
  const updateLine = (
    i: number,
    field: keyof ReplacementLine,
    val: string | boolean,
  ) =>
    onChange(
      lines.map((l, idx) => {
        if (idx !== i) return l;
        const updated: ReplacementLine = { ...l, [field]: val };
        const sp = p(updated.space);
        const pr = p(updated.unitPrice);
        if (updated.useSpace) {
          updated.total = sp > 0 && pr > 0 ? (sp * pr).toFixed(2) : "";
        } else {
          // When not using area, total = unit price alone
          updated.total = pr > 0 ? pr.toFixed(2) : "";
        }
        return updated;
      }),
    );

  const totalArea = lines.reduce((s, l) => s + p(l.space), 0);
  const totalVal = lines.reduce((s, l) => s + p(l.total || "0"), 0);

  return (
    <div>
      <PartHeader title={t.part1Title} />
      <div style={{ overflowX: "auto", padding: "10px 12px 6px" }}>
        <table style={s.table}>
          <thead>
            <tr>
              {[
                t.colTitle,
                t.colArea,
                t.colPrice,
                t.colTotal,
                t.colNotes,
                "",
              ].map((h, i) => (
                <th key={i} style={s.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const lineTotal = p(line.total || "0");
              return (
                <tr key={i}>
                  <td style={s.td}>
                    <input
                      value={line.title}
                      onChange={(e) => updateLine(i, "title", e.target.value)}
                      placeholder={t.itemPlaceholder}
                      style={s.cellInput}
                    />
                  </td>
                  <td style={s.td}>
                    <input
                      type="number"
                      dir="ltr"
                      value={line.space}
                      onChange={(e) => updateLine(i, "space", e.target.value)}
                      placeholder="0"
                      style={{ ...s.cellInput, textAlign: "left" }}
                    />
                  </td>
                  <td style={s.td}>
                    <input
                      type="number"
                      dir="ltr"
                      value={line.unitPrice}
                      onChange={(e) =>
                        updateLine(i, "unitPrice", e.target.value)
                      }
                      placeholder="0"
                      style={{ ...s.cellInput, textAlign: "left" }}
                    />
                  </td>
                  <td
                    style={{
                      ...s.td,
                      background: "#f8f9fb",
                      fontWeight: 500,
                      textAlign: "left",
                      direction: "ltr",
                      padding: "6px 10px",
                    }}
                  >
                    {lineTotal > 0 ? fmt(lineTotal, lang) : "—"}
                  </td>
                  <td style={s.td}>
                    <input
                      value={line.notes}
                      onChange={(e) => updateLine(i, "notes", e.target.value)}
                      placeholder="..."
                      style={s.cellInput}
                    />
                  </td>
                  <td style={{ ...s.td, textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      style={s.iconBtn}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" onClick={addLine} style={s.linkBtn}>
          {t.addLine}
        </button>
      </div>
      {/* summary strip */}
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #eee",
          background: "#f8f9fb",
        }}
      >
        <div
          style={{ flex: 1, padding: "8px 14px", borderLeft: "1px solid #eee" }}
        >
          <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>
            {t.sumArea}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              direction: "ltr",
              textAlign: "left",
            }}
          >
            {fmt(totalArea, lang)} م²
          </div>
        </div>
        <div style={{ flex: 1, padding: "8px 14px" }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>
            {t.sumValue}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#1a6fc4",
              direction: "ltr",
              textAlign: "left",
            }}
          >
            {fmt(totalVal, lang)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function ReplacementCostSection({
  lang,
  lines,
  onLinesChange,
  fields,
  onFieldsChange,
}: {
  lang: Lang;
  lines: ReplacementLine[];
  onLinesChange: (lines: ReplacementLine[]) => void;
  fields: ReplacementFields;
  onFieldsChange: (fields: ReplacementFields) => void;
}) {
  const t = T[lang];

  const set = (key: keyof ReplacementFields) => (val: string) =>
    onFieldsChange({ ...fields, [key]: val });

  // ── derived values ──────────────────────────────────────────────────────────
  const totalArea = lines.reduce((sum, l) => sum + p(l.space), 0);
  const totalVal = lines.reduce((sum, l) => sum + p(l.total || "0"), 0);

  const adminPct = p(fields.managementPct) / 100;
  const profPct = p(fields.professionalPct) / 100;
  const utilPct = p(fields.utilityNetworkPct) / 100;
  const emrgPct = p(fields.emergencyPct) / 100;
  const finPct = p(fields.financePct) / 100;
  const devProfit = p(fields.earningsRate) / 100;

  const effAge = p(fields.buildAge);
  const defAge = p(fields.defaultAge);

  // FIX: Keep raw percentage values (not pre-divided) for totalDep display.
  // The original code divided by 100 here then multiplied by 100 in totalDep,
  // which was correct but confusing. Made consistent and explicit.
  const physPctRaw = p(fields.depreciationPct); // e.g. 10 means 10%
  const econPctRaw = p(fields.economicPct);
  const funcPctRaw = p(fields.careerPct);

  const indirectPct = adminPct + profPct + utilPct + emrgPct + finPct;
  const indirect = totalVal * indirectPct;
  const directTotal = totalVal + indirect;
  const devProfitVal = directTotal * devProfit;
  const assetVal = directTotal + devProfitVal;

  const remLife = Math.max(0, defAge - effAge);

  // FIX: totalDep correctly summed from raw % values, capped at 100
  const totalDep = Math.min(100, physPctRaw + econPctRaw + funcPctRaw);
  const depVal = assetVal * (totalDep / 100);
  const netAsset = assetVal - depVal;
  const netMeter = totalArea > 0 ? netAsset / totalArea : 0;

  const maintVal = p(fields.maintenancePrice);
  const finishVal = p(fields.finishesPrice);

  // FIX: landDataTotal computed once and reused, not duplicated inline
  const landDataTotal = p(fields.meterPriceLand) * p(fields.landSpace);

  const landAsset = landDataTotal + netAsset + maintVal + finishVal;

  // FIX: fmtVal now shows "0.00" for zero values instead of "—",
  // so legitimately-zero computed results are not shown as missing data.
  // Only truly unset / NaN values show "—".
  const fmtVal = (n: number) => (!isFinite(n) ? "—" : fmt(n, lang));

  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
      {/* ── Land header ─────────────────────────────────────────────────────── */}
      <PartHeader title={lang === "ar" ? "بيانات الأرض" : "Land Data"} />
      <div style={s.endingGrid}>
        {/* 1. Title — full width */}
        <div style={{ ...s.endingField, gridColumn: "1 / -1" }}>
          <label style={s.endingLabel}>{t.landTitle}</label>
          <input
            value={fields.landTitle}
            onChange={(e) =>
              onFieldsChange({ ...fields, landTitle: e.target.value })
            }
            placeholder={lang === "ar" ? "عنوان الأرض" : "Land address"}
            style={s.endingInput}
          />
        </div>

        {/* 2. Land meter price */}
        <div style={s.endingField}>
          <label style={s.endingLabel}>{t.meterPriceLand}</label>
          <input
            type="number"
            dir="ltr"
            step="0.01"
            value={fields.meterPriceLand}
            onChange={(e) =>
              onFieldsChange({ ...fields, meterPriceLand: e.target.value })
            }
            placeholder="0.00"
            style={s.endingInput}
          />
        </div>

        {/* 3. Land area */}
        <div style={s.endingField}>
          <label style={s.endingLabel}>{t.landSpace}</label>
          <input
            type="number"
            dir="ltr"
            step="0.01"
            value={fields.landSpace}
            onChange={(e) =>
              onFieldsChange({ ...fields, landSpace: e.target.value })
            }
            placeholder="0.00"
            style={s.endingInput}
          />
        </div>

        {/* 4. Land total — calculated read-only, uses shared landDataTotal */}
        <div style={s.endingField}>
          <label style={s.endingLabel}>{t.landTotal}</label>
          <div
            style={{
              ...s.endingInput,
              background: "#eef4fb",
              border: "1px solid #ccd9ea",
              color: "#1a6fc4",
              fontWeight: 600,
              direction: "ltr",
              display: "flex",
              alignItems: "center",
            }}
          >
            {fmt(landDataTotal, lang)}
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />
      <AreaTable lines={lines} onChange={onLinesChange} lang={lang} t={t} />
      <div style={{ height: 12 }} />

      {/* ── Part 2: Flat ordered rows ────────────────────────────────────────── */}
      <PartHeader title={t.part2Title} />
      {/* 1  */}
      <CalcRow
        label={t.c_totalArea}
        value={totalArea > 0 ? fmt(totalArea, lang) : "—"}
        unit="م²"
      />
      {/* 2  */}
      <CalcRow label={t.c_totalVal} value={fmtVal(totalVal)} />
      {/* 3  */}
      <InputRow
        label={t.managementPct}
        value={fields.managementPct}
        onChange={set("managementPct")}
        unit={t.unitPct}
      />
      {/* 4  */}
      <InputRow
        label={t.professionalPct}
        value={fields.professionalPct}
        onChange={set("professionalPct")}
        unit={t.unitPct}
      />
      {/* 5  */}
      <InputRow
        label={t.utilityNetworkPct}
        value={fields.utilityNetworkPct}
        onChange={set("utilityNetworkPct")}
        unit={t.unitPct}
      />
      {/* 6  */}
      <InputRow
        label={t.emergencyPct}
        value={fields.emergencyPct}
        onChange={set("emergencyPct")}
        unit={t.unitPct}
      />
      {/* 7  */}
      <InputRow
        label={t.financePct}
        value={fields.financePct}
        onChange={set("financePct")}
        unit={t.unitPct}
      />
      {/* 8  */}
      <InputRow
        label={t.yearDev}
        value={fields.yearDev}
        onChange={set("yearDev")}
        unit={t.unitYear}
        isYear
      />
      {/* 9  */}
      <CalcRow label={t.c_indirect} value={fmtVal(indirect)} />
      {/* 10 */}
      <CalcRow label={t.c_direct} value={fmtVal(directTotal)} bold light />
      {/* 11 */}
      <InputRow
        label={t.earningsRate}
        value={fields.earningsRate}
        onChange={set("earningsRate")}
        unit={t.unitPct}
      />
      {/* 12 */}
      <CalcRow label={t.c_devprofitVal} value={fmtVal(devProfitVal)} />
      {/* 13 */}
      <CalcRow label={t.c_assetVal} value={fmtVal(assetVal)} bold light />
      <RowDivider />
      {/* 14 */}
      <InputRow
        label={t.buildAge}
        value={fields.buildAge}
        onChange={set("buildAge")}
        unit={t.unitYear}
        isYear
      />
      {/* 15 */}
      <InputRow
        label={t.defaultAge}
        value={fields.defaultAge}
        onChange={set("defaultAge")}
        unit={t.unitYear}
        isYear
      />
      {/* 16 */}
      <CalcRow
        label={t.c_remlife}
        value={remLife > 0 ? remLife.toFixed(0) : "—"}
        unit={t.unitYear}
      />
      {/* 17 */}
      <InputRow
        label={t.depreciationPct}
        value={fields.depreciationPct}
        onChange={set("depreciationPct")}
        unit={t.unitPct}
      />
      {/* 18 */}
      <InputRow
        label={t.economicPct}
        value={fields.economicPct}
        onChange={set("economicPct")}
        unit={t.unitPct}
      />
      {/* 19 */}
      <InputRow
        label={t.careerPct}
        value={fields.careerPct}
        onChange={set("careerPct")}
        unit={t.unitPct}
      />
      {/* 20 */}
      <CalcRow
        label={t.c_totaldep}
        value={totalDep > 0 ? totalDep.toFixed(2) + "%" : "—"}
      />
      {/* 21 */}
      <CalcRow label={t.c_depVal} value={fmtVal(depVal)} />
      {/* 22 */}
      <CalcRow label={t.c_netAsset} value={fmtVal(netAsset)} bold light />
      {/* 23 */}
      <CalcRow label={t.c_netMeter} value={fmtVal(netMeter)} />
      {/* 24 */}
      <CalcRow
        label={t.c_landAsset}
        value={fmtVal(landAsset)}
        bold
        accent
        light
      />

      <div style={{ height: 12 }} />

      {/* ── Part 3: Ending inputs ────────────────────────────────────────────── */}
      <PartHeader title={t.part3Title} />
      <div style={s.endingGrid}>
        <div style={s.endingField}>
          <label style={s.endingLabel}>{t.maintenancePrice}</label>
          <input
            type="number"
            dir="ltr"
            step="0.01"
            value={fields.maintenancePrice}
            onChange={(e) => set("maintenancePrice")(e.target.value)}
            placeholder="0.00"
            style={s.endingInput}
          />
        </div>

        <div style={s.endingField}>
          <label style={s.endingLabel}>{t.finishesPrice}</label>
          <input
            type="number"
            dir="ltr"
            step="0.01"
            value={fields.finishesPrice}
            onChange={(e) => set("finishesPrice")(e.target.value)}
            placeholder="0.00"
            style={s.endingInput}
          />
        </div>

        <div style={s.endingField}>
          <label style={s.endingLabel}>{t.completionPct}</label>
          <input
            type="number"
            dir="ltr"
            step="0.01"
            max="100"
            value={fields.completionPct}
            onChange={(e) => set("completionPct")(e.target.value)}
            placeholder="0.00"
            style={s.endingInput}
          />
        </div>

        <div style={{ ...s.endingField, gridColumn: "1 / -1" }}>
          <label style={s.endingLabel}>{t.maintenanceDesc}</label>
          <textarea
            rows={2}
            value={fields.maintenanceDesc}
            onChange={(e) => set("maintenanceDesc")(e.target.value)}
            placeholder={t.descPlaceholderMaint}
            style={{ ...s.endingInput, resize: "vertical" }}
          />
        </div>

        <div style={{ ...s.endingField, gridColumn: "1 / -1" }}>
          <label style={s.endingLabel}>{t.finishesDesc}</label>
          <textarea
            rows={2}
            value={fields.finishesDesc}
            onChange={(e) => set("finishesDesc")(e.target.value)}
            placeholder={t.descPlaceholderFinish}
            style={{ ...s.endingInput, resize: "vertical" }}
          />
        </div>

        <div style={{ ...s.endingField, gridColumn: "1 / -1" }}>
          <label style={s.endingLabel}>{t.replacementNotes}</label>
          <textarea
            rows={4}
            value={fields.replacementNotes}
            onChange={(e) => set("replacementNotes")(e.target.value)}
            placeholder={t.notesPlaceholder}
            style={{ ...s.endingInput, resize: "vertical" }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  partHeader: {
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    padding: "8px 14px 6px",
    borderBottom: "1px solid #eee",
    background: "#fafbfc",
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "7px 14px",
    borderBottom: "1px solid #f0f0f0",
    gap: 12,
    minHeight: 40,
    background: "#f8f9fb",
  },
  fieldLabel: {
    fontSize: 13,
    color: "#333",
    flex: 1,
  },
  fieldValue: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  rowInput: {
    width: 130,
    padding: "5px 8px",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontSize: 13,
    background: "#fff",
    color: "#222",
    fontFamily: "inherit",
    textAlign: "left" as const,
    direction: "ltr" as const,
    boxSizing: "border-box" as const,
  },
  calcValue: {
    width: 150,
    padding: "5px 8px",
    background: "#eef4fb",
    border: "1px solid #ccd9ea",
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 500,
    textAlign: "left" as const,
    direction: "ltr" as const,
    color: "#1a6fc4",
    boxSizing: "border-box" as const,
  },
  unitLabel: {
    fontSize: 11,
    color: "#888",
    width: 28,
    textAlign: "center" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    marginBottom: 6,
  },
  th: {
    background: "#f0f4f8",
    border: "1px solid #ddd",
    padding: "6px 8px",
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
    textAlign: "center" as const,
    fontSize: 12,
  },
  td: {
    border: "1px solid #ddd",
    padding: "4px",
    verticalAlign: "middle" as const,
  },
  cellInput: {
    width: "100%",
    padding: "4px 6px",
    border: "1px solid #ddd",
    borderRadius: 3,
    fontSize: 12,
    background: "#fff",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
    color: "#222",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#0066cc",
    cursor: "pointer",
    fontSize: 13,
    padding: "4px 0",
    textDecoration: "underline",
    fontFamily: "inherit",
  },
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 4px",
    color: "#c00",
  },
  endingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 14,
    padding: "14px 16px",
  },
  endingField: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  endingLabel: {
    fontSize: 12,
    color: "#555",
    fontWeight: 500,
  },
  endingInput: {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontSize: 13,
    color: "#222",
    background: "#fff",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  },
};
