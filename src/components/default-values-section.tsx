"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Plus, Save, X } from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import { toApiUrl } from "@/lib/api-url";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AssignmentNumberConfig, DEFAULT_ASSIGNMENT_CONFIG, formatDatePart,
  generateAssignmentNumber, sequenceCapacity,
} from "@/lib/assignment-number";
import {
  ASSET_CATEGORIES, BRANCHES, BUILD_QUALITIES, BUILDING_CONDITIONS, ELEVATIONS,
  FINISH_LEVELS, INSPECTION_BOUNDARIES, OWNERSHIP_TYPES, STREET_FRONTS, SURROUNDINGS,
  VALUATION_BASES, VALUATION_HYPOTHESES, VALUATION_PURPOSES, type Opt,
} from "@/lib/valuation-options";

type Cfg = AssignmentNumberConfig;
type Values = Record<string, any>;
const PRODUCT = "real-estate-valuation";
const API = `/api/company/default-values?productId=${PRODUCT}`;

// ─── Copy ─────────────────────────────────────────────────────────────────────

const COPY = {
  ar: {
    title: "القيم الافتراضية",
    subtitle: "قيم تُعبّأ تلقائياً عند إنشاء معاملة جديدة",
    tabs: { assignment: "رقم التكليف", transaction: "المعاملة", property: "العقار", valuation: "التقييم", report: "التقرير" },
    groups: {
      details: "بيانات التكليف", people: "الأطراف والمستندات", location: "الموقع", propertyInfo: "بيانات العقار",
      building: "المبنى", services: "الخدمات", surroundings: "المحيط", costs: "التكاليف والرسوم",
      depreciation: "الربحية والتقادم", dates: "التواريخ", authors: "معدّو التقرير", text: "نصوص التقرير",
    },
    none: "— بدون —", today: "اليوم", yes: "نعم", no: "لا", notSet: "—",
    save: "حفظ", saved: "تم الحفظ", saveFail: "فشل الحفظ", loadFail: "تعذر التحميل", unsaved: "تغييرات غير محفوظة",
    next: "الرقم التالي", basedOn: "يعتمد على", srcSequence: "تسلسل", srcDate: "تاريخ", srcBoth: "تاريخ + تسلسل",
    dateFormat: "صيغة التاريخ", example: "مثال", chars: "الأحرف", digits: "أرقام", letters: "حروف", alnum: "الاثنان",
    mode: "التوليد", incremental: "تصاعدي", random: "عشوائي", length: "الطول", start: "البداية",
    reset: "إعادة العدّاد", never: "أبداً", yearly: "سنوياً", monthly: "شهرياً", daily: "يومياً",
    prefix: "البادئة", prefixPh: "اختياري", dashPrefix: "شرطة بعد البادئة", dashParts: "شرطة بين التاريخ والتسلسل",
    warnDate: "التاريخ وحده قد يتكرر في نفس اليوم. أضف تسلسلاً.",
    warnRandom: "العشوائي لا يضمن عدم التكرار. سيتحقق الخادم من التفرد.",
    warnCap: "قيمة البداية أكبر من سعة الطول المحدد.",
    off: "التوليد التلقائي متوقف، سيُدخل المستخدم الرقم يدوياً.",
    autoGen: "توليد تلقائي",
    mTitle: "تغيير نمط رقم التكليف",
    mBody: "هل تريد تغيير رقم التكليف لجميع المعاملات السابقة، أم البدء بتسلسل جديد؟",
    mRenumber: "تغيير أرقام كل المعاملات السابقة",
    mRenumberHint: "تُعاد ترقيم جميع معاملات الشركة حسب الترتيب الزمني وفق النمط الجديد. لا يمكن التراجع.",
    mNew: "البدء بتسلسل جديد",
    mNewHint: "تبقى المعاملات السابقة كما هي، ويُطبّق النمط الجديد من المعاملة القادمة.",
    cancel: "إلغاء",
    assignmentDate: "تاريخ التكليف", valuationPurpose: "الغرض من التقييم", intendedUse: "الاستخدام المقصود",
    valuationBasis: "أساس القيمة", ownershipType: "الملكية", valuationHypothesis: "فرضية التقييم",
    branch: "فرع التقييم", authorizedName: "اسم المفوض بطلب التقييم",
    otherUsers: "المستخدمين الآخرين", deedSource: "مصدر الصك", inspector: "المعاين",
    contactNo: "رقم التواصل", reviewer: "المراجع",
    region: "المنطقة", city: "المدينة", neighborhood: "الحي", assetCategoryId: "تصنيف الأصل",
    elevation: "المنسوب", inspectionBoundaries: "حدود المعاينة", streetWidth: "عرض الشارع",
    streetFronts: "واجهات الشارع", authorizedLandCoverPct: "نسبة التغطية %",
    buildingConditionStatus: "حالة المبنى", finishLevel: "مستوى التشطيب", buildQuality: "حالة البناء",
    electricity: "الكهرباء", sanitaryDrainage: "الصرف الصحي", telephoneLine: "خط الهاتف",
    surroundingEnvironment: "البيئة المحيطة",
    managementPct: "الرسوم الإدارية %", professionalPct: "الرسوم المهنية %", utilityNetworkPct: "شبكة المرافق %",
    emergencyPct: "التكاليف الطارئة %", financePct: "التمويل %", yearDev: "مدة التطوير (سنوات)",
    earningsRate: "هامش ربح المطور %", defaultAge: "العمر الافتراضي", economicPct: "التقادم الاقتصادي %",
    careerPct: "التقادم الوظيفي %", evalDate: "تاريخ المعاينة", completedDate: "تاريخ التقييم", reportDate: "تاريخ التقرير",
    standards: "معايير التقييم", scope: "نطاق البحث والاستقصاء", assumptions: "الافتراضات", risks: "المخاطر وعدم اليقين",
    reportAuthors: "معدّو التقرير", addAuthor: "إضافة معدّ", authorTitle: "المنصب", authorPick: "اختر معدّاً",
  },
  en: {
    title: "Default values",
    subtitle: "Filled in automatically when a new transaction is created",
    tabs: { assignment: "Assignment no.", transaction: "Transaction", property: "Property", valuation: "Valuation", report: "Report" },
    groups: {
      details: "Assignment details", people: "People & documents", location: "Location", propertyInfo: "Property details",
      building: "Building", services: "Services", surroundings: "Surroundings", costs: "Costs & fees",
      depreciation: "Profit & obsolescence", dates: "Dates", authors: "Report authors", text: "Report text",
    },
    none: "— None —", today: "Today", yes: "Yes", no: "No", notSet: "—",
    save: "Save", saved: "Saved", saveFail: "Save failed", loadFail: "Failed to load", unsaved: "Unsaved changes",
    next: "Next number", basedOn: "Based on", srcSequence: "Sequence", srcDate: "Date", srcBoth: "Date + sequence",
    dateFormat: "Date format", example: "Example", chars: "Characters", digits: "Numbers", letters: "Letters", alnum: "Both",
    mode: "Generation", incremental: "Incremental", random: "Random", length: "Length", start: "Start",
    reset: "Reset", never: "Never", yearly: "Yearly", monthly: "Monthly", daily: "Daily",
    prefix: "Prefix", prefixPh: "Optional", dashPrefix: "Dash after prefix", dashParts: "Dash between date and sequence",
    warnDate: "A date alone can repeat within a day. Add a sequence.",
    warnRandom: "Random can't rule out duplicates. The server checks uniqueness.",
    warnCap: "The start value is larger than the chosen length can hold.",
    off: "Auto-generate is off. Users enter the number manually.",
    autoGen: "Auto-generate",
    mTitle: "Assignment number format changed",
    mBody: "Would you like to change the assignment number of all previous transactions, or start a new sequence?",
    mRenumber: "Renumber all previous transactions",
    mRenumberHint: "Every transaction of the company is renumbered in chronological order using the new format. This can't be undone.",
    mNew: "Start a new sequence",
    mNewHint: "Previous transactions keep their numbers. The new format applies from the next transaction.",
    cancel: "Cancel",
    assignmentDate: "Assignment date", valuationPurpose: "Valuation purpose", intendedUse: "Intended use",
    valuationBasis: "Value basis", ownershipType: "Ownership type", valuationHypothesis: "Valuation hypothesis",
    branch: "Valuation branch", authorizedName: "Authorized requester",
    otherUsers: "Other users", deedSource: "Deed source", inspector: "Inspector",
    contactNo: "Contact number", reviewer: "Reviewer",
    region: "Region", city: "City", neighborhood: "Neighborhood", assetCategoryId: "Asset category",
    elevation: "Elevation", inspectionBoundaries: "Inspection boundaries", streetWidth: "Street width",
    streetFronts: "Street fronts", authorizedLandCoverPct: "Land cover %",
    buildingConditionStatus: "Building state", finishLevel: "Finish level", buildQuality: "Build quality",
    electricity: "Electricity", sanitaryDrainage: "Sanitary drainage", telephoneLine: "Telephone line",
    surroundingEnvironment: "Surroundings",
    managementPct: "Management fees %", professionalPct: "Professional fees %", utilityNetworkPct: "Utility network %",
    emergencyPct: "Contingency %", financePct: "Finance %", yearDev: "Development period (yrs)",
    earningsRate: "Developer profit %", defaultAge: "Assumed asset age", economicPct: "Economic obsolescence %",
    careerPct: "Functional obsolescence %", evalDate: "Inspection date", completedDate: "Valuation date", reportDate: "Report date",
    standards: "Valuation standards", scope: "Scope of investigation", assumptions: "Assumptions", risks: "Risks or uncertainty",
    reportAuthors: "Report authors", addAuthor: "Add author", authorTitle: "Title", authorPick: "Select author",
  },
};
type T = (typeof COPY)["en"];

// ─── Field definitions ────────────────────────────────────────────────────────

type Kind = "select" | "text" | "number" | "date" | "tri" | "textarea";
type F = { key: string; kind: Kind; options?: Opt[]; wide?: boolean };
type Group = { id: keyof T["groups"]; fields: F[] };

const num = (keys: string[]): F[] => keys.map((key) => ({ key, kind: "number" as Kind }));
const txt = (keys: string[]): F[] => keys.map((key) => ({ key, kind: "text" as Kind }));

const GROUPS: Record<"transaction" | "property" | "valuation" | "report", Group[]> = {
  transaction: [
    {
      id: "details",
      fields: [
        { key: "assignmentDate", kind: "date" },
        { key: "valuationPurpose", kind: "select", options: VALUATION_PURPOSES },
        { key: "intendedUse", kind: "text" },
        { key: "valuationBasis", kind: "select", options: VALUATION_BASES },
        { key: "ownershipType", kind: "select", options: OWNERSHIP_TYPES },
        { key: "valuationHypothesis", kind: "select", options: VALUATION_HYPOTHESES },
        { key: "branch", kind: "select", options: BRANCHES },
      ],
    },
    { id: "people", fields: txt(["authorizedName", "otherUsers", "deedSource", "inspector", "contactNo", "reviewer"]) },
  ],
  property: [
    {
      id: "propertyInfo",
      fields: [
        { key: "assetCategoryId", kind: "select", options: ASSET_CATEGORIES },
        { key: "elevation", kind: "select", options: ELEVATIONS },
        { key: "inspectionBoundaries", kind: "select", options: INSPECTION_BOUNDARIES },
        { key: "streetWidth", kind: "text" },
        { key: "streetFronts", kind: "select", options: STREET_FRONTS },
        { key: "authorizedLandCoverPct", kind: "number" },
      ],
    },
    {
      id: "building",
      fields: [
        { key: "buildingConditionStatus", kind: "select", options: BUILDING_CONDITIONS },
        { key: "finishLevel", kind: "select", options: FINISH_LEVELS },
        { key: "buildQuality", kind: "select", options: BUILD_QUALITIES },
      ],
    },
    {
      id: "services",
      fields: ["electricity", "sanitaryDrainage", "telephoneLine"].map((key) => ({ key, kind: "tri" as Kind })),
    },
  ],
  valuation: [
    { id: "costs", fields: num(["managementPct", "professionalPct", "utilityNetworkPct", "emergencyPct", "financePct", "yearDev"]) },
    { id: "depreciation", fields: num(["earningsRate", "defaultAge", "economicPct", "careerPct"]) },
    { id: "dates", fields: ["evalDate", "completedDate", "reportDate"].map((key) => ({ key, kind: "date" as Kind })) },
  ],
  report: [
    {
      id: "text",
      fields: ["standards", "scope", "assumptions", "risks"].map((key) => ({ key, kind: "textarea" as Kind, wide: true })),
    },
  ],
};

const EXTRA_KEYS: Record<string, string[]> = {
  property: ["regionId", "cityId", "neighborhoodId", "surroundingEnvironment"],
  report: ["reportAuthors"],
};
const TAB_KEYS: Record<string, string[]> = Object.fromEntries(
  Object.entries(GROUPS).map(([tab, gs]) => [tab, [...gs.flatMap((g) => g.fields.map((f) => f.key)), ...(EXTRA_KEYS[tab] ?? [])]]),
);

// ─── Assignment preview helpers ───────────────────────────────────────────────

type Seg = { kind: "prefix" | "date" | "seq" | "dash"; text: string };
const SEG_CLS: Record<Seg["kind"], string> = {
  prefix: "text-indigo-600", date: "text-amber-600", seq: "text-emerald-600", dash: "text-slate-300",
};

function buildSegments(c: Cfg, index: number, now: Date): Seg[] {
  const segs: Seg[] = [];
  const prefix = c.prefix.trim();
  if (prefix) {
    segs.push({ kind: "prefix", text: prefix });
    if (c.prefixDash) segs.push({ kind: "dash", text: "-" });
  }
  if (c.source !== "sequence") segs.push({ kind: "date", text: formatDatePart(c.dateFormat, now) });
  if (c.source === "both" && c.partDash) segs.push({ kind: "dash", text: "-" });
  if (c.source !== "date") {
    segs.push({
      kind: "seq",
      text: generateAssignmentNumber({ ...c, source: "sequence", prefix: "" }, { counter: c.start + index, now }),
    });
  }
  return segs;
}

function Segs({ segs }: { segs: Seg[] }) {
  return (
    <span dir="ltr" className="font-mono">
      {segs.map((s, i) => <span key={i} className={SEG_CLS[s.kind]}>{s.text}</span>)}
    </span>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

const controlCls =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-800 placeholder:text-slate-300 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
const smallInput =
  "h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-800 placeholder:text-slate-300 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";

function Segmented<V extends string>({
  value, onChange, options, mono,
}: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[]; mono?: boolean }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={cn(
            "rounded-md px-3 py-1 text-[13px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300",
            mono && "font-mono",
            value === o.value ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-slate-600">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-emerald-500" />
      {label}
    </label>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" className="peer sr-only" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300 after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4" />
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-2 border-t border-slate-100 px-5 py-3.5 sm:grid-cols-[9rem_1fr]">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>
    </div>
  );
}

function Cell({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2 lg:col-span-3")}>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 px-5 py-4 first:border-t-0">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function RenumberModal({
  t, busy, onChoose, onCancel,
}: { t: T; busy: boolean; onChoose: (renumber: boolean) => void; onCancel: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onCancel]);

  const Option = ({ title, hint, onClick, danger }: { title: string; hint: string; onClick: () => void; danger?: boolean }) => (
    <button type="button" disabled={busy} onClick={onClick}
      className={cn(
        "w-full rounded-xl border px-4 py-3 text-start transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50",
        danger ? "border-slate-200 hover:border-amber-400 hover:bg-amber-50/50" : "border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50",
      )}>
      <span className="block text-sm font-semibold text-slate-900">{title}</span>
      <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => !busy && onCancel()}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-slate-900">{t.mTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{t.mBody}</p>
        <div className="mt-4 space-y-2">
          <Option danger title={t.mRenumber} hint={t.mRenumberHint} onClick={() => onChoose(true)} />
          <Option title={t.mNew} hint={t.mNewHint} onClick={() => onChoose(false)} />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" disabled={busy} onClick={onCancel}
            className="h-8 rounded-lg px-3 text-[13px] text-slate-500 transition hover:bg-slate-100 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assignment number tab ────────────────────────────────────────────────────

function AssignmentTab({ t, cfg, update }: { t: T; cfg: Cfg; update: (p: Partial<Cfg>) => void }) {
  const hasDate = cfg.source !== "sequence";
  const hasSeq = cfg.source !== "date";
  const now = useMemo(() => new Date(), []);
  const samples = useMemo(() => [0, 1, 2].map((i) => buildSegments(cfg, i, now)), [cfg, now]);

  const warning =
    cfg.source === "date" ? t.warnDate
      : hasSeq && !cfg.incremental ? t.warnRandom
      : hasSeq && cfg.incremental && cfg.start >= sequenceCapacity(cfg) ? t.warnCap
      : null;

  const DATE_FORMATS = ["YYYYMMDD", "YYMMDD", "YYYYMM", "YYYY"] as const;

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-4">
        <h2 className="flex-1 text-[15px] font-semibold text-slate-900">{t.tabs.assignment}</h2>
        <span className="text-[13px] text-slate-500">{t.autoGen}</span>
        <Switch checked={cfg.enabled} onChange={(v) => update({ enabled: v })} label={t.autoGen} />
      </div>

      {!cfg.enabled ? (
        <p className="border-t border-slate-100 px-5 py-6 text-sm text-slate-400">{t.off}</p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-4 border-t border-slate-100 bg-slate-50/70 px-5 py-5">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-medium text-slate-400">{t.next}</p>
              <p className="truncate text-3xl font-semibold tracking-wide">
                {samples[0].length ? <Segs segs={samples[0]} /> : "—"}
              </p>
            </div>
            <div className="hidden shrink-0 flex-col gap-0.5 text-end text-sm text-slate-400 sm:flex" dir="ltr">
              <Segs segs={samples[1]} />
              <Segs segs={samples[2]} />
            </div>
          </div>

          <Row label={t.basedOn}>
            <Segmented value={cfg.source} onChange={(v) => update({ source: v })}
              options={[
                { value: "sequence", label: t.srcSequence },
                { value: "date", label: t.srcDate },
                { value: "both", label: t.srcBoth },
              ]} />
          </Row>

          {hasDate && (
            <Row label={t.dateFormat}>
              <Segmented mono value={cfg.dateFormat} onChange={(v) => update({ dateFormat: v })}
                options={DATE_FORMATS.map((d) => ({ value: d, label: d }))} />
              <span className="text-xs text-slate-400">
                {t.example}: <span dir="ltr" className="font-mono text-amber-600">{formatDatePart(cfg.dateFormat, now)}</span>
              </span>
            </Row>
          )}

          {hasSeq && (
            <>
              <Row label={t.chars}>
                <Segmented value={cfg.charset} onChange={(v) => update({ charset: v })}
                  options={[
                    { value: "digits", label: t.digits },
                    { value: "letters", label: t.letters },
                    { value: "alphanumeric", label: t.alnum },
                  ]} />
              </Row>
              <Row label={t.mode}>
                <Segmented value={cfg.incremental ? "inc" : "rnd"} onChange={(v) => update({ incremental: v === "inc" })}
                  options={[{ value: "inc", label: t.incremental }, { value: "rnd", label: t.random }]} />
                <label className="inline-flex items-center gap-2 text-[13px] text-slate-500">
                  {t.length}
                  <input type="number" min={1} max={12} dir="ltr" className={cn(smallInput, "w-16")} value={cfg.length}
                    onChange={(e) => update({ length: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })} />
                </label>
                {cfg.incremental && (
                  <>
                    <label className="inline-flex items-center gap-2 text-[13px] text-slate-500">
                      {t.start}
                      <input type="number" min={0} dir="ltr" className={cn(smallInput, "w-20")} value={cfg.start}
                        onChange={(e) => update({ start: Math.max(0, Number(e.target.value) || 0) })} />
                    </label>
                    <label className="inline-flex items-center gap-2 text-[13px] text-slate-500">
                      {t.reset}
                      <select className={cn(smallInput, "pe-6")} value={cfg.reset}
                        onChange={(e) => update({ reset: e.target.value as Cfg["reset"] })}>
                        <option value="never">{t.never}</option>
                        <option value="yearly">{t.yearly}</option>
                        <option value="monthly">{t.monthly}</option>
                        <option value="daily">{t.daily}</option>
                      </select>
                    </label>
                  </>
                )}
              </Row>
            </>
          )}

          <Row label={t.prefix}>
            <input dir="ltr" maxLength={12} placeholder={t.prefixPh} className={cn(smallInput, "w-32 font-mono")}
              value={cfg.prefix} onChange={(e) => update({ prefix: e.target.value.replace(/\s/g, "") })} />
            {cfg.prefix.trim() !== "" && <Check checked={cfg.prefixDash} onChange={(v) => update({ prefixDash: v })} label={t.dashPrefix} />}
            {cfg.source === "both" && <Check checked={cfg.partDash} onChange={(v) => update({ partDash: v })} label={t.dashParts} />}
          </Row>

          {warning && (
            <p className="flex items-center gap-2 border-t border-slate-100 bg-amber-50/60 px-5 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              {warning}
            </p>
          )}
        </>
      )}
    </>
  );
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

type Region = { id: string; titleAr: string; titleEn: string };
type City = Region & { regionId: string };
type Hood = Region & { cityId: string };
type Signatory = { id: string; name: string; jobTitle: string };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DefaultValuesSection() {
  const langContext = useContext(LanguageContext);
  const isRtl = (langContext?.language ?? "ar") === "ar";
  const t = isRtl ? COPY.ar : COPY.en;
  const lbl = (o: Opt) => (isRtl ? o.ar : o.en);
  const label = (key: string) => (t as any)[key] as string;

  const [tab, setTab] = useState<keyof T["tabs"]>("assignment");
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_ASSIGNMENT_CONFIG);
  const [savedCfg, setSavedCfg] = useState<Cfg>(DEFAULT_ASSIGNMENT_CONFIG);
  const [values, setValues] = useState<Values>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [askRenumber, setAskRenumber] = useState(false);

  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [hoods, setHoods] = useState<Hood[]>([]);
  const [signatories, setSignatories] = useState<Signatory[]>([]);

  useEffect(() => {
    const get = (url: string) =>
      fetch(toApiUrl(url), { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null));

    get(API)
      .then((d) => {
        if (d?.assignmentNumber) {
          const c = { ...DEFAULT_ASSIGNMENT_CONFIG, ...d.assignmentNumber };
          setCfg(c);
          setSavedCfg(c);
        }
        if (d?.values) setValues(d.values);
      })
      .catch(() => toast({ title: t.loadFail, variant: "destructive" }))
      .finally(() => setLoading(false));

    get("/api/locations/regions").then((d) => Array.isArray(d) && setRegions(d)).catch(() => {});
    get("/api/locations/cities").then((d) => Array.isArray(d) && setCities(d)).catch(() => {});
    get("/api/locations/neighborhoods").then((d) => Array.isArray(d) && setHoods(d)).catch(() => {});
    get(`/api/company/report-defaults?productId=${PRODUCT}`)
      .then((d) => {
        const rows = Array.isArray(d?.reportSignatoryRows) ? d.reportSignatoryRows : [];
        setSignatories(rows.map((r: any) => ({ id: r.id, name: r.name, jobTitle: r.jobTitle ?? "" })));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCfg = (p: Partial<Cfg>) => { setCfg((c) => ({ ...c, ...p })); setDirty(true); };

  /** Empty values remove the key, so "no default" is never stored. */
  const setMany = (patch: Values) => {
    setValues((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        if (v === "" || v == null || (Array.isArray(v) && v.length === 0)) delete next[k];
        else next[k] = v;
      }
      return next;
    });
    setDirty(true);
  };
  const setVal = (key: string, v: any) => setMany({ [key]: v });

  const doSave = async (renumberExisting: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(toApiUrl(API), {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentNumber: cfg, values, renumberExisting }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message);
      }
      setSavedCfg(cfg);
      setDirty(false);
      setAskRenumber(false);
      toast({ title: t.saved });
    } catch (e: any) {
      toast({ title: t.saveFail, description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const needsAsk =
    cfg.enabled && cfg.incremental && cfg.source !== "date" &&
    JSON.stringify(cfg) !== JSON.stringify(savedCfg);

  const onSaveClick = () => (needsAsk ? setAskRenumber(true) : void doSave(false));

  const count = (id: string) =>
    id === "assignment" ? (cfg.enabled ? 1 : 0) : (TAB_KEYS[id] ?? []).filter((k) => values[k] !== undefined).length;

  // ── field renderer ──
  const renderControl = (f: F) => {
    const v = values[f.key] ?? "";
    switch (f.kind) {
      case "select":
        return (
          <select className={controlCls} value={v} onChange={(e) => setVal(f.key, e.target.value)}>
            <option value="">{t.none}</option>
            {f.options!.map((o) => <option key={o.value} value={o.value}>{lbl(o)}</option>)}
          </select>
        );
      case "date":
        return (
          <Segmented value={v === "today" ? "today" : "none"} onChange={(x) => setVal(f.key, x === "today" ? "today" : "")}
            options={[{ value: "none", label: t.none }, { value: "today", label: t.today }]} />
        );
      case "tri":
        return (
          <Segmented value={v || "none"} onChange={(x) => setVal(f.key, x === "none" ? "" : x)}
            options={[{ value: "none", label: t.notSet }, { value: "yes", label: t.yes }, { value: "no", label: t.no }]} />
        );
      case "textarea":
        return (
          <textarea rows={2} className={cn(controlCls, "h-auto resize-y py-2")} value={v}
            onChange={(e) => setVal(f.key, e.target.value)} />
        );
      case "number":
        return <input type="number" dir="ltr" className={controlCls} value={v} onChange={(e) => setVal(f.key, e.target.value)} />;
      default:
        return <input className={controlCls} value={v} onChange={(e) => setVal(f.key, e.target.value)} />;
    }
  };

  const renderGroup = (g: Group) => (
    <Block key={g.id} title={t.groups[g.id]}>
      {g.fields.map((f) => <Cell key={f.key} label={label(f.key)} wide={f.wide}>{renderControl(f)}</Cell>)}
    </Block>
  );

  // ── location cascade ──
  const citiesFor = values.regionId ? cities.filter((c) => c.regionId === values.regionId) : cities;
  const hoodsFor = values.cityId ? hoods.filter((h) => h.cityId === values.cityId) : hoods;
  const name = (x: Region) => (isRtl ? x.titleAr : x.titleEn);

  const locationBlock = (
    <Block title={t.groups.location}>
      <select className={controlCls} value={values.regionId ?? ""}
        onChange={(e) => {
          const r = regions.find((x) => x.id === e.target.value);
          setMany({ regionId: r?.id ?? "", regionName: r?.titleAr ?? "", cityId: "", cityName: "", neighborhoodId: "", neighborhoodName: "" });
        }}>
        <option value="">{t.region}</option>
        {regions.map((r) => <option key={r.id} value={r.id}>{name(r)}</option>)}
      </select>
      <select className={controlCls} value={values.cityId ?? ""}
        onChange={(e) => {
          const c = cities.find((x) => x.id === e.target.value);
          setMany({ cityId: c?.id ?? "", cityName: c?.titleAr ?? "", neighborhoodId: "", neighborhoodName: "" });
        }}>
        <option value="">{t.city}</option>
        {citiesFor.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}
      </select>
      <select className={controlCls} value={values.neighborhoodId ?? ""}
        onChange={(e) => {
          const h = hoods.find((x) => x.id === e.target.value);
          setMany({ neighborhoodId: h?.id ?? "", neighborhoodName: h?.titleAr ?? "" });
        }}>
        <option value="">{t.neighborhood}</option>
        {hoodsFor.map((h) => <option key={h.id} value={h.id}>{name(h)}</option>)}
      </select>
    </Block>
  );

  const envList: string[] = values.surroundingEnvironment ?? [];
  const envBlock = (
    <Block title={t.groups.surroundings}>
      <div className="flex flex-wrap gap-x-5 gap-y-2.5 sm:col-span-2 lg:col-span-3">
        {SURROUNDINGS.map((o) => (
          <Check key={o.value} label={lbl(o)} checked={envList.includes(o.value)}
            onChange={(on) => setVal("surroundingEnvironment", on ? [...envList, o.value] : envList.filter((x) => x !== o.value))} />
        ))}
      </div>
    </Block>
  );

  // ── report authors ──
  const authors: { signatoryId: string; title: string }[] = values.reportAuthors ?? [];
  const setAuthors = (list: typeof authors) => setVal("reportAuthors", list);
  const authorsBlock = (
    <Block title={t.groups.authors}>
      <div className="space-y-2 sm:col-span-2 lg:col-span-3">
        {authors.map((a, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <select className={controlCls} value={a.signatoryId}
              onChange={(e) => {
                const s = signatories.find((x) => x.id === e.target.value);
                setAuthors(authors.map((x, j) => (j === i ? { signatoryId: e.target.value, title: s?.jobTitle ?? x.title } : x)));
              }}>
              <option value="">{t.authorPick}</option>
              {signatories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className={controlCls} placeholder={t.authorTitle} value={a.title}
              onChange={(e) => setAuthors(authors.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <button type="button" aria-label="remove" onClick={() => setAuthors(authors.filter((_, j) => j !== i))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-red-500">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setAuthors([...authors, { signatoryId: "", title: "" }])}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 text-[13px] text-slate-500 transition hover:border-emerald-400 hover:text-emerald-600">
          <Plus className="h-3.5 w-3.5" />
          {t.addAuthor}
        </button>
      </div>
    </Block>
  );

  const tabIds = ["assignment", "transaction", "property", "valuation", "report"] as const;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t.title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{t.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {dirty && (
            <span className="hidden items-center gap-1.5 text-xs text-amber-600 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {t.unsaved}
            </span>
          )}
          <button onClick={onSaveClick} disabled={!dirty || saving || loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-[13px] font-medium text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:bg-slate-100 disabled:text-slate-400">
            {saving && !askRenumber ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t.save}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-300"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
            {tabIds.map((id) => {
              const n = count(id);
              const active = tab === id;
              return (
                <button key={id} type="button" onClick={() => setTab(id)}
                  className={cn(
                    "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm transition focus:outline-none focus-visible:bg-slate-50",
                    active ? "border-emerald-500 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800",
                  )}>
                  {t.tabs[id]}
                  {n > 0 && (
                    <span className={cn("rounded-full px-1.5 text-[11px] font-medium leading-5",
                      active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {tab === "assignment" && <AssignmentTab t={t} cfg={cfg} update={updateCfg} />}
            {tab === "transaction" && GROUPS.transaction.map(renderGroup)}
            {tab === "property" && (
              <>
                {locationBlock}
                {GROUPS.property.map(renderGroup)}
                {envBlock}
              </>
            )}
            {tab === "valuation" && GROUPS.valuation.map(renderGroup)}
            {tab === "report" && (
              <>
                {authorsBlock}
                {GROUPS.report.map(renderGroup)}
              </>
            )}
          </section>
        </>
      )}

      {askRenumber && (
        <RenumberModal t={t} busy={saving} onChoose={(r) => void doSave(r)} onCancel={() => setAskRenumber(false)} />
      )}
    </div>
  );
}
