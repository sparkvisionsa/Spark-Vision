"use client";

import { useContext, useState } from "react";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";

// ─── types ────────────────────────────────────────────────────────────────────

export type RealEstateSearchValues = {
  query: string;
  dateType: "created" | "complete";
  dateFrom: string;
  dateTo: string;
  status: string;
  region: string;
  city: string;
  neighborhood: string;
  propertyCategory: string;
  propertyType: string;
  valuationPurpose: string;
  valuationBasis: string;
  ownershipType: string;
  valuationHypothesis: string;
  isDraft: string;
  branch: string;
};

const EMPTY: RealEstateSearchValues = {
  query: "",
  dateType: "created",
  dateFrom: "",
  dateTo: "",
  status: "-1",
  region: "-1",
  city: "",
  neighborhood: "",
  propertyCategory: "-1",
  propertyType: "",
  valuationPurpose: "-1",
  valuationBasis: "-1",
  ownershipType: "-1",
  valuationHypothesis: "-1",
  isDraft: "-1",
  branch: "-1",
};

// ─── copy ─────────────────────────────────────────────────────────────────────

const copy = {
  en: {
    searchPlaceholder: "Reference number, assignment number, deed number…",
    advancedSearch: "Advanced Search",
    hideAdvanced: "Hide",
    search: "Search",
    reset: "Reset",
    dateRange: "Date Range",
    assignmentDate: "Assignment Date",
    approvalDate: "Approval Date",
    from: "From",
    to: "To",
    status: "Status",
    allActive: "Active transactions",
    all: "All",
    new: "New",
    inspection: "Inspection",
    review: "Review",
    audit: "Audit",
    approved: "Approved",
    sent: "Sent",
    cancelled: "Cancelled",
    pending: "Pending",
    region: "Region",
    city: "City",
    cityPlaceholder: "Select city",
    neighborhood: "Neighborhood",
    neighborhoodPlaceholder: "Select neighborhood",
    propertyCategory: "Property Category",
    selectCategory: "Select category",
    lands: "Lands",
    buildings: "Buildings",
    propertyType: "Property Type",
    propertyTypePlaceholder: "Select property type",
    valuationPurpose: "Valuation Purpose",
    valuationBasis: "Value Basis",
    ownershipType: "Ownership Type",
    valuationHypothesis: "Valuation Hypothesis",
    isDraft: "Draft",
    branch: "Branch",
    realEstateValuation: "Real Estate Valuation",
    machineryValuation: "Machinery & Equipment Valuation",
    regions: [
      { value: "1", label: "Riyadh Region" },
      { value: "2", label: "Makkah Region" },
      { value: "3", label: "Madinah Region" },
      { value: "4", label: "Al-Qassim Region" },
      { value: "5", label: "Eastern Province" },
      { value: "6", label: "Asir Region" },
      { value: "7", label: "Tabuk Region" },
      { value: "8", label: "Hail Region" },
      { value: "9", label: "Northern Borders Region" },
      { value: "10", label: "Jizan Region" },
      { value: "11", label: "Najran Region" },
      { value: "12", label: "Al-Baha Region" },
      { value: "13", label: "Al-Jouf Region" },
    ],
    valuationPurposes: [
      { value: "1", label: "Financing" },
      { value: "2", label: "Purchase" },
      { value: "3", label: "Sale" },
      { value: "4", label: "Mortgage" },
      { value: "5", label: "Accounting" },
      { value: "6", label: "Bankruptcy" },
      { value: "7", label: "Acquisition" },
      { value: "8", label: "Financial Reporting" },
      { value: "9", label: "Taxes" },
      { value: "10", label: "Insurance Purposes" },
      { value: "16", label: "Other" },
    ],
    valuationBases: [
      { value: "1", label: "Market Value" },
      { value: "2", label: "Investment Value" },
      { value: "3", label: "Fair Value" },
      { value: "4", label: "Liquidation Value" },
      { value: "5", label: "Integrated Value" },
      { value: "6", label: "Market Rent" },
      { value: "8", label: "Fair Market Value" },
    ],
    ownershipTypes: [
      { value: "1", label: "Freehold" },
      { value: "2", label: "Conditional Ownership" },
      { value: "3", label: "Restricted Ownership" },
      { value: "4", label: "Life Estate" },
      { value: "5", label: "Usufruct" },
      { value: "6", label: "Shared" },
      { value: "7", label: "Mortgaged Ownership" },
    ],
    valuationHypotheses: [
      { value: "1", label: "Current Use" },
      { value: "2", label: "Highest and Best Use" },
      { value: "3", label: "Orderly Liquidation" },
      { value: "4", label: "Forced Sale" },
    ],
  },
  ar: {
    searchPlaceholder: "الرقم المرجعي، رقم التكليف، رقم الصك…",
    advancedSearch: "بحث متقدم",
    hideAdvanced: "إخفاء",
    search: "بحث",
    reset: "إعادة تعيين",
    dateRange: "نطاق التاريخ",
    assignmentDate: "تاريخ التكليف",
    approvalDate: "الاعتماد",
    from: "من",
    to: "إلى",
    status: "الحالة",
    allActive: "معاملات جاري العمل عليها",
    all: "جميع المعاملات",
    new: "جديدة",
    inspection: "المعاينة",
    review: "المراجعة",
    audit: "التدقيق",
    approved: "معتمدة",
    sent: "مرسلة",
    cancelled: "ملغية",
    pending: "معلقة",
    region: "المنطقة",
    city: "المدينة",
    cityPlaceholder: "الرجاء اختيار المدينة",
    neighborhood: "الحي",
    neighborhoodPlaceholder: "الرجاء اختيار الحي",
    propertyCategory: "تصنيف العقار",
    selectCategory: "الرجاء اختيار التصنيف",
    lands: "أراضي",
    buildings: "مباني",
    propertyType: "النوع",
    propertyTypePlaceholder: "الرجاء اختيار نوع العقار",
    valuationPurpose: "الغرض من التقييم",
    valuationBasis: "أساس القيمة",
    ownershipType: "نوع الملكية",
    valuationHypothesis: "فرضية التقييم",
    isDraft: "مسودة",
    branch: "الفرع",
    realEstateValuation: "تقييم العقارات",
    machineryValuation: "تقييم الآلات والمعدات",
    regions: [
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
    ],
    valuationPurposes: [
      { value: "1", label: "التمويل" },
      { value: "2", label: "الشراء" },
      { value: "3", label: "البيع" },
      { value: "4", label: "الرهن" },
      { value: "5", label: "محاسبة" },
      { value: "6", label: "إفلاس" },
      { value: "7", label: "استحواذ" },
      { value: "8", label: "التقرير المالي" },
      { value: "9", label: "الضرائب" },
      { value: "10", label: "الأغراض التأمينية" },
      { value: "16", label: "أخرى" },
    ],
    valuationBases: [
      { value: "1", label: "القيمة السوقية" },
      { value: "2", label: "القيمة الاستثمارية" },
      { value: "3", label: "القيمة المنصفة" },
      { value: "4", label: "قيمة التصفية" },
      { value: "5", label: "القيمة التكاملية" },
      { value: "6", label: "الايجار السوقي" },
      { value: "8", label: "القيمة العادلة" },
    ],
    ownershipTypes: [
      { value: "1", label: "الملكية المطلقة" },
      { value: "2", label: "الملكية المشروطة" },
      { value: "3", label: "الملكية المقيدة" },
      { value: "4", label: "ملكية مدى الحياة" },
      { value: "5", label: "منفعة" },
      { value: "6", label: "مشاع" },
      { value: "7", label: "ملكية مرهونة" },
    ],
    valuationHypotheses: [
      { value: "1", label: "الاستخدام الحالي" },
      { value: "2", label: "الاستخدام الأعلى والأفضل" },
      { value: "3", label: "التصفية المنظمة" },
      { value: "4", label: "البيع القسري" },
    ],
  },
} as const;

// ─── sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </label>
  );
}

function SelectField({
  value,
  onChange,
  children,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="relative">
      <select
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 rtl:pl-8 rtl:pr-3"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 rtl:left-2.5 rtl:right-auto" />
    </div>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm placeholder:text-slate-300 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
    />
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type Props = {
  onSearch?: (values: RealEstateSearchValues) => void;
  className?: string;
};

export function RealEstateSearch({ onSearch, className }: Props) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "en";
  const isArabic = language === "ar";
  const t = copy[language];

  const [values, setValues] = useState<RealEstateSearchValues>(EMPTY);
  const [expanded, setExpanded] = useState(false);

  const set = <K extends keyof RealEstateSearchValues>(
    key: K,
    val: RealEstateSearchValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: val }));

  const handleReset = () => setValues(EMPTY);
  const handleSearch = () => onSearch?.(values);

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {/* SEARCH BAR */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />

        <input
          type="text"
          value={values.query}
          onChange={(e) => set("query", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={t.searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none"
        />

        {values.query && (
          <button
            onClick={() => set("query", "")}
            className="rounded-md p-1 text-slate-300 hover:text-slate-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="mx-2 h-5 w-px bg-slate-200" />

        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            expanded
              ? "bg-cyan-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {expanded ? t.hideAdvanced : t.advancedSearch}
        </button>

        <button
          onClick={handleSearch}
          className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
        >
          {t.search}
        </button>
      </div>

      {/* ADVANCED PANEL */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {/* DATE RANGE */}
              <div className="col-span-2 sm:col-span-3 lg:col-span-2">
                <FieldLabel>{t.dateRange}</FieldLabel>

                <div className="mt-1 flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="radio"
                        checked={values.dateType === "created"}
                        onChange={() => set("dateType", "created")}
                        className="h-4 w-4 accent-cyan-600"
                      />
                      {t.assignmentDate}
                    </label>

                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="radio"
                        checked={values.dateType === "complete"}
                        onChange={() => set("dateType", "complete")}
                        className="h-4 w-4 accent-cyan-600"
                      />
                      {t.approvalDate}
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={values.dateFrom}
                      onChange={(e) => set("dateFrom", e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    />
                    <span className="text-sm text-slate-400">–</span>
                    <input
                      type="date"
                      value={values.dateTo}
                      onChange={(e) => set("dateTo", e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                </div>
              </div>

              {/* STATUS */}
              <div>
                <FieldLabel>{t.status}</FieldLabel>
                <SelectField
                  value={values.status}
                  onChange={(v) => set("status", v)}
                >
                  <option value="-2">{t.allActive}</option>
                  <option value="-1">{t.all}</option>
                  <option value="1">{t.new}</option>
                  <option value="2">{t.inspection}</option>
                  <option value="3">{t.review}</option>
                  <option value="4">{t.audit}</option>
                  <option value="5">{t.approved}</option>
                  <option value="6">{t.sent}</option>
                  <option value="7">{t.cancelled}</option>
                  <option value="8">{t.pending}</option>
                </SelectField>
              </div>

              {/* REGION */}
              <div>
                <FieldLabel>{t.region}</FieldLabel>
                <SelectField
                  value={values.region}
                  onChange={(v) => set("region", v)}
                >
                  <option value="-1">{t.all}</option>
                  {t.regions.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              {/* CITY */}
              <div>
                <FieldLabel>{t.city}</FieldLabel>
                <TextField
                  value={values.city}
                  onChange={(v) => set("city", v)}
                  placeholder={t.cityPlaceholder}
                />
              </div>

              {/* NEIGHBORHOOD */}
              <div>
                <FieldLabel>{t.neighborhood}</FieldLabel>
                <TextField
                  value={values.neighborhood}
                  onChange={(v) => set("neighborhood", v)}
                  placeholder={t.neighborhoodPlaceholder}
                />
              </div>

              {/* PROPERTY CATEGORY */}
              <div>
                <FieldLabel>{t.propertyCategory}</FieldLabel>
                <SelectField
                  value={values.propertyCategory}
                  onChange={(v) => set("propertyCategory", v)}
                >
                  <option value="-1" disabled>
                    {t.selectCategory}
                  </option>
                  <option value="-2">{t.all}</option>
                  <option value="1">{t.lands}</option>
                  <option value="2">{t.buildings}</option>
                </SelectField>
              </div>

              {/* PROPERTY TYPE */}
              <div>
                <FieldLabel>{t.propertyType}</FieldLabel>
                <TextField
                  value={values.propertyType}
                  onChange={(v) => set("propertyType", v)}
                  placeholder={t.propertyTypePlaceholder}
                />
              </div>

              {/* VALUATION PURPOSE */}
              <div>
                <FieldLabel>{t.valuationPurpose}</FieldLabel>
                <SelectField
                  value={values.valuationPurpose}
                  onChange={(v) => set("valuationPurpose", v)}
                >
                  <option value="-1">{t.all}</option>
                  {t.valuationPurposes.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              {/* VALUATION BASIS */}
              <div>
                <FieldLabel>{t.valuationBasis}</FieldLabel>
                <SelectField
                  value={values.valuationBasis}
                  onChange={(v) => set("valuationBasis", v)}
                >
                  <option value="-1">{t.all}</option>
                  {t.valuationBases.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              {/* OWNERSHIP TYPE */}
              <div>
                <FieldLabel>{t.ownershipType}</FieldLabel>
                <SelectField
                  value={values.ownershipType}
                  onChange={(v) => set("ownershipType", v)}
                >
                  <option value="-1">{t.all}</option>
                  {t.ownershipTypes.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              {/* VALUATION HYPOTHESIS */}
              <div>
                <FieldLabel>{t.valuationHypothesis}</FieldLabel>
                <SelectField
                  value={values.valuationHypothesis}
                  onChange={(v) => set("valuationHypothesis", v)}
                >
                  <option value="-1">{t.all}</option>
                  {t.valuationHypotheses.map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              {/* IS DRAFT */}
              <div>
                <FieldLabel>{t.isDraft}</FieldLabel>
                <SelectField
                  value={values.isDraft}
                  onChange={(v) => set("isDraft", v)}
                >
                  <option value="-1">{t.all}</option>
                  <option value="1">{isArabic ? "نعم" : "Yes"}</option>
                  <option value="0">{isArabic ? "لا" : "No"}</option>
                </SelectField>
              </div>

              {/* BRANCH */}
              <div>
                <FieldLabel>{t.branch}</FieldLabel>
                <SelectField
                  value={values.branch}
                  onChange={(v) => set("branch", v)}
                >
                  <option value="-1">{t.all}</option>
                  <option value="1">{t.realEstateValuation}</option>
                  <option value="3">{t.machineryValuation}</option>
                </SelectField>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={handleReset}
                className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700"
              >
                {t.reset}
              </button>

              <button
                onClick={handleSearch}
                className="rounded-lg bg-cyan-600 px-5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
              >
                {t.search}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
