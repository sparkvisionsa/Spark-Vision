"use client";

import { useContext, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Scan,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  FileImage,
  Building2,
  ClipboardList,
  Camera,
  Send,
  ExternalLink,
  Upload,
  ShieldCheck,
  Paperclip,
} from "lucide-react";
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
  client: string;
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
  multiple?: boolean;
};

type TemplateOption = { id: string; name: string; fields: FormFieldDef[] };

// OCR extracted data shape
type OcrResult = {
  deedNumber?: string;
  deedDate?: string;
  previousDeedDate?: string;
  operationType?: string;
  ownerId?: string;
  ownerName?: string;
  ownerNationality?: string;
  ownershipPercentage?: string;
  propertyType?: string;
  propertyArea?: string;
  landUse?: string;
  parcelNumber?: string;
  cityName?: string;
  neighborhoodName?: string;
  planNumber?: string;
  plotNumber?: string;
  ownershipStatus?: string;
  propertyModel?: string;
  locationDescription?: string;
  northBoundary?: string;
  northLength?: string;
  southBoundary?: string;
  southLength?: string;
  eastBoundary?: string;
  eastLength?: string;
  westBoundary?: string;
  westLength?: string;
  confidence?: Record<string, number>;
  rawText?: string;
};

// Maps OCR field → template field label (for non-general templates)
const OCR_TO_TEMPLATE_LABEL: Record<
  keyof Omit<OcrResult, "confidence" | "rawText">,
  string | null
> = {
  deedNumber: "رقم الصك",
  deedDate: "تاريخ الصك",
  previousDeedDate: null,
  operationType: null,
  ownerId: null,
  ownerName: "اسم المالك",
  ownerNationality: null,
  ownershipPercentage: null,
  propertyType: "نوع الأصل",
  propertyArea: "مساحة الأصل",
  landUse: "الاستخدام",
  parcelNumber: "رقم القطعة",
  cityName: "المدينة",
  neighborhoodName: "الحي",
  planNumber: "رقم المخطط",
  plotNumber: "رقم البلوك",
  ownershipStatus: null,
  propertyModel: null,
  locationDescription: "العنوان",
  northBoundary: "الحد الشمالي",
  northLength: "طول الحد الشمالي",
  southBoundary: "الحد الجنوبي",
  southLength: "طول الحد الجنوبي",
  eastBoundary: "الحد الشرقي",
  eastLength: "طول الحد الشرقي",
  westBoundary: "الحد الغربي",
  westLength: "طول الحد الغربي",
};

// Maps OCR field → evalData field key (for قالب عام)
const OCR_TO_EVAL_DATA: Record<
  keyof Omit<OcrResult, "confidence" | "rawText">,
  string | null
> = {
  deedNumber: "deedNumber",
  deedDate: "deedDate",
  previousDeedDate: null,
  operationType: null,
  ownerId: null,
  ownerName: "ownerName",
  ownerNationality: null,
  ownershipPercentage: null,
  propertyType: "propertyType",
  propertyArea: "propertyArea",
  landUse: "landUse",
  parcelNumber: null,
  cityName: "cityName",
  neighborhoodName: "neighborhoodName",
  regionName: "regionName",
  planNumber: null,
  plotNumber: null,
  ownershipStatus: null,
  propertyModel: null,
  locationDescription: "address",
  northBoundary: "northBoundary",
  northLength: "northLength",
  southBoundary: "southBoundary",
  southLength: "southLength",
  eastBoundary: "eastBoundary",
  eastLength: "eastLength",
  westBoundary: "westBoundary",
  westLength: "westLength",
};

const LABEL_TO_EVAL_KEY: Record<string, string> = {
  "رقم الصك": "deedNumber",
  "تاريخ الصك": "deedDate",
  "اسم المالك": "ownerName",
  "نوع الأصل": "propertyType",
  "نوع العقار": "propertyType",
  "مساحة الأصل": "propertyArea",
  "مساحة العقار": "propertyArea",
  الاستخدام: "landUse",
  المدينة: "cityName",
  الحي: "neighborhoodName",
  العنوان: "address",
  "الحد الشمالي": "northBoundary",
  "طول الحد الشمالي": "northLength",
  "الحد الجنوبي": "southBoundary",
  "طول الحد الجنوبي": "southLength",
  "الحد الشرقي": "eastBoundary",
  "طول الحد الشرقي": "eastLength",
  "الحد الغربي": "westBoundary",
  "طول الحد الغربي": "westLength",
  "رمز العقار": "propertyCode",
  "اسم العميل": "clientName",
  "اسم المفوض بطلب التقييم": "authorizedName",
  "رقم القطعة": "parcelNumber",
  "رقم المخطط": "planNumber",
  "رقم البلوك": "plotNumber",
  المنطقة: "regionId",
  المعاين: "inspector",
  "رقم التواصل": "contactNo",
  المراجع: "reviewer",
  "حالة المبنى": "buildingState",
  "عدد الادوار": "floorsCount",
  "عمر العقار": "propertyAge",
  "مستوى التشطيب": "finishLevel",
  "حالة البناء": "buildQuality",
  الشارع: "street",
};

const GENERAL_TEMPLATE_NAME_AR = "قالب عام";
const SREM_DEED_INQUIRY_URL = "https://srem.moj.gov.sa/deed-inquiry";

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
  templateFieldValues: {},
};

// ─── i18n ─────────────────────────────────────────────────────────────────────

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
    stepBasic: "Basic Info",
    stepTemplate: "Template",
    stepScan: "Deed Scan",
    stepReview: "Review & Submit",
    stepBasicDesc: "Fill in the core assignment details",
    stepTemplateDesc: "Select the evaluation template",
    stepScanDesc: "Scan the property deed (optional)",
    stepReviewDesc: "Review extracted data and submit",
    next: "Next →",
    back: "← Back",
    skipScan: "Skip — Enter Manually",
    ocrStepTitle: "Upload Property Deed",
    ocrStepSubtitle:
      "Upload a deed image to auto-fill property fields, or skip to enter manually.",
    ocrDropPrompt: "Drop deed image here",
    ocrDropSub: "PNG, JPG up to 20MB",
    ocrBrowse: "Browse file",
    ocrScanBtn: "Scan Deed",
    ocrScanning: "Scanning deed...",
    ocrSuccess: "Data extracted successfully",
    ocrError: "Scan failed",
    ocrRetry: "Try another image",
    ocrContinue: "Continue with extracted data",
    ocrFieldsFound: "fields extracted",
    ocrConfidence: "confidence",
    reviewTitle: "Review & Fill Fields",
    reviewSubtitle:
      "Fields pre-filled from deed scan are highlighted in green. Fill in any remaining fields before submitting.",
    reviewSubtitleNoOcr: "Fill in the fields below manually before submitting.",
    generalTemplateNote:
      "Using General Template — all values will be saved directly to the evaluation data.",
    ocrBadge: "OCR",
    errAssignmentNumber: "Assignment number is required",
    errClient: "Client is required",
    errTemplate: "Template is required",
    // Deed verification section
    deedVerificationTitle: "Deed Verification",
    deedVerificationDesc:
      "Verify the property deed on the Ministry of Justice portal, then upload the verified deed image here as an attachment.",
    deedVerificationBtn: "Open Deed Inquiry Portal",
    deedVerificationNote:
      "You will be redirected to srem.moj.gov.sa. After verifying your deed number and downloading the official deed image, return here to upload it.",
    deedAttachmentTitle: "Upload Verified Deed Image",
    deedAttachmentDesc:
      "After verifying on the SREM portal, upload the deed image here.",
    deedAttachmentDrop: "Drop verified deed image here",
    deedAttachmentSub: "PNG, JPG, PDF up to 20MB",
    deedAttachmentBrowse: "Choose file",
    deedAttachmentUploaded: "Deed image attached",
    deedAttachmentRemove: "Remove",
    deedAttachmentOptional: "Optional — you can also submit and attach later.",
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
      { value: "50", label: "Investment Purposes" },
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
    stepBasic: "البيانات الأساسية",
    stepTemplate: "النموذج",
    stepScan: "مسح الصك",
    stepReview: "المراجعة والإرسال",
    stepBasicDesc: "أدخل بيانات التكليف الأساسية",
    stepTemplateDesc: "اختر نموذج التقييم",
    stepScanDesc: "ارفع صورة الصك (اختياري)",
    stepReviewDesc: "راجع البيانات المستخرجة وأرسل",
    next: "التالي ←",
    back: "→ السابق",
    skipScan: "تخطّي — إدخال يدوي",
    ocrStepTitle: "رفع صورة الصك",
    ocrStepSubtitle:
      "ارفع صورة الصك لاستخراج بيانات العقار تلقائياً، أو تخطَّ هذه الخطوة للإدخال اليدوي.",
    ocrDropPrompt: "أسقط صورة الصك هنا",
    ocrDropSub: "PNG أو JPG بحجم أقصاه 20 ميجابايت",
    ocrBrowse: "اختر ملفاً",
    ocrScanBtn: "مسح الصك",
    ocrScanning: "جاري المسح...",
    ocrSuccess: "تم استخراج البيانات بنجاح",
    ocrError: "فشل المسح",
    ocrRetry: "جرّب صورة أخرى",
    ocrContinue: "المتابعة بالبيانات المستخرجة",
    ocrFieldsFound: "حقول مستخرجة",
    ocrConfidence: "دقة الاستخراج",
    reviewTitle: "مراجعة الحقول وإكمالها",
    reviewSubtitle:
      "الحقول المميزة باللون الأخضر تم ملؤها من الصك. أكمل الحقول المتبقية قبل الإرسال.",
    reviewSubtitleNoOcr: "أدخل البيانات في الحقول أدناه قبل الإرسال.",
    generalTemplateNote:
      "القالب العام — جميع القيم ستُحفظ مباشرةً في بيانات التقييم.",
    ocrBadge: "صك",
    errAssignmentNumber: "رقم التكليف مطلوب",
    errClient: "العميل مطلوب",
    errTemplate: "النموذج مطلوب",
    // Deed verification section
    deedVerificationTitle: "التحقق من الصك",
    deedVerificationDesc:
      "تحقق من صك العقار عبر بوابة وزارة العدل، ثم ارفع صورة الصك الموثق هنا كمرفق.",
    deedVerificationBtn: "فتح بوابة الاستعلام عن الصكوك",
    deedVerificationNote:
      "سيتم توجيهك إلى srem.moj.gov.sa. بعد التحقق من رقم صكك وتنزيل صورة الصك الرسمية، عُد إلى هنا لرفعها.",
    deedAttachmentTitle: "رفع صورة الصك الموثق",
    deedAttachmentDesc: "بعد التحقق من بوابة SREM، ارفع صورة الصك هنا.",
    deedAttachmentDrop: "أسقط صورة الصك الموثق هنا",
    deedAttachmentSub: "PNG أو JPG أو PDF بحجم أقصاه 20 ميجابايت",
    deedAttachmentBrowse: "اختر ملفاً",
    deedAttachmentUploaded: "تم إرفاق صورة الصك",
    deedAttachmentRemove: "إزالة",
    deedAttachmentOptional: "اختياري — يمكنك الإرسال وإرفاق الصك لاحقاً.",
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
      { value: "50", label: "أغراض إستثمارية" },
      { value: "54", label: "التعويض" },
      { value: "56", label: "البيع بالمزاد" },
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

// ─── Step definitions ─────────────────────────────────────────────────────────

type Step = "basic" | "template" | "scan" | "review";
const STEPS: Step[] = ["basic", "template", "scan", "review"];

const STEP_ICONS = {
  basic: ClipboardList,
  template: Building2,
  scan: Camera,
  review: Send,
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function resolveEvalKey(label: string, fieldId: string): string {
  return LABEL_TO_EVAL_KEY[label] ?? fieldId;
}

// ─── Shared UI components ─────────────────────────────────────────────────────

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  error?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full appearance-none rounded-lg border bg-white py-2.5 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 rtl:pl-8 rtl:pr-3",
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-cyan-400 focus:ring-cyan-100",
        )}
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
  highlight = false,
  error = false,
  readOnly = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  highlight?: boolean;
  error?: boolean;
  readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={cn(
        "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-300 transition focus:outline-none focus:ring-2",
        highlight
          ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200 focus:border-emerald-400 focus:ring-emerald-100"
          : error
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-cyan-400 focus:ring-cyan-100",
        readOnly && "cursor-default bg-slate-50",
      )}
    />
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  current,
  t,
}: {
  current: Step;
  t: (typeof copy)["ar"];
}) {
  const currentIdx = STEPS.indexOf(current);

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const Icon = STEP_ICONS[step];
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        const label =
          step === "basic"
            ? t.stepBasic
            : step === "template"
              ? t.stepTemplate
              : step === "scan"
                ? t.stepScan
                : t.stepReview;

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                  isDone
                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                    : isActive
                      ? "bg-cyan-600 text-white shadow-sm shadow-cyan-200"
                      : "bg-slate-100 text-slate-400",
                )}
              >
                {isDone ? "✓" : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span
                className={cn(
                  "hidden text-[10px] font-semibold sm:block",
                  isActive
                    ? "text-slate-800"
                    : isDone
                      ? "text-emerald-600"
                      : "text-slate-400",
                )}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 mb-4 h-px w-10 transition-colors duration-300 sm:w-16",
                  idx < currentIdx ? "bg-emerald-400" : "bg-slate-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Basic Info ───────────────────────────────────────────────────────

function StepBasic({
  values,
  set,
  t,
  errors,
  clearError,
}: {
  values: NewTransactionValues;
  set: <K extends keyof NewTransactionValues>(
    k: K,
    v: NewTransactionValues[K],
  ) => void;
  t: (typeof copy)["ar"];
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">{t.stepBasic}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{t.stepBasicDesc}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <FieldLabel required>{t.assignmentNumber}</FieldLabel>
            <TextField
              value={values.assignmentNumber}
              onChange={(v) => {
                set("assignmentNumber", v);
                clearError("assignmentNumber");
              }}
              placeholder={t.assignmentNumberPlaceholder}
              error={!!errors.assignmentNumber}
            />
            {errors.assignmentNumber && (
              <p className="mt-1 text-xs text-red-500">
                {errors.assignmentNumber}
              </p>
            )}
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
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Template Selection ───────────────────────────────────────────────

function StepTemplate({
  values,
  set,
  clients,
  templates,
  loadingClients,
  t,
  errors,
  clearError,
  isArabic,
}: {
  values: NewTransactionValues;
  set: <K extends keyof NewTransactionValues>(
    k: K,
    v: NewTransactionValues[K],
  ) => void;
  clients: ClientOption[];
  templates: TemplateOption[];
  loadingClients: boolean;
  t: (typeof copy)["ar"];
  errors: Record<string, string>;
  clearError: (k: string) => void;
  isArabic: boolean;
}) {
  const selectedTemplate =
    templates.find((tp) => tp.id === values.template) ?? null;
  const isGeneral = selectedTemplate?.name === GENERAL_TEMPLATE_NAME_AR;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">{t.stepTemplate}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{t.stepTemplateDesc}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel required>{t.client}</FieldLabel>
            <SelectField
              value={values.client}
              onChange={(v) => {
                set("client", v);
                set("template", "");
                clearError("client");
              }}
              disabled={loadingClients}
              error={!!errors.client}
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
            {errors.client && (
              <p className="mt-1 text-xs text-red-500">{errors.client}</p>
            )}
          </div>

          <div>
            <FieldLabel required>{t.template}</FieldLabel>
            <SelectField
              value={values.template}
              onChange={(v) => {
                set("template", v);
                clearError("template");
              }}
              disabled={!values.client || templates.length === 0}
              error={!!errors.template}
            >
              <option value="" disabled>
                {t.templatePlaceholder}
              </option>
              {templates.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.name}
                </option>
              ))}
            </SelectField>
            {errors.template && (
              <p className="mt-1 text-xs text-red-500">{errors.template}</p>
            )}
          </div>
        </div>
      </div>

      {selectedTemplate && (
        <div
          className={cn(
            "rounded-2xl border p-5",
            isGeneral
              ? "border-amber-200 bg-amber-50"
              : "border-cyan-100 bg-cyan-50",
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm",
                isGeneral
                  ? "bg-amber-100 text-amber-700"
                  : "bg-cyan-100 text-cyan-700",
              )}
            >
              {isGeneral ? "⚡" : "📋"}
            </div>
            <div>
              <p
                className={cn(
                  "font-semibold",
                  isGeneral ? "text-amber-800" : "text-cyan-800",
                )}
              >
                {selectedTemplate.name}
              </p>
              {isGeneral ? (
                <p className="mt-0.5 text-xs text-amber-700">
                  {isArabic
                    ? "القالب العام — جميع القيم ستُحفظ مباشرةً في بيانات التقييم."
                    : "General Template — all values will be saved directly to evalData."}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-cyan-700">
                  {isArabic
                    ? `${selectedTemplate.fields.length} حقول في النموذج`
                    : `${selectedTemplate.fields.length} template fields`}
                </p>
              )}
            </div>
          </div>

          {!isGeneral && selectedTemplate.fields.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {selectedTemplate.fields.slice(0, 10).map((f) => (
                <span
                  key={f.id}
                  className="rounded-md border border-cyan-200 bg-white px-2 py-0.5 text-[10px] font-medium text-cyan-700"
                >
                  {f.label}
                </span>
              ))}
              {selectedTemplate.fields.length > 10 && (
                <span className="rounded-md border border-cyan-200 bg-white px-2 py-0.5 text-[10px] text-cyan-500">
                  +{selectedTemplate.fields.length - 10}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: OCR Scan ─────────────────────────────────────────────────────────

type OcrScanState =
  | { phase: "idle" }
  | { phase: "selected"; file: File; preview: string }
  | { phase: "scanning" }
  | { phase: "done"; result: OcrResult; file: File; preview: string }
  | { phase: "error"; message: string };

function StepScan({
  t,
  onScanned,
  onSkip,
}: {
  t: (typeof copy)["ar"];
  onScanned: (result: OcrResult, file?: File) => void;
  onSkip: () => void;
}) {
  const [state, setState] = useState<OcrScanState>({ phase: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const preview = URL.createObjectURL(file);
    setState({ phase: "selected", file, preview });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleReset = () => {
    if (state.phase === "selected" || state.phase === "done") {
      URL.revokeObjectURL((state as any).preview);
    }
    setState({ phase: "idle" });
  };

  const handleScan = async () => {
    if (state.phase !== "selected") return;
    const { file, preview } = state;
    setState({ phase: "scanning" });

    try {
      const fd = new FormData();
      fd.append("files[]", file, file.name);
      const res = await fetch(toApiUrl(`/api/transactions/ocr-preview/ocr`), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? `Error ${res.status}`);
      }
      const result: OcrResult = await res.json();
      setState({ phase: "done", result, file, preview });
    } catch (e) {
      setState({
        phase: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  const extractedCount =
    state.phase === "done"
      ? Object.entries(state.result)
          .filter(([k]) => k !== "confidence" && k !== "rawText")
          .filter(([, v]) => v && String(v).trim() !== "").length
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">{t.ocrStepTitle}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{t.ocrStepSubtitle}</p>
      </div>
      {(state.phase === "idle" || state.phase === "error") && (
        <>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-8 py-16 text-center transition hover:border-cyan-300 hover:bg-cyan-50"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm transition group-hover:shadow-md">
              <FileImage className="h-8 w-8 text-slate-300 transition group-hover:text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">
                {t.ocrDropPrompt}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{t.ocrDropSub}</p>
            </div>
            <span className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition group-hover:border-cyan-200 group-hover:text-cyan-700">
              {t.ocrBrowse}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                e.target.files?.[0] && handleFile(e.target.files[0])
              }
            />
          </div>

          {state.phase === "error" && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {t.ocrError}: {state.message}
              </span>
            </div>
          )}
        </>
      )}
      {state.phase === "selected" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative">
            <img
              src={state.preview}
              alt="deed preview"
              className="max-h-72 w-full bg-slate-100 object-contain"
            />
            <button
              type="button"
              onClick={handleReset}
              className="absolute right-3 top-3 rounded-full bg-white/80 p-1.5 text-slate-500 backdrop-blur-sm hover:bg-white hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 p-4">
            <span className="truncate text-sm font-medium text-slate-600">
              {state.file.name}
            </span>
            <button
              type="button"
              onClick={handleScan}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-cyan-700"
            >
              <Scan className="h-3.5 w-3.5" />
              {t.ocrScanBtn}
            </button>
          </div>
        </div>
      )}
      {state.phase === "scanning" && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white py-16 shadow-sm">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-cyan-100" />
            <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-cyan-500" />
          </div>
          <p className="text-sm font-medium text-slate-500">{t.ocrScanning}</p>
        </div>
      )}
      {state.phase === "done" && (
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-4">
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                {t.ocrSuccess}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {extractedCount} {t.ocrFieldsFound}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 p-4">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300"
            >
              {t.ocrRetry}
            </button>
            <button
              type="button"
              onClick={() => onScanned(state.result, state.file)}
              className="rounded-lg bg-cyan-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700"
            >
              {t.ocrContinue}
            </button>
          </div>
        </div>
      )}{" "}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          {t.skipScan}
        </button>
      </div>
    </div>
  );
}

// ─── Deed Verification & Attachment panel ─────────────────────────────────────

function DeedVerificationPanel({
  t,
  isArabic,
  deedAttachment,
  setDeedAttachment,
}: {
  t: (typeof copy)["ar"];
  isArabic: boolean;
  deedAttachment: File | null;
  setDeedAttachment: (f: File | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setDeedAttachment(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header row */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
          <ShieldCheck className="h-4.5 w-4.5 text-indigo-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">
            {t.deedVerificationTitle}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t.deedVerificationDesc}
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* Portal button + hint */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <a
            href={SREM_DEED_INQUIRY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
          >
            <ExternalLink className="h-4 w-4" />
            {t.deedVerificationBtn}
          </a>
          <p className="self-center rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-xs leading-relaxed text-slate-500">
            {t.deedVerificationNote}
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-100" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">
            {isArabic ? "ثم" : "then"}
          </span>
          <div className="h-px flex-1 bg-slate-100" />
        </div>

        {/* Upload zone or attached file */}
        {deedAttachment ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
              <Paperclip className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-emerald-800">
                {deedAttachment.name}
              </p>
              <p className="text-xs text-emerald-600">
                {t.deedAttachmentUploaded} ·{" "}
                {(deedAttachment.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeedAttachment(null)}
              className="shrink-0 rounded-full p-1 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm transition group-hover:shadow-md">
                <Upload className="h-5 w-5 text-slate-300 transition group-hover:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">
                  {t.deedAttachmentDrop}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t.deedAttachmentSub}
                </p>
              </div>
              <span className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition group-hover:border-indigo-200 group-hover:text-indigo-700">
                {t.deedAttachmentBrowse}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
              />
            </div>
            <p className="text-center text-xs text-slate-400">
              {t.deedAttachmentOptional}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Step 4: Review & Submit ──────────────────────────────────────────────────

function StepReview({
  ocrResult,
  evalDataFields,
  setEvalDataFields,
  selectedTemplate,
  templateFieldValues,
  setTemplateFieldValues,
  ocrFilledKeys,
  t,
  isArabic,
  isGeneralTemplate,
  onGoBackToScan,
  deedAttachment,
  setDeedAttachment,
}: {
  ocrResult: OcrResult | null;
  evalDataFields: Record<string, string>;
  setEvalDataFields: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  selectedTemplate: TemplateOption | null;
  templateFieldValues: Record<string, string | File>;
  setTemplateFieldValues: React.Dispatch<
    React.SetStateAction<Record<string, string | File>>
  >;
  ocrFilledKeys: Set<string>;
  t: (typeof copy)["ar"];
  isArabic: boolean;
  isGeneralTemplate: boolean;
  onGoBackToScan: () => void;
  deedAttachment: File | null;
  setDeedAttachment: (f: File | null) => void;
}) {
  const hasOcr = ocrResult !== null;

  const setEvalField = (evalKey: string, val: string) => {
    setEvalDataFields((prev) => ({ ...prev, [evalKey]: val }));
  };

  const setTemplateField = (fieldId: string, val: string) => {
    setTemplateFieldValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">{t.reviewTitle}</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {hasOcr ? t.reviewSubtitle : t.reviewSubtitleNoOcr}
        </p>
      </div>

      {/* OCR banner */}
      {hasOcr && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-emerald-700">
              {isArabic
                ? "تم الاستخراج التلقائي من صورة الصك. الحقول المميزة باللون الأخضر قابلة للتعديل."
                : "Fields pre-filled from deed scan. Green-highlighted fields are editable."}
            </p>
            {isGeneralTemplate && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                ⚡ {t.generalTemplateNote}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onGoBackToScan}
            className="shrink-0 text-xs font-medium text-emerald-600 hover:underline"
          >
            {t.ocrRetry}
          </button>
        </div>
      )}

      {/* ── General template fields ── */}
      {isGeneralTemplate && selectedTemplate && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {isArabic ? "بيانات التقييم" : "Evaluation Data"}
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {isArabic ? "قالب عام" : "General Template"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedTemplate.fields.map((f) => {
              if (f.fieldType === "file") return null;

              const evalKey = resolveEvalKey(f.label, f.id);
              const currentVal = evalDataFields[evalKey] ?? "";
              const isHighlighted = hasOcr && ocrFilledKeys.has(evalKey);
              const isTextarea = f.fieldType === "textarea";
              const isSelect = f.fieldType === "select" && !!f.options?.length;

              return (
                <div
                  key={f.id}
                  className={isTextarea ? "sm:col-span-2 lg:col-span-3" : ""}
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {f.label}
                    </label>
                    {isHighlighted && (
                      <span className="rounded-sm bg-emerald-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                        {t.ocrBadge}
                      </span>
                    )}
                  </div>

                  {isTextarea ? (
                    <textarea
                      value={currentVal}
                      onChange={(e) => setEvalField(evalKey, e.target.value)}
                      rows={3}
                      placeholder={`${f.label}…`}
                      className={cn(
                        "w-full resize-y rounded-lg border px-3 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-300 transition focus:outline-none focus:ring-2",
                        isHighlighted
                          ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200 focus:border-emerald-400 focus:ring-emerald-100"
                          : "border-slate-200 bg-white focus:border-cyan-400 focus:ring-cyan-100",
                      )}
                    />
                  ) : isSelect ? (
                    <div className="relative">
                      <select
                        value={currentVal}
                        onChange={(e) => setEvalField(evalKey, e.target.value)}
                        className={cn(
                          "w-full appearance-none rounded-lg border py-2.5 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition focus:outline-none focus:ring-2 rtl:pl-8 rtl:pr-3",
                          isHighlighted
                            ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200 focus:border-emerald-400 focus:ring-emerald-100"
                            : "border-slate-200 bg-white focus:border-cyan-400 focus:ring-cyan-100",
                        )}
                      >
                        <option value="" disabled>
                          {f.label}
                        </option>
                        {f.options!.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 rtl:left-2.5 rtl:right-auto" />
                    </div>
                  ) : (
                    <TextField
                      type={f.fieldType}
                      value={currentVal}
                      onChange={(v) => setEvalField(evalKey, v)}
                      placeholder={f.label}
                      highlight={isHighlighted}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Non-general template fields ── */}
      {!isGeneralTemplate &&
        selectedTemplate &&
        selectedTemplate.fields.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {selectedTemplate.name}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {selectedTemplate.fields.map((f) => {
                if (f.fieldType === "file") return null;

                const val =
                  typeof templateFieldValues[f.id] === "string"
                    ? (templateFieldValues[f.id] as string)
                    : "";

                const ocrKey = Object.entries(OCR_TO_TEMPLATE_LABEL).find(
                  ([, label]) => label === f.label,
                )?.[0];
                const isHighlighted =
                  hasOcr && !!ocrKey && !!val && !!(ocrResult as any)?.[ocrKey];
                const isTextarea = f.fieldType === "textarea";
                const isSelect =
                  f.fieldType === "select" && !!f.options?.length;

                return (
                  <div
                    key={f.id}
                    className={isTextarea ? "sm:col-span-2 lg:col-span-3" : ""}
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {f.label}
                      </label>
                      {isHighlighted && (
                        <span className="rounded-sm bg-emerald-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                          {t.ocrBadge}
                        </span>
                      )}
                    </div>

                    {isTextarea ? (
                      <textarea
                        value={val}
                        onChange={(e) => setTemplateField(f.id, e.target.value)}
                        rows={3}
                        placeholder={`${f.label}…`}
                        className={cn(
                          "w-full resize-y rounded-lg border px-3 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-300 transition focus:outline-none focus:ring-2",
                          isHighlighted
                            ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200 focus:border-emerald-400 focus:ring-emerald-100"
                            : "border-slate-200 bg-white focus:border-cyan-400 focus:ring-cyan-100",
                        )}
                      />
                    ) : isSelect ? (
                      <div className="relative">
                        <select
                          value={val}
                          onChange={(e) =>
                            setTemplateField(f.id, e.target.value)
                          }
                          className={cn(
                            "w-full appearance-none rounded-lg border py-2.5 pl-3 pr-8 text-sm text-slate-700 shadow-sm transition focus:outline-none focus:ring-2 rtl:pl-8 rtl:pr-3",
                            isHighlighted
                              ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200 focus:border-emerald-400 focus:ring-emerald-100"
                              : "border-slate-200 bg-white focus:border-cyan-400 focus:ring-cyan-100",
                          )}
                        >
                          <option value="" disabled>
                            {f.label}
                          </option>
                          {f.options!.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 rtl:left-2.5 rtl:right-auto" />
                      </div>
                    ) : (
                      <TextField
                        type={f.fieldType}
                        value={val}
                        onChange={(v) => setTemplateField(f.id, v)}
                        placeholder={f.label}
                        highlight={isHighlighted}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Empty state */}
      {!hasOcr &&
        !isGeneralTemplate &&
        (!selectedTemplate || selectedTemplate.fields.length === 0) && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
            <Send className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              {isArabic
                ? "لا توجد حقول إضافية. المعاملة جاهزة للإنشاء."
                : "No additional fields. Ready to create the transaction."}
            </p>
          </div>
        )}

      {/* ── Deed Verification & Attachment ── always shown at the bottom of review ── */}
      <DeedVerificationPanel
        t={t}
        isArabic={isArabic}
        deedAttachment={deedAttachment}
        setDeedAttachment={setDeedAttachment}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type PageProps = {
  onBack: () => void;
  onSubmit?: (values: NewTransactionValues) => void;
};

export function NewTransactionPage({ onBack, onSubmit }: PageProps) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "en";
  const isArabic = language === "ar";
  const t = copy[language];

  const [step, setStep] = useState<Step>("basic");
  const [scannedDeedFile, setScannedDeedFile] = useState<File | null>(null);
  const [values, setValues] = useState<NewTransactionValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof NewTransactionValues>(
    key: K,
    val: NewTransactionValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: val }));

  const clearError = (k: string) =>
    setErrors((prev) => {
      const n = { ...prev };
      delete n[k];
      return n;
    });

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [evalDataFields, setEvalDataFields] = useState<Record<string, string>>(
    {},
  );
  const [ocrFilledKeys, setOcrFilledKeys] = useState<Set<string>>(new Set());
  const [templateFieldValues, setTemplateFieldValues] = useState<
    Record<string, string | File>
  >({});

  // Deed attachment from SREM portal
  const [deedAttachment, setDeedAttachment] = useState<File | null>(null);

  const selectedTemplate =
    templates.find((tp) => tp.id === values.template) ?? null;
  const isGeneralTemplate = selectedTemplate?.name === GENERAL_TEMPLATE_NAME_AR;

  useEffect(() => {
    setEvalDataFields({});
    setOcrFilledKeys(new Set());
    if (!selectedTemplate) {
      setTemplateFieldValues({});
      return;
    }
    if (!isGeneralTemplate) {
      setTemplateFieldValues((prev) => {
        const next: Record<string, string | File> = {};
        for (const f of selectedTemplate.fields) {
          next[f.id] = prev[f.id] ?? "";
        }
        return next;
      });
    }
  }, [values.template]);

  useEffect(() => {
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

  const validateBasic = (): boolean => {
    const errs: Record<string, string> = {};
    if (!values.assignmentNumber.trim())
      errs.assignmentNumber = t.errAssignmentNumber;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateTemplate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!values.client) errs.client = t.errClient;
    if (!values.template) errs.template = t.errTemplate;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === "basic") {
      if (!validateBasic()) return;
      setStep("template");
    } else if (step === "template") {
      if (!validateTemplate()) return;
      setStep("scan");
    } else if (step === "scan") {
      setStep("review");
    }
  };

  const handleBack = () => {
    if (step === "template") setStep("basic");
    else if (step === "scan") setStep("template");
    else if (step === "review") setStep("scan");
  };

  const handleScanned = (result: OcrResult, file?: File) => {
    setOcrResult(result);

    // Store the scanned deed file for later upload
    if (file) {
      setScannedDeedFile(file);
    }

    if (isGeneralTemplate) {
      const filledKeys = new Set<string>();
      const newFields: Record<string, string> = {};

      for (const [ocrKey, evalKey] of Object.entries(OCR_TO_EVAL_DATA)) {
        if (!evalKey) continue;
        const val = result[ocrKey as keyof OcrResult];
        if (!val || typeof val !== "string" || !val.trim()) continue;
        newFields[evalKey] = val.trim();
        filledKeys.add(evalKey);
      }

      setEvalDataFields(newFields);
      setOcrFilledKeys(filledKeys);
    } else if (selectedTemplate) {
      const labelToId: Record<string, string> = {};
      for (const f of selectedTemplate.fields) {
        labelToId[f.label] = f.id;
      }
      const updates: Record<string, string> = {};
      for (const [ocrKey, templateLabel] of Object.entries(
        OCR_TO_TEMPLATE_LABEL,
      )) {
        if (!templateLabel) continue;
        const val = result[ocrKey as keyof OcrResult];
        if (!val || typeof val !== "string" || !val.trim()) continue;
        const fieldId = labelToId[templateLabel];
        if (!fieldId) continue;
        updates[fieldId] = val.trim();
      }
      setTemplateFieldValues((prev) => ({ ...prev, ...updates }));
    }

    setStep("review");
  };
  const handleSkipScan = () => setStep("review");

  const handleSubmit = async () => {
    try {
      const fd = new FormData();
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

      // Don't append files to main form data

      if (isGeneralTemplate) {
        fd.append("__evalData__", JSON.stringify(evalDataFields));
      } else {
        for (const [fieldId, val] of Object.entries(templateFieldValues)) {
          if (val instanceof File) {
            fd.append(`file__${fieldId}`, val, val.name);
          } else {
            fd.append(`templateFieldValues[${fieldId}]`, val);
          }
        }
      }

      // Create the transaction first
      const res = await fetch(toApiUrl("/api/transactions"), {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? `Error ${res.status}`);
      }

      const created = await res.json();

      // After transaction is created, upload attachments
      const uploadPromises = [];

      // Upload scanned deed document (from OCR)
      if (scannedDeedFile) {
        const deedFormData = new FormData();
        deedFormData.append("files[]", scannedDeedFile, scannedDeedFile.name);
        deedFormData.append(`names[${scannedDeedFile.name}]`, "وثيقة الملكية");

        uploadPromises.push(
          fetch(toApiUrl(`/api/transactions/${created.id}/attachments`), {
            method: "POST",
            credentials: "include",
            body: deedFormData,
          }).catch((err) =>
            console.error("Failed to upload deed document:", err),
          ),
        );
      }

      // Upload verification image (from SREM portal or manual upload)
      if (deedAttachment) {
        const verificationFormData = new FormData();
        verificationFormData.append(
          "files[]",
          deedAttachment,
          deedAttachment.name,
        );
        verificationFormData.append(
          `names[${deedAttachment.name}]`,
          "صورة التحقق",
        );

        uploadPromises.push(
          fetch(toApiUrl(`/api/transactions/${created.id}/attachments`), {
            method: "POST",
            credentials: "include",
            body: verificationFormData,
          }).catch((err) =>
            console.error("Failed to upload verification image:", err),
          ),
        );
      }

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      // Update evalData if needed (for general template)
      if (
        isGeneralTemplate &&
        Object.keys(evalDataFields).length > 0 &&
        created.id
      ) {
        await fetch(toApiUrl(`/api/transactions/${created.id}`), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evalData: evalDataFields }),
        }).catch(() =>
          console.warn("Failed to patch evalData for general template"),
        );
      }

      // Reset all state
      setValues(EMPTY);
      setTemplateFieldValues({});
      setEvalDataFields({});
      setOcrFilledKeys(new Set());
      setOcrResult(null);
      setDeedAttachment(null);
      setScannedDeedFile(null); // Clear the scanned deed file
      setStep("basic");
      onSubmit?.(created);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save");
    }
  };
  const handleCancel = () => {
    setValues(EMPTY);
    setEvalDataFields({});
    setOcrFilledKeys(new Set());
    setOcrResult(null);
    setDeedAttachment(null);
    setScannedDeedFile(null); // Add this line
    setStep("basic");
    onBack();
  };
  const isLastStep = step === "review";

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
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

          <div className="ms-auto">
            <StepIndicator current={step} t={t} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 py-8">
        {step === "basic" && (
          <StepBasic
            values={values}
            set={set}
            t={t}
            errors={errors}
            clearError={clearError}
          />
        )}

        {step === "template" && (
          <StepTemplate
            values={values}
            set={set}
            clients={clients}
            templates={templates}
            loadingClients={loadingClients}
            t={t}
            errors={errors}
            clearError={clearError}
            isArabic={isArabic}
          />
        )}

        {step === "scan" && (
          <StepScan t={t} onScanned={handleScanned} onSkip={handleSkipScan} />
        )}

        {step === "review" && (
          <StepReview
            ocrResult={ocrResult}
            evalDataFields={evalDataFields}
            setEvalDataFields={setEvalDataFields}
            selectedTemplate={selectedTemplate}
            templateFieldValues={templateFieldValues}
            setTemplateFieldValues={setTemplateFieldValues}
            ocrFilledKeys={ocrFilledKeys}
            t={t}
            isArabic={isArabic}
            isGeneralTemplate={isGeneralTemplate}
            onGoBackToScan={() => setStep("scan")}
            deedAttachment={deedAttachment}
            setDeedAttachment={setDeedAttachment}
          />
        )}

        {/* Footer navigation */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <div>
            {step !== "basic" && (
              <button
                onClick={handleBack}
                className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                {t.back}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-400 transition hover:text-slate-600"
            >
              {t.cancel}
            </button>

            {isLastStep ? (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                <Send className="h-3.5 w-3.5" />
                {t.submit}
              </button>
            ) : step !== "scan" ? (
              <button
                onClick={handleNext}
                className="rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                {t.next}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
