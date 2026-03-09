"use client";

import { useContext, useState } from "react";
import { X, Plus, ChevronDown } from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";

// ─── types ────────────────────────────────────────────────────────────────────

export type NewTransactionValues = {
  assignmentNumber: string;
  authorizationNumber: string;
  assignmentDate: string;
  valuationPurpose: string;
  intendedUse: string;
  valuationBasis: string;
  ownershipType: string;
  valuationHypothesis: string;
  client: string;
  branch: string;
  template: string;
};

const EMPTY: NewTransactionValues = {
  assignmentNumber: "",
  authorizationNumber: "",
  assignmentDate: "",
  valuationPurpose: "",
  intendedUse: "",
  valuationBasis: "1",
  ownershipType: "1",
  valuationHypothesis: "1",
  client: "",
  branch: "1",
  template: "",
};

// ─── copy ─────────────────────────────────────────────────────────────────────

const copy = {
  en: {
    newTransaction: "New Transaction",
    modalTitle: "New Transaction",
    assignmentNumber: "Assignment Number",
    assignmentNumberPlaceholder: "Assignment number",
    authorizationNumber: "Authorization Number",
    authorizationNumberPlaceholder: "Authorization number",
    assignmentDate: "Assignment Date",
    valuationPurpose: "Valuation Purpose",
    valuationPurposePlaceholder: "Please select purpose",
    intendedUse: "Intended Use",
    intendedUsePlaceholder: "Intended use",
    valuationBasis: "Value Basis",
    ownershipType: "Ownership Type",
    valuationHypothesis: "Valuation Hypothesis",
    client: "Client",
    clientPlaceholder: "Please select client",
    branch: "Valuation Branch",
    template: "Template",
    templatePlaceholder: "Please select template",
    required: "Required field",
    cancel: "Cancel",
    submit: "Create Transaction",
    realEstateValuation: "Real Estate Valuation",
    machineryValuation: "Machinery & Equipment Valuation",
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
      { value: "11", label: "Litigation" },
      { value: "12", label: "Internal Purposes" },
      { value: "13", label: "Expropriation" },
      { value: "14", label: "Transfer" },
      { value: "15", label: "Inheritance" },
      { value: "16", label: "Other" },
      { value: "17", label: "Estate Distribution" },
      { value: "18", label: "Forced Sale" },
      { value: "19", label: "Market Value Assessment" },
      { value: "20", label: "Rental Value Assessment" },
      { value: "21", label: "Liquidation" },
      { value: "22", label: "Market Value / Rental Value" },
      { value: "23", label: "Fair Value Assessment" },
      { value: "24", label: "Self-Construction" },
      { value: "25", label: "Mortgage - Financing" },
      { value: "26", label: "Premium Residency" },
      { value: "27", label: "Financial Statements" },
      { value: "28", label: "Accounting Purposes" },
      { value: "50", label: "Investment Purposes" },
      { value: "51", label: "Partner Exit" },
      { value: "54", label: "Compensation" },
      { value: "56", label: "Auction Sale" },
    ],
    valuationBases: [
      { value: "1", label: "Market Value" },
      { value: "2", label: "Investment Value" },
      { value: "3", label: "Fair Value" },
      { value: "4", label: "Liquidation Value" },
      { value: "5", label: "Integrated Value" },
      { value: "6", label: "Market Rent" },
      { value: "7", label: "Market Value / Market Rent" },
      { value: "8", label: "Fair Market Value" },
      { value: "10", label: "Inclusion in Financial Statements" },
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
    newTransaction: "معاملة جديدة",
    modalTitle: "معاملة جديدة",
    assignmentNumber: "رقم التكليف",
    assignmentNumberPlaceholder: "رقم التكليف",
    authorizationNumber: "رقم التعميد",
    authorizationNumberPlaceholder: "رقم التعميد",
    assignmentDate: "تاريخ التكليف",
    valuationPurpose: "الغرض من التقييم",
    valuationPurposePlaceholder: "الرجاء اختيار الغرض",
    intendedUse: "الاستخدام المقصود",
    intendedUsePlaceholder: "الاستخدام المقصود",
    valuationBasis: "أساس القيمة",
    ownershipType: "الملكية",
    valuationHypothesis: "فرضية التقييم",
    client: "العميل",
    clientPlaceholder: "الرجاء اختيار العملاء",
    branch: "فرع التقييم",
    template: "النموذج",
    templatePlaceholder: "الرجاء اختيار النموذج",
    required: "حقل مطلوب",
    cancel: "إلغاء",
    submit: "إنشاء المعاملة",
    realEstateValuation: "تقييم العقارات",
    machineryValuation: "تقييم الآلات والمعدات",
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
      { value: "11", label: "تقاضي" },
      { value: "12", label: "أغراض داخلية" },
      { value: "13", label: "نزع الملكية" },
      { value: "14", label: "نقل" },
      { value: "15", label: "ورث" },
      { value: "16", label: "اخرى" },
      { value: "17", label: "توزيع تركه" },
      { value: "18", label: "البيع القسري" },
      { value: "19", label: "معرفة القيمة السوقية" },
      { value: "20", label: "معرفة القيمة الإيجارية" },
      { value: "21", label: "التصفية" },
      { value: "22", label: "معرفة القيمة السوقية / القيمة الإيجارية" },
      { value: "23", label: "معرفة القيمة العادلة" },
      { value: "24", label: "بناء ذاتي" },
      { value: "25", label: "رهن - تمويل" },
      { value: "26", label: "الإقامة المميزة" },
      { value: "27", label: "القوائم المالية" },
      { value: "28", label: "اغراض محاسبية" },
      { value: "29", label: "إذن بيع قاصر" },
      { value: "30", label: "ورثة" },
      { value: "31", label: "قسمة تركة" },
      { value: "32", label: "نزاعات" },
      { value: "33", label: "أذن بيع" },
      { value: "34", label: "الإدراج في القوائم المالية" },
      { value: "35", label: "رهن للتمويل" },
      { value: "36", label: "إذن شراء" },
      { value: "38", label: "الرهن العقاري" },
      { value: "39", label: "فك الرهن" },
      { value: "40", label: "اذن شراء" },
      { value: "41", label: "اذن بيع" },
      { value: "42", label: "الرهن أو التمويل" },
      { value: "43", label: "توزيع ارث بالتراضي" },
      { value: "44", label: "النزاعات والتقاضي - توزيع إرث" },
      { value: "45", label: "توزيع إرث و استخراج نصيب قاصر" },
      { value: "46", label: "طلب أذن بيع نصيب قاصر" },
      { value: "47", label: "اذن شراء نصيب قاصر" },
      { value: "48", label: "انشاء صندوق عقاري" },
      { value: "49", label: "فحص هيئة الزكاة والضريبة والجمارك" },
      { value: "50", label: "أغراض إستثمارية" },
      { value: "51", label: "خروج شريك" },
      { value: "52", label: "تأسيس شركة ذات مسؤولية محدودة" },
      { value: "53", label: "الأعتراض على فاتورة رسوم الأراضي البيضاء" },
      { value: "54", label: "التعويض" },
      { value: "55", label: "اغراض التملك" },
      { value: "56", label: "البيع بالمزاد" },
      { value: "57", label: "دخول شريك" },
      { value: "58", label: "الشراء من مزاد" },
    ],
    valuationBases: [
      { value: "1", label: "القيمة السوقية" },
      { value: "2", label: "القيمة الاستثمارية" },
      { value: "3", label: "القيمة المنصفة" },
      { value: "4", label: "قيمة التصفية" },
      { value: "5", label: "القيمة التكاملية" },
      { value: "6", label: "الايجار السوقي" },
      { value: "7", label: "القيمة السوقية / قيمة الايجار السوقي" },
      { value: "8", label: "القيمة العادلة" },
      { value: "10", label: "الإدراج في القوائم المالية" },
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

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
      {required && <span className="ms-1 text-red-400">*</span>}
    </label>
  );
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
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
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm placeholder:text-slate-300 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
    />
  );
}

// ─── modal ────────────────────────────────────────────────────────────────────

type ModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit?: (values: NewTransactionValues) => void;
};

export function NewTransactionModal({ open, onClose, onSubmit }: ModalProps) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "en";
  const isArabic = language === "ar";
  const t = copy[language];

  const [values, setValues] = useState<NewTransactionValues>(EMPTY);

  const set = <K extends keyof NewTransactionValues>(
    key: K,
    val: NewTransactionValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    onSubmit?.(values);
    onClose();
  };

  const handleClose = () => {
    setValues(EMPTY);
    onClose();
  };

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      {/* Panel */}
      <div
        dir={isArabic ? "rtl" : "ltr"}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {t.modalTitle}
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Assignment Number */}
            <div>
              <FieldLabel required>{t.assignmentNumber}</FieldLabel>
              <TextField
                value={values.assignmentNumber}
                onChange={(v) => set("assignmentNumber", v)}
                placeholder={t.assignmentNumberPlaceholder}
              />
            </div>

            {/* Authorization Number */}
            <div>
              <FieldLabel>{t.authorizationNumber}</FieldLabel>
              <TextField
                value={values.authorizationNumber}
                onChange={(v) => set("authorizationNumber", v)}
                placeholder={t.authorizationNumberPlaceholder}
              />
            </div>

            {/* Assignment Date */}
            <div>
              <FieldLabel required>{t.assignmentDate}</FieldLabel>
              <TextField
                type="date"
                value={values.assignmentDate}
                onChange={(v) => set("assignmentDate", v)}
              />
            </div>

            {/* Valuation Purpose */}
            <div>
              <FieldLabel required>{t.valuationPurpose}</FieldLabel>
              <SelectField
                value={values.valuationPurpose}
                onChange={(v) => set("valuationPurpose", v)}
              >
                <option value="" disabled>
                  {t.valuationPurposePlaceholder}
                </option>
                {t.valuationPurposes.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </SelectField>
            </div>

            {/* Intended Use */}
            <div>
              <FieldLabel>{t.intendedUse}</FieldLabel>
              <TextField
                value={values.intendedUse}
                onChange={(v) => set("intendedUse", v)}
                placeholder={t.intendedUsePlaceholder}
              />
            </div>

            {/* Valuation Basis */}
            <div>
              <FieldLabel required>{t.valuationBasis}</FieldLabel>
              <SelectField
                value={values.valuationBasis}
                onChange={(v) => set("valuationBasis", v)}
              >
                {t.valuationBases.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </SelectField>
            </div>

            {/* Ownership Type */}
            <div>
              <FieldLabel required>{t.ownershipType}</FieldLabel>
              <SelectField
                value={values.ownershipType}
                onChange={(v) => set("ownershipType", v)}
              >
                {t.ownershipTypes.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </div>

            {/* Valuation Hypothesis */}
            <div>
              <FieldLabel required>{t.valuationHypothesis}</FieldLabel>
              <SelectField
                value={values.valuationHypothesis}
                onChange={(v) => set("valuationHypothesis", v)}
              >
                {t.valuationHypotheses.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </SelectField>
            </div>

            {/* Client */}
            <div>
              <FieldLabel required>{t.client}</FieldLabel>
              <TextField
                value={values.client}
                onChange={(v) => set("client", v)}
                placeholder={t.clientPlaceholder}
              />
            </div>

            {/* Branch */}
            <div>
              <FieldLabel required>{t.branch}</FieldLabel>
              <SelectField
                value={values.branch}
                onChange={(v) => set("branch", v)}
              >
                <option value="1">{t.realEstateValuation}</option>
                <option value="3">{t.machineryValuation}</option>
              </SelectField>
            </div>

            {/* Template */}
            <div>
              <FieldLabel required>{t.template}</FieldLabel>
              <SelectField
                value={values.template}
                onChange={(v) => set("template", v)}
              >
                <option value="" disabled>
                  {t.templatePlaceholder}
                </option>
              </SelectField>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
          <button
            onClick={handleClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-cyan-600 px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700"
          >
            {t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── trigger button ───────────────────────────────────────────────────────────

type ButtonProps = {
  onClick: () => void;
  className?: string;
};

export function NewTransactionButton({ onClick, className }: ButtonProps) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "en";
  const t = copy[language];
  const isArabic = language === "ar";

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className={cn("flex", className)}>
      <button
        onClick={onClick}
        className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        {t.newTransaction}
      </button>
    </div>
  );
}
