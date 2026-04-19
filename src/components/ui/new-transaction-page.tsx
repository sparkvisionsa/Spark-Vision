"use client";

import { useContext, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";
import { toApiUrl } from "@/lib/api-url";

// ─── types ────────────────────────────────────────────────────────────────────

export type NewTransactionValues = {
  _id?: string | undefined;
  id?: string | undefined;
  assignmentNumber: string;
  authorizationNumber: string;
  assignmentDate: string;
  valuationPurpose: string;
  intendedUse: string;
  valuationBasis: string;
  ownershipType: string;
  valuationHypothesis: string;
  client: string; // now stores client ID
  branch: string;
  template: string;
  templateFieldValues: Record<string, string>;
};

type ClientOption = { id: string; name: string; formTemplateId: string | null };
type FormFieldDef = {
  id: string;
  label: string;
  fieldType:
    | "text"
    | "number"
    | "date"
    | "textarea"
    | "email"
    | "tel"
    | "file"
    | "select";
  options?: string[];
};

type TemplateOption = { id: string; name: string; fields: FormFieldDef[] }; // extend existing

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
  templateFieldValues: {}, // 👈 add this
};

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

// ─── helpers ──────────────────────────────────────────────────────────────────

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
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 rtl:pl-8 rtl:pr-3"
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

// ─── page ─────────────────────────────────────────────────────────────────────

type PageProps = {
  onBack: () => void;
  onSubmit?: (values: NewTransactionValues) => void;
};

export function NewTransactionPage({ onBack, onSubmit }: PageProps) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "en";
  const isArabic = language === "ar";
  const t = copy[language];
  const [createdTx, setCreatedTx] = useState(null);
  const [values, setValues] = useState<NewTransactionValues>(EMPTY);
  const set = <K extends keyof NewTransactionValues>(
    key: K,
    val: NewTransactionValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: val }));

  // ── remote data ──
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [templateFieldValues, setTemplateFieldValues] = useState<
    Record<string, string | File>
  >({});

  // Reset field values whenever the selected template changes
  const selectedTemplate =
    templates.find((tp) => tp.id === values.template) ?? null;

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateFieldValues({});
      return;
    }
    setTemplateFieldValues((prev) => {
      const next: Record<string, string | File> = {};
      for (const f of selectedTemplate.fields) {
        next[f.id] = prev[f.id] ?? ""; // preserve any already-typed values
      }
      return next;
    });
  }, [values.template]);

  function renderDynamicInput(f: FormFieldDef) {
    const v = templateFieldValues[f.id] ?? "";

    // Handle file type separately to avoid type conflicts
    if (f.fieldType === "file") {
      return (
        <input
          type="file"
          multiple={f.multiple}
          onChange={(e) => {
            const files = e.target.files;
            if (!files?.length) return;
            setTemplateFieldValues((prev) => ({
              ...prev,
              [f.id]: files[0],
            }));
          }}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
        />
      );
    }

    // For non-file fields, ensure we have a string value
    const stringValue = typeof v === "string" ? v : "";
    const onChange = (val: string) =>
      setTemplateFieldValues((prev) => ({ ...prev, [f.id]: val }));

    switch (f.fieldType) {
      case "textarea":
        return (
          <textarea
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder={`${f.label}…`}
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm placeholder:text-slate-300 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          />
        );
      case "select": {
        if (!f.options?.length)
          return (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              No options defined for this field
            </p>
          );
        return (
          <SelectField value={stringValue} onChange={onChange}>
            <option value="" disabled>{`Select ${f.label}`}</option>
            {f.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </SelectField>
        );
      }
      default:
        return (
          <TextField
            type={f.fieldType} // covers text / number / date / email / tel
            value={stringValue}
            onChange={onChange}
            placeholder={f.label}
          />
        );
    }
  }
  useEffect(() => {
    // Fetch clients and templates in parallel on mount
    Promise.all([
      fetch(toApiUrl("/api/clients"), {
        credentials: "include",
        cache: "no-store",
      }).then((r) => r.json()),
      fetch(toApiUrl("/api/form-templates"), {
        credentials: "include",
        cache: "no-store",
      }).then((r) => r.json()),
    ])
      .then(([cls, tpls]: [ClientOption[], TemplateOption[]]) => {
        setClients(cls);
        setTemplates(tpls);
      })
      .catch(console.error)
      .finally(() => setLoadingClients(false));
  }, []);

  // When client changes → auto-select their linked template (or clear it)
  function handleClientChange(clientId: string) {
    set("client", clientId);
  }

  const handleSubmit = async () => {
    try {
      const fd = new FormData();

      // Flat scalar fields
      fd.append("assignmentNumber", values.assignmentNumber);
      fd.append("authorizationNumber", values.authorizationNumber);
      fd.append("assignmentDate", values.assignmentDate);
      fd.append("valuationPurpose", values.valuationPurpose);
      fd.append("intendedUse", values.intendedUse);
      fd.append("valuationBasis", values.valuationBasis);
      fd.append("ownershipType", values.ownershipType);
      fd.append("valuationHypothesis", values.valuationHypothesis);
      fd.append("clientId", values.client);
      fd.append("branch", values.branch);
      if (values.template) fd.append("templateId", values.template);

      for (const [fieldId, val] of Object.entries(templateFieldValues)) {
        if (val instanceof File) {
          // Tell the backend which fieldId this file belongs to
          fd.append(`file__${fieldId}`, val, val.name);
        } else {
          fd.append(`templateFieldValues[${fieldId}]`, val);
        }
      }

      const res = await fetch(toApiUrl("/api/transactions"), {
        method: "POST",
        credentials: "include",
        body: fd, // no Content-Type header — browser sets it with boundary
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? `Error ${res.status}`);
      }

      // AFTER
      const created = await res.json();
      setValues(EMPTY);
      setTemplateFieldValues({});
      onSubmit?.(created); // parent navigates to TransactionEvaluationPage
    } catch (e) {
      // surface the error — swap for your toast if you have one
      alert(e instanceof Error ? e.message : "Failed to save");
    }
  };
  const handleCancel = () => {
    setValues(EMPTY);
    onBack();
  };

  // Templates available for the selected client:
  // if client has a linked template → show only that one
  // if client has no link → show all templates (or none, your call)
  const selectedClient = clients.find((c) => c.id === values.client);
  const availableTemplates: TemplateOption[] = templates;

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="min-h-screen bg-slate-50">
      {/* header — unchanged */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            onClick={handleCancel}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft
              className="h-4 w-4"
              style={{ transform: isArabic ? "scaleX(-1)" : undefined }}
            />
          </button>
          <h1 className="text-base font-semibold text-slate-800">
            {t.modalTitle}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* unchanged fields ... */}
            <div>
              <FieldLabel required>{t.assignmentNumber}</FieldLabel>
              <TextField
                value={values.assignmentNumber}
                onChange={(v) => set("assignmentNumber", v)}
                placeholder={t.assignmentNumberPlaceholder}
              />
            </div>
            <div>
              <FieldLabel>{t.authorizationNumber}</FieldLabel>
              <TextField
                value={values.authorizationNumber}
                onChange={(v) => set("authorizationNumber", v)}
                placeholder={t.authorizationNumberPlaceholder}
              />
            </div>
            <div>
              <FieldLabel required>{t.assignmentDate}</FieldLabel>
              <TextField
                type="date"
                value={values.assignmentDate}
                onChange={(v) => set("assignmentDate", v)}
              />
            </div>
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
            <div>
              <FieldLabel>{t.intendedUse}</FieldLabel>
              <TextField
                value={values.intendedUse}
                onChange={(v) => set("intendedUse", v)}
                placeholder={t.intendedUsePlaceholder}
              />
            </div>
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

            {/* ── CLIENT dropdown (was TextField) ── */}
            <div>
              <FieldLabel required>{t.client}</FieldLabel>
              <SelectField
                value={values.client}
                onChange={handleClientChange}
                disabled={loadingClients}
              >
                <option value="" disabled>
                  {loadingClients ? "…" : t.clientPlaceholder}
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
            </div>

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

            {/* ── TEMPLATE dropdown (now populated) ── */}
            <div>
              <FieldLabel required>{t.template}</FieldLabel>
              <SelectField
                value={values.template}
                onChange={(v) => set("template", v)}
                disabled={!values.client || availableTemplates.length === 0}
              >
                <option value="" disabled>
                  {t.templatePlaceholder}
                </option>
                {availableTemplates.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.name}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        </div>

        {/* ── Dynamic template fields ── */}
        {selectedTemplate && selectedTemplate.fields.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {selectedTemplate.name}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {selectedTemplate.fields.map((f) => (
                <div
                  key={f.id}
                  className={
                    f.fieldType === "textarea"
                      ? "sm:col-span-2 lg:col-span-3"
                      : ""
                  }
                >
                  <FieldLabel>{f.label}</FieldLabel>
                  {renderDynamicInput(f)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* footer — unchanged */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-cyan-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700"
          >
            {t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
