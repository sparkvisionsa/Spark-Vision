"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import Link from "@/components/prefetch-link";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { PhoneNumberInput } from "@/components/phone-number-input";
import { toApiUrl } from "@/lib/api-url";
import { imageFileToSignaturePngDataUrl } from "@/lib/signature-image-png";
import {
  VALUE_TECH_PRODUCT_IDS,
  VALUE_TECH_PRODUCT_LABELS_AR,
  type ValueTechProductId,
} from "@/lib/value-tech-products";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { scanDocxTemplateVariables } from "@/lib/mv-word-template/template-variables";
import { scanPptxTemplate } from "@/lib/mv-pptx-template";
import {
  CompanyReportDocumentTemplateDashboard,
  suggestedTemplateBinding,
  type CompanyReportDocumentTemplateForm,
  type CompanyReportTemplateVariableMappingForm,
} from "@/components/company-report-document-template-dashboard";
import { CompanyAssetDescriptionsDashboard } from "@/components/company-asset-descriptions-dashboard";
import { CompanyReportDataModelDashboard } from "@/components/company-report-data-model-dashboard";
import { MvReportPageShell } from "@/components/workspace/workspace-sections/machine-valuation/mv-report-page-shell";
import {
  createDefaultReportDataModel,
  normalizeReportDataModels,
  type MvReportDataModel,
} from "@/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  ImageIcon,
  Info,
  Loader2,
  MoreVertical,
  Palette,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Stamp,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wand2,
} from "lucide-react";

console.log("company-admin-dashboard.tsx LOADED");

export type CompanyAdminDashboardVariant = "standalone" | "embedded";
export type CompanyAdminDashboardMode = "general" | "report-defaults";

type CompanyInfo = {
  id: string;
  name: string;
  valueTechProductIds: string[];
  logoDataUrl?: string | null;
  commercialRegistration?: string | null;
  employeeCount?: number;
};

type CompanyUserRow = {
  id: string;
  username: string;
  role: string;
  companyId: string;
  productIds?: string[];
  email?: string | null;
  phone?: string | null;
  valuationReportDisplayName?: string | null;
  valuationReportJobTitle?: string | null;
  valuationReportMembershipNo?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  valuationReportSignatureDataUrl?: string | null;
};

/** معدّ تقرير بدون حساب دخول — يظهر في المقيمون والتوقيعات فقط. */
type ReportOnlySignatoryRow = {
  id: string;
  name: string;
  jobTitle: string;
  membershipNo: string;
  signatureImageDataUrl: string | null;
  createdAt: string;
  productIds: string[];
  updatedAt: string;
  isReportOnly: true;
};

type CompanyReportCustomSectionForm = {
  id: string;
  groupId?: string;
  groupTitle?: string;
  sectionNumber: string;
  title: string;
  body: string;
};

type CompanyReportCustomGroupForm = {
  id: string;
  title: string;
};

type CompanyReportLetterheadForm = {
  enabled: boolean;
  templateId: string | null;
  outputFormat: "pdf" | "pptx";
  coverImageDataUrl: string | null;
  pageImageDataUrl: string | null;
  landscapePageImageDataUrl: string | null;
  logoDataUrl: string | null;
  footerImageDataUrl: string | null;
  signatureStampDataUrl: string | null;
};

type CompanyReportWordTemplateForm = CompanyReportDocumentTemplateForm;
type CompanyReportPptxTemplateForm = CompanyReportDocumentTemplateForm;

type CompanyAiTemplateVariableForm = {
  key: string;
  label: string;
  source: string;
  required?: boolean;
};

type CompanyAiTemplateSectionForm = {
  id: string;
  title: string;
  order: number;
  description?: string;
  dynamicVariables?: string[];
};

type CompanyAiTemplateForm = {
  id: string;
  type: "AI Template";
  name: string;
  sourceFileName?: string;
  createdAt: string;
  updatedAt: string;
  analysisSummary?: string;
  coverImageDataUrl?: string | null;
  pageImageDataUrl?: string | null;
  landscapePageImageDataUrl?: string | null;
  theme: Record<string, unknown>;
  layout: Record<string, unknown>;
  sections: CompanyAiTemplateSectionForm[];
  dynamicVariables: CompanyAiTemplateVariableForm[];
  rules: string[];
  templateJson: Record<string, unknown>;
};

/**
 * Templates rendered (and editable) on the new "بيانات إعداد التقرير النهائي"
 * tab. Values feed the report preview as fallback narrative when the project
 * itself has not provided an override.
 */
type CompanyReportDefaultsForm = {
  scope: {
    complianceStatement: string;
    independenceStatement: string;
    intendedUseStatement: string;
    scopeOfWorkDetails: string;
    valuationBasisDefinition: string;
    valuePremiseDefinition: string;
    useRestriction: string;
    externalSpecialistUse: string;
    esgConsiderations: string;
    informationSources: string;
  };
  methodology: {
    assetSubjectDescription: string;
    assetDetailedDescription: string;
    methodologyRationale: string;
    costApproachDetails: string;
    salvageValueDescription: string;
    physicalDepreciationDescription: string;
    functionalObsolescenceDescription: string;
    economicObsolescenceDescription: string;
  };
  assumptions: {
    generalAssumptions: string;
    specialAssumptions: string;
  };
  customGroups: CompanyReportCustomGroupForm[];
  customSections: CompanyReportCustomSectionForm[];
  reportDataModels: MvReportDataModel[];
  letterhead: CompanyReportLetterheadForm;
  aiTemplates: CompanyAiTemplateForm[];
  wordTemplates: CompanyReportWordTemplateForm[];
  pptxTemplates: CompanyReportPptxTemplateForm[];
  /** Compatibility mirrors consumed by older report screens. */
  wordTemplate: CompanyReportWordTemplateForm | null;
  pptxTemplate: CompanyReportPptxTemplateForm | null;
};

function emptyReportLetterhead(): CompanyReportLetterheadForm {
  return {
    enabled: false,
    templateId: "default-report-template",
    outputFormat: "pdf",
    coverImageDataUrl: null,
    pageImageDataUrl: null,
    landscapePageImageDataUrl: null,
    logoDataUrl: null,
    footerImageDataUrl: null,
    signatureStampDataUrl: null,
  };
}

type LetterheadTemplateOption = {
  id: string;
  title: string;
  description: string;
  outputFormat: "pdf" | "pptx";
  accentClass: string;
  badge: string;
};

const LETTERHEAD_TEMPLATE_OPTIONS: LetterheadTemplateOption[] = [
  {
    id: "default-report-template",
    title: "Value Tech الرسمي",
    description: "هوية مهنية كحلية عالية الوضوح، مهيأة للتقارير الرسمية والجهات الحكومية.",
    outputFormat: "pdf",
    accentClass: "from-[#071f33] via-[#0C447C] to-[#0f6d91]",
    badge: "PDF",
  },
  {
    id: "classic-letterhead",
    title: "كلاسيكي رسمي",
    description: "هوية مؤسسية تقليدية بخطوط زرقاء وفواصل واضحة.",
    outputFormat: "pdf",
    accentClass: "from-sky-600 to-cyan-500",
    badge: "PDF",
  },
  {
    id: "modern-letterhead",
    title: "حديث مدمج",
    description: "تصميم حديث بمساحات بيضاء وتدرج أخضر تقني.",
    outputFormat: "pdf",
    accentClass: "from-emerald-600 to-teal-500",
    badge: "PDF",
  },
  {
    id: "executive-navy",
    title: "تنفيذي داكن",
    description: "غلاف قوي وشريط جانبي داكن للتقارير الرسمية عالية القيمة.",
    outputFormat: "pdf",
    accentClass: "from-slate-950 via-[#0C447C] to-sky-500",
    badge: "PDF",
  },
  {
    id: "industrial-amber",
    title: "صناعي ذهبي",
    description: "مناسب للمصانع والمعدات الثقيلة بتفاصيل ذهبية وشبكة فنية.",
    outputFormat: "pdf",
    accentClass: "from-stone-900 via-amber-700 to-orange-500",
    badge: "PDF",
  },
  {
    id: "minimal-graphite",
    title: "Minimal Graphite",
    description: "أسلوب بسيط جداً بالأبيض والأسود وتركيز على النص والبيانات.",
    outputFormat: "pdf",
    accentClass: "from-zinc-950 to-zinc-500",
    badge: "PDF",
  },
  {
    id: "field-teal",
    title: "Field Teal",
    description: "ألوان ميدانية عملية مع مساحات مريحة للصور والملاحظات.",
    outputFormat: "pdf",
    accentClass: "from-teal-800 via-cyan-700 to-lime-500",
    badge: "PDF",
  },
  {
    id: "premium-burgundy",
    title: "Premium Burgundy",
    description: "طابع فاخر بأحمر عميق وتفاصيل ذهبية للجهات التنفيذية.",
    outputFormat: "pdf",
    accentClass: "from-rose-950 via-red-800 to-amber-500",
    badge: "PDF",
  },
  {
    id: "creative-blocks",
    title: "Creative Blocks",
    description: "تركيب لوني جريء يشبه قوالب العروض الحديثة.",
    outputFormat: "pdf",
    accentClass: "from-fuchsia-700 via-sky-600 to-emerald-500",
    badge: "PDF",
  },
  {
    id: "powerpoint-deck",
    title: "PowerPoint Presentation",
    description: "مهيأ للتنزيل كعرض شرائح 16:9 مع غلاف عرض تقديمي.",
    outputFormat: "pptx",
    accentClass: "from-orange-600 to-amber-500",
    badge: "PPTX",
  },
];

const COMPANY_LETTERHEAD_TEMPLATE_OPTION: LetterheadTemplateOption = {
  id: "company-letterhead",
  title: "أكلاشية الشركة",
  description: "قالب يعتمد على صور الأكلاشية المرفوعة من الشركة.",
  outputFormat: "pdf",
  accentClass: "from-amber-600 to-orange-500",
  badge: "صور",
};

const A4_PREVIEW_WIDTH_PX = (210 * 96) / 25.4;
const A4_PREVIEW_HEIGHT_PX = (297 * 96) / 25.4;

function SystemReportTemplatePreview({
  template,
  letterhead,
  companyName,
  companyLogoSrc,
  large = false,
}: {
  template: LetterheadTemplateOption;
  letterhead: CompanyReportLetterheadForm;
  companyName: string;
  companyLogoSrc: string | null;
  large?: boolean;
}) {
  const scale = large ? 0.58 : 0.29;
  const companyLetterhead = template.id === COMPANY_LETTERHEAD_TEMPLATE_OPTION.id;
  const previewLetterhead: CompanyReportLetterheadForm = {
    ...letterhead,
    enabled: companyLetterhead,
    templateId: template.id,
    outputFormat: template.outputFormat,
  };

  return (
    <div
      className="relative mx-auto shrink-0 overflow-hidden bg-white"
      style={{
        width: A4_PREVIEW_WIDTH_PX * scale,
        height: A4_PREVIEW_HEIGHT_PX * scale,
      }}
      aria-hidden
    >
      <div
        className="pointer-events-none absolute left-0 top-0 select-none"
        style={{
          width: A4_PREVIEW_WIDTH_PX,
          height: A4_PREVIEW_HEIGHT_PX,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <MvReportPageShell
          variant="cover"
          companyName={companyName || "شركة التقييم"}
          logoSrc={companyLogoSrc}
          footerLines={[]}
          letterheadTemplate={previewLetterhead}
          coverChildrenChromeless
          className="!m-0 !rounded-none !shadow-none !ring-0 hover:!shadow-none"
          coverFooterContent={
            <div className="grid w-full grid-cols-3 items-center gap-3 text-[11px] font-extrabold text-white" dir="rtl">
              <div className="text-right">المقيم المعتمد: —</div>
              <div className="text-center">الرقم المرجعي: MV-001</div>
              <div className="text-left">تاريخ التقرير: —</div>
            </div>
          }
        >
          <div className="w-full max-w-3xl space-y-5 text-center text-white">
            <h3 className="mx-auto px-3 py-2 text-[36px] font-black leading-[1.25] tracking-tight text-white">
              تقرير تقييم الآلات والمعدات
            </h3>
            <div className="mx-auto h-[3px] w-[120px] rounded-full bg-gradient-to-l from-transparent via-[#c9a227] to-transparent" />
            <p className="mx-auto max-w-xl px-2 text-[20px] font-extrabold leading-7 text-white">
              (اسم العميل)
            </p>
          </div>
        </MvReportPageShell>
      </div>
    </div>
  );
}

function emptyReportDefaults(): CompanyReportDefaultsForm {
  return {
    scope: {
      complianceStatement: "",
      independenceStatement: "",
      intendedUseStatement: "",
      scopeOfWorkDetails: "",
      valuationBasisDefinition: "",
      valuePremiseDefinition: "",
      useRestriction: "",
      externalSpecialistUse: "",
      esgConsiderations: "",
      informationSources: "",
    },
    methodology: {
      assetSubjectDescription: "",
      assetDetailedDescription: "",
      methodologyRationale: "",
      costApproachDetails: "",
      salvageValueDescription: "",
      physicalDepreciationDescription: "",
      functionalObsolescenceDescription: "",
      economicObsolescenceDescription: "",
    },
    assumptions: {
      generalAssumptions: "",
      specialAssumptions: "",
    },
    customGroups: [],
    customSections: [],
    reportDataModels: [createDefaultReportDataModel()],
    letterhead: emptyReportLetterhead(),
    aiTemplates: [],
    wordTemplates: [],
    pptxTemplates: [],
    wordTemplate: null,
    pptxTemplate: null,
  };
}

function isReportTemplateImageSource(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.startsWith("data:image/") || trimmed.startsWith("/uploads/company-report-templates/");
}

function isCompanyDocumentTemplateUrl(value: unknown, extension: ".docx" | ".pptx"): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith("/uploads/company-report-templates/") &&
    trimmed.toLowerCase().endsWith(extension)
  );
}

function normalizeCompanyTemplateVariableMappings(raw: unknown): CompanyReportTemplateVariableMappingForm[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.slice(0, 400).flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const data = item as Record<string, unknown>;
    const variable = typeof data.variable === "string"
      ? data.variable.trim()
      : typeof data.placeholder === "string"
        ? data.placeholder.trim()
        : "";
    const normalized = variable.replace(/[\u200e\u200f\u202a-\u202e]/g, "").toLocaleLowerCase();
    if (!variable || seen.has(normalized)) return [];
    seen.add(normalized);
    const sourceFromLegacy = typeof data.source === "string" ? data.source.trim() : "";
    const sourceType = typeof data.sourceType === "string" ? data.sourceType : "";
    return [{
      id: typeof data.id === "string" && data.id.trim() ? data.id.trim() : `template-variable-${index + 1}`,
      variable,
      sourceKey:
        typeof data.sourceKey === "string"
          ? data.sourceKey.trim()
          : sourceType === "literal"
            ? "static"
            : sourceType === "image" || sourceType === "asset-images"
              ? suggestedTemplateBinding(variable) || "images.asset"
              : sourceFromLegacy,
      staticValue:
        typeof data.staticValue === "string"
          ? data.staticValue
          : typeof data.fallbackValue === "string"
            ? data.fallbackValue
            : undefined,
    }];
  });
}

function createCompanyTemplateMappingId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `template-variable-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTemplateVariableKey(value: string): string {
  return value.replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim().toLocaleLowerCase();
}

/** Keep prior links and seed safe suggested bindings for newly detected variables. */
function mergeTemplateVariableMappings(opts: {
  variables: string[];
  previousMappings: CompanyReportTemplateVariableMappingForm[];
  previousDetected: Set<string>;
  nextDetected: Set<string>;
}): CompanyReportTemplateVariableMappingForm[] {
  const preserved = opts.previousMappings.filter((mapping) => {
    const name = normalizeTemplateVariableKey(mapping.variable);
    return opts.nextDetected.has(name) || !opts.previousDetected.has(name);
  });
  const seen = new Set(preserved.map((mapping) => normalizeTemplateVariableKey(mapping.variable)));
  const seeded: CompanyReportTemplateVariableMappingForm[] = [];
  for (const variable of opts.variables) {
    const key = normalizeTemplateVariableKey(variable);
    if (!variable.trim() || !key || seen.has(key)) continue;
    const sourceKey = suggestedTemplateBinding(variable);
    if (!sourceKey) continue;
    seen.add(key);
    seeded.push({
      id: createCompanyTemplateMappingId(),
      variable: variable.trim(),
      sourceKey,
    });
  }
  return [...preserved, ...seeded];
}

function normalizeCompanyDocumentTemplate(
  raw: unknown,
  format: "word" | "pptx",
  index = 0,
): CompanyReportDocumentTemplateForm | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Partial<CompanyReportDocumentTemplateForm> & { variableNames?: unknown };
  const extension = format === "word" ? ".docx" : ".pptx";
  const fileUrl = isCompanyDocumentTemplateUrl(data.fileUrl, extension) ? data.fileUrl.trim() : null;
  const fileDataUrl = typeof data.fileDataUrl === "string" && data.fileDataUrl.startsWith("data:")
    ? data.fileDataUrl
    : null;
  const gridFsFileId = typeof data.gridFsFileId === "string" && data.gridFsFileId.trim()
    ? data.gridFsFileId.trim()
    : null;
  if (!fileUrl && !fileDataUrl && !gridFsFileId) return null;
  const fileName = typeof data.fileName === "string" && data.fileName.trim()
    ? data.fileName.trim()
    : format === "word" ? "word-template.docx" : "powerpoint-template.pptx";
  const fallbackName = fileName.replace(/\.(docx|pptx)$/i, "").trim() || (format === "word" ? "قالب Word" : "قالب PowerPoint");
  return {
    id: typeof data.id === "string" && data.id.trim()
      ? data.id.trim()
      : `${format}-template-${index + 1}`,
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : fallbackName,
    fileName,
    fileUrl,
    ...(fileDataUrl ? { fileDataUrl } : {}),
    ...(gridFsFileId ? { gridFsFileId } : {}),
    uploadedAt: typeof data.uploadedAt === "string" ? data.uploadedAt : new Date().toISOString(),
    sizeBytes: typeof data.sizeBytes === "number" && Number.isFinite(data.sizeBytes) ? data.sizeBytes : undefined,
    bookmarkNames: Array.isArray(data.bookmarkNames)
      ? data.bookmarkNames.map(String).filter(Boolean).slice(0, 300)
      : Array.isArray(data.variableNames)
        ? data.variableNames.map(String).filter(Boolean).slice(0, 300)
        : [],
    variableMappings: normalizeCompanyTemplateVariableMappings(data.variableMappings),
    excludedVariableNames: Array.isArray(data.excludedVariableNames)
      ? data.excludedVariableNames.map(String).map((name) => name.trim()).filter(Boolean).slice(0, 300)
      : [],
  };
}

function normalizeCompanyDocumentTemplateList(
  rawList: unknown,
  legacyTemplate: unknown,
  format: "word" | "pptx",
): CompanyReportDocumentTemplateForm[] {
  const candidates = Array.isArray(rawList)
    ? rawList.slice(0, 20)
    : legacyTemplate
      ? [legacyTemplate]
      : [];
  const usedIds = new Set<string>();
  const usedNames = new Set<string>();
  const output: CompanyReportDocumentTemplateForm[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const normalized = normalizeCompanyDocumentTemplate(candidate, format, index);
    if (!normalized) continue;
    let id = normalized.id;
    while (usedIds.has(id)) id = `${format}-template-${index + 1}-${newReportDefaultId()}`;
    usedIds.add(id);

    const baseName = (normalized.name.trim() || normalized.fileName.replace(/\.(docx|pptx)$/i, "").trim()).slice(0, 160);
    let name = baseName;
    let suffix = 2;
    while (usedNames.has(name.toLocaleLowerCase())) {
      const suffixText = ` ${suffix}`;
      name = `${baseName.slice(0, Math.max(1, 160 - suffixText.length))}${suffixText}`;
      suffix += 1;
    }
    usedNames.add(name.toLocaleLowerCase());
    output.push({ ...normalized, id, name });
  }
  return output;
}

function uniqueCompanyDocumentTemplateName(
  requestedName: string,
  fileName: string,
  templates: CompanyReportDocumentTemplateForm[],
  ignoredId?: string,
): string {
  const fallback = fileName.replace(/\.(docx|pptx)$/i, "").trim() || "قالب تقرير";
  const base = (requestedName.trim() || fallback).slice(0, 160);
  const used = new Set(
    templates
      .filter((template) => template.id !== ignoredId)
      .map((template) => template.name.trim().toLocaleLowerCase())
      .filter(Boolean),
  );
  let name = base;
  let suffix = 2;
  while (used.has(name.toLocaleLowerCase())) {
    const suffixText = ` ${suffix}`;
    name = `${base.slice(0, Math.max(1, 160 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }
  return name;
}

function newCompanyDocumentTemplateId(format: "word" | "pptx"): string {
  return `${format}-template-${newReportDefaultId()}`;
}

function withCompanyDocumentTemplates(
  current: CompanyReportDefaultsForm,
  format: "word" | "pptx",
  templates: CompanyReportDocumentTemplateForm[],
): CompanyReportDefaultsForm {
  return format === "word"
    ? { ...current, wordTemplates: templates, wordTemplate: templates[0] ?? null }
    : { ...current, pptxTemplates: templates, pptxTemplate: templates[0] ?? null };
}

function prepareCompanyDocumentTemplatesForSave(
  current: CompanyReportDefaultsForm,
): CompanyReportDefaultsForm {
  const wordTemplates = normalizeCompanyDocumentTemplateList(current.wordTemplates, current.wordTemplate, "word");
  const pptxTemplates = normalizeCompanyDocumentTemplateList(current.pptxTemplates, current.pptxTemplate, "pptx");
  return {
    ...current,
    wordTemplates,
    pptxTemplates,
    wordTemplate: wordTemplates[0] ?? null,
    pptxTemplate: pptxTemplates[0] ?? null,
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function normalizeAiTemplateRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeAiTemplateStringList(value: unknown, max = 80): string[] {
  return Array.isArray(value)
    ? value
        .slice(0, max)
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];
}

function normalizeCompanyAiTemplates(raw: unknown): CompanyAiTemplateForm[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 20)
    .map((item, index) => {
      const data = normalizeAiTemplateRecord(item);
      const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : `ai-template-${index + 1}`;
      const name =
        typeof data.name === "string" && data.name.trim()
          ? data.name.trim()
          : `قالب ذكاء اصطناعي ${index + 1}`;
      const sections = Array.isArray(data.sections)
        ? data.sections.slice(0, 60).map((section, sectionIndex) => {
            const sectionData = normalizeAiTemplateRecord(section);
            return {
              id:
                typeof sectionData.id === "string" && sectionData.id.trim()
                  ? sectionData.id.trim()
                  : `section-${sectionIndex + 1}`,
              title:
                typeof sectionData.title === "string" && sectionData.title.trim()
                  ? sectionData.title.trim()
                  : `قسم ${sectionIndex + 1}`,
              order:
                typeof sectionData.order === "number" && Number.isFinite(sectionData.order)
                  ? sectionData.order
                  : sectionIndex + 1,
              description: typeof sectionData.description === "string" ? sectionData.description : "",
              dynamicVariables: normalizeAiTemplateStringList(sectionData.dynamicVariables),
            };
          })
        : [];
      const dynamicVariables = Array.isArray(data.dynamicVariables)
        ? data.dynamicVariables.slice(0, 120).map((variable, variableIndex) => {
            const variableData = normalizeAiTemplateRecord(variable);
            return {
              key:
                typeof variableData.key === "string" && variableData.key.trim()
                  ? variableData.key.trim()
                  : `variable_${variableIndex + 1}`,
              label:
                typeof variableData.label === "string" && variableData.label.trim()
                  ? variableData.label.trim()
                  : `متغير ${variableIndex + 1}`,
              source:
                typeof variableData.source === "string" && variableData.source.trim()
                  ? variableData.source.trim()
                  : "project",
              required: variableData.required === true,
            };
          })
        : [];
      return {
        id,
        type: "AI Template",
        name,
        sourceFileName: typeof data.sourceFileName === "string" ? data.sourceFileName : "",
        createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
        analysisSummary: typeof data.analysisSummary === "string" ? data.analysisSummary : "",
        coverImageDataUrl: isReportTemplateImageSource(data.coverImageDataUrl) ? data.coverImageDataUrl.trim() : null,
        pageImageDataUrl: isReportTemplateImageSource(data.pageImageDataUrl) ? data.pageImageDataUrl.trim() : null,
        landscapePageImageDataUrl: isReportTemplateImageSource(data.landscapePageImageDataUrl)
          ? data.landscapePageImageDataUrl.trim()
          : null,
        theme: normalizeAiTemplateRecord(data.theme),
        layout: normalizeAiTemplateRecord(data.layout),
        sections,
        dynamicVariables,
        rules: normalizeAiTemplateStringList(data.rules),
        templateJson: normalizeAiTemplateRecord(data.templateJson),
      } satisfies CompanyAiTemplateForm;
    })
    .filter((item) => item.name.trim());
}

function getAiTemplatePalette(template: CompanyAiTemplateForm): string[] {
  const palette = Array.isArray(template.theme.palette) ? template.theme.palette : [];
  return palette
    .filter((color): color is string => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color.trim()))
    .map((color) => color.trim())
    .slice(0, 8);
}

function getAiTemplateFonts(template: CompanyAiTemplateForm): string[] {
  const fonts = new Set<string>();
  const fontFamily = template.theme.fontFamily;
  if (typeof fontFamily === "string" && fontFamily.trim()) fonts.add(fontFamily.trim());
  const detectedFonts = Array.isArray(template.theme.detectedFonts) ? template.theme.detectedFonts : [];
  for (const font of detectedFonts) {
    if (typeof font === "string" && font.trim()) fonts.add(font.trim());
  }
  return Array.from(fonts).slice(0, 4);
}

/**
 * Reduces inbound API payloads into a fully-populated form so unmounted text
 * areas never render with `undefined`.
 */
function normalizeReportDefaults(
  raw: Partial<CompanyReportDefaultsForm> | null | undefined,
): CompanyReportDefaultsForm {
  const base = emptyReportDefaults();
  if (!raw) return base;
  const merge = <T extends Record<string, string>>(target: T, src: Partial<T> | undefined): T => {
    if (!src) return target;
    const out = { ...target } as Record<string, string>;
    for (const key of Object.keys(target)) {
      const value = src[key as keyof T];
      if (typeof value === "string") out[key] = value;
    }
    return out as T;
  };
  const image = (value: unknown): string | null =>
    isReportTemplateImageSource(value) ? value.trim() : null;
  const letterheadRaw =
    raw.letterhead && typeof raw.letterhead === "object" ? raw.letterhead : emptyReportLetterhead();
  const customSections = Array.isArray(raw.customSections)
    ? raw.customSections
        .filter((item) => Boolean(item) && typeof item === "object")
        .map((item, index) => ({
          id: typeof item.id === "string" && item.id ? item.id : `company-section-${index + 1}`,
          groupId: typeof item.groupId === "string" && item.groupId.trim() ? item.groupId.trim() : undefined,
          groupTitle:
            typeof item.groupTitle === "string" && item.groupTitle.trim() ? item.groupTitle.trim() : undefined,
          sectionNumber: typeof item.sectionNumber === "string" ? item.sectionNumber : "",
          title: typeof item.title === "string" ? item.title : "",
          body: typeof item.body === "string" ? item.body : "",
        }))
        .filter((item) => item.title.trim() || item.body.trim())
    : [];
  const customGroups = Array.isArray(raw.customGroups)
    ? raw.customGroups
        .filter((item) => Boolean(item) && typeof item === "object")
        .map((item, index) => ({
          id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `company-group-${index + 1}`,
          title: typeof item.title === "string" ? item.title.trim() : "",
        }))
        .filter((item) => item.title)
    : [];
  const rawTemplates = raw as Partial<CompanyReportDefaultsForm> & {
    wordTemplates?: unknown;
    pptxTemplates?: unknown;
    wordTemplate?: unknown;
    pptxTemplate?: unknown;
  };
  const wordTemplates = normalizeCompanyDocumentTemplateList(
    rawTemplates.wordTemplates,
    rawTemplates.wordTemplate,
    "word",
  );
  const pptxTemplates = normalizeCompanyDocumentTemplateList(
    rawTemplates.pptxTemplates,
    rawTemplates.pptxTemplate,
    "pptx",
  );
  return {
    scope: merge(base.scope, raw.scope as Partial<typeof base.scope> | undefined),
    methodology: merge(base.methodology, raw.methodology as Partial<typeof base.methodology> | undefined),
    assumptions: merge(base.assumptions, raw.assumptions as Partial<typeof base.assumptions> | undefined),
    customGroups,
    customSections,
    reportDataModels: normalizeReportDataModels((raw as { reportDataModels?: unknown }).reportDataModels),
    letterhead: {
      enabled: letterheadRaw.enabled === true,
      templateId:
        typeof letterheadRaw.templateId === "string" && letterheadRaw.templateId.trim()
          ? letterheadRaw.templateId.trim()
          : base.letterhead.templateId,
      outputFormat: letterheadRaw.outputFormat === "pptx" ? "pptx" : "pdf",
      coverImageDataUrl: image(letterheadRaw.coverImageDataUrl),
      pageImageDataUrl: image(letterheadRaw.pageImageDataUrl),
      landscapePageImageDataUrl: image(letterheadRaw.landscapePageImageDataUrl),
      logoDataUrl: image(letterheadRaw.logoDataUrl),
      footerImageDataUrl: image(letterheadRaw.footerImageDataUrl),
      signatureStampDataUrl: image(letterheadRaw.signatureStampDataUrl),
    },
    aiTemplates: normalizeCompanyAiTemplates((raw as { aiTemplates?: unknown }).aiTemplates),
    wordTemplates,
    pptxTemplates,
    wordTemplate: wordTemplates[0] ?? null,
    pptxTemplate: pptxTemplates[0] ?? null,
  };
}

type ReportDefaultsField = {
  key: string;
  label: string;
  helper?: string;
  rows?: number;
};

const REPORT_DEFAULTS_SCOPE_FIELDS: ReportDefaultsField[] = [
  {
    key: "complianceStatement",
    label: "3.0 الالتزام بمعايير التقييم",
    helper: "بيان امتثال التقييم لمعايير IVS وأنظمة الهيئة السعودية للمقيمين المعتمدين (تقييم).",
    rows: 5,
  },
  {
    key: "independenceStatement",
    label: "4.0 الاستقلالية وعدم تضارب المصالح",
    helper:
      "إقرار باستقلالية فريق التقييم — يدعم تعويض {companyName} باسم الشركة تلقائياً عند العرض.",
    rows: 5,
  },
  {
    key: "intendedUseStatement",
    label: "11.0 الغرض من استخدام التقرير",
    helper: "نص افتراضي يصف الجهة المستفيدة وغرض الاستخدام من التقرير.",
    rows: 4,
  },
  {
    key: "scopeOfWorkDetails",
    label: "9.0 نطاق العمل",
    helper:
      "ما يتم الاتفاق عليه قبل البدء: المقابلات والمعاينة وأبحاث السوق ومراجعة المستندات وما إلى ذلك.",
    rows: 7,
  },
  {
    key: "valuationBasisDefinition",
    label: "12.0 أساس القيمة — التعريف الكامل",
    helper: "تعريف القيمة السوقية أو ما يماثلها وفق معايير IVS 2025.",
    rows: 5,
  },
  {
    key: "valuePremiseDefinition",
    label: "13.0 فرضية القيمة — المرجع المعياري",
    helper: "نص قصير يحيل إلى مرجع IVS لفرضية القيمة.",
    rows: 2,
  },
  {
    key: "useRestriction",
    label: "14.0 قيود استخدام التقرير ونشره",
    helper: "تحديد الأطراف المصرّح لها بالاستخدام وحدود نشر التقرير.",
    rows: 5,
  },
  {
    key: "externalSpecialistUse",
    label: "15.0 الاستعانة بأخصائيين خارجيين",
    helper: "بيان مدى الاعتماد على متخصصين خارج فريق التقييم.",
    rows: 4,
  },
  {
    key: "esgConsiderations",
    label: "16.0 العوامل البيئية والاجتماعية",
    helper: "أثر العوامل البيئية والاجتماعية على رأي القيمة.",
    rows: 4,
  },
  {
    key: "informationSources",
    label: "18.0 مصادر المعلومات",
    helper: "المدخلات من العميل، أبحاث السوق، المصادر العامة والمتخصصة، إلخ.",
    rows: 6,
  },
];

const REPORT_DEFAULTS_METHODOLOGY_FIELDS: ReportDefaultsField[] = [
  {
    key: "assetSubjectDescription",
    label: "19.0 الأصل محل التقييم — وصف عام",
    helper: "نص افتراضي يلي العنوان «19.0 الأصل محل التقييم»؛ يُستبدل تلقائياً بالقيم الديناميكية للمشروع.",
    rows: 4,
  },
  {
    key: "assetDetailedDescription",
    label: "19.1 الوصف الجزئي",
    helper: "نص افتراضي يلي العنوان «19.1 الوصف الجزئي» — يُحال إلى المرفقات للتفاصيل.",
    rows: 5,
  },
  {
    key: "methodologyRationale",
    label: "24.0 منهجية التقييم",
    rows: 6,
  },
  {
    key: "costApproachDetails",
    label: "25.0 تطبيق أسلوب التقييم (السوق / التكلفة / الدخل)",
    helper: "نص افتراضي يصف الأسلوب المعتمد وتطبيقه — يتغير العنوان تلقائياً في التقرير حسب «أسلوب التقييم» المختار في بيانات المشروع.",
    rows: 7,
  },
  {
    key: "salvageValueDescription",
    label: "25.1 القيمة المتبقية",
    helper: "تظهر تلقائياً في التقرير فقط مع أسلوب التكلفة.",
    rows: 5,
  },
  {
    key: "physicalDepreciationDescription",
    label: "25.2 الإهلاك المادي",
    helper: "تظهر تلقائياً في التقرير فقط مع أسلوب التكلفة.",
    rows: 7,
  },
  {
    key: "functionalObsolescenceDescription",
    label: "25.3 التقادم الوظيفي",
    helper: "تظهر تلقائياً في التقرير فقط مع أسلوب التكلفة.",
    rows: 4,
  },
  {
    key: "economicObsolescenceDescription",
    label: "25.4 التقادم الاقتصادي",
    helper: "تظهر تلقائياً في التقرير فقط مع أسلوب التكلفة.",
    rows: 4,
  },
];

const REPORT_DEFAULTS_ASSUMPTIONS_FIELDS: ReportDefaultsField[] = [
  {
    key: "generalAssumptions",
    label: "افتراضات عامة",
    helper: "افتراضات مهمة عامة تنطبق على كل تقرير — يمكن استبدالها لكل مشروع عند الحاجة.",
    rows: 10,
  },
  {
    key: "specialAssumptions",
    label: "افتراضات خاصة",
    helper: "افتراضات إضافية ترتبط بطبيعة مشاريع الشركة.",
    rows: 6,
  },
];

type ReportDefaultsBuiltInSectionKey = "scope" | "methodology" | "assumptions";
type ReportDefaultsSectionKind = "built-in" | "custom";

type ReportDefaultsSectionGroup = {
  id: string;
  title: string;
  kind: ReportDefaultsSectionKind;
  builtInKey?: ReportDefaultsBuiltInSectionKey;
  fields: ReportDefaultsField[];
  itemCount: number;
};

type ReportDefaultsNode =
  | {
      id: string;
      kind: "field";
      label: string;
      rows: number;
      fieldSection: ReportDefaultsBuiltInSectionKey;
      fieldKey: string;
      value: string;
    }
  | {
      id: string;
      kind: "custom";
      label: string;
      section: CompanyReportCustomSectionForm;
      value: string;
    };

const REPORT_DEFAULTS_BUILT_IN_SECTIONS: Array<{
  id: ReportDefaultsBuiltInSectionKey;
  title: string;
  fields: ReportDefaultsField[];
}> = [
  { id: "scope", title: "نطاق العمل والقيود", fields: REPORT_DEFAULTS_SCOPE_FIELDS },
  { id: "methodology", title: "الأصل والمنهجية والمعاينة", fields: REPORT_DEFAULTS_METHODOLOGY_FIELDS },
  { id: "assumptions", title: "الافتراضات", fields: REPORT_DEFAULTS_ASSUMPTIONS_FIELDS },
];

const REPORT_DEFAULTS_UNGROUPED_CUSTOM_GROUP_ID = "custom-root";
const REPORT_DEFAULTS_UNGROUPED_CUSTOM_GROUP_TITLE = "أقسام إضافية";

function customReportSectionGroupId(section: CompanyReportCustomSectionForm) {
  return section.groupId?.trim() || REPORT_DEFAULTS_UNGROUPED_CUSTOM_GROUP_ID;
}

function customReportSectionGroupTitle(section: CompanyReportCustomSectionForm) {
  return section.groupTitle?.trim() || REPORT_DEFAULTS_UNGROUPED_CUSTOM_GROUP_TITLE;
}

function buildReportDefaultsSectionGroups(defaults: CompanyReportDefaultsForm): ReportDefaultsSectionGroup[] {
  const builtInIds = new Set(REPORT_DEFAULTS_BUILT_IN_SECTIONS.map((section) => section.id));
  const customGroups = new Map<string, CompanyReportCustomGroupForm>();
  for (const group of defaults.customGroups) {
    if (!builtInIds.has(group.id as ReportDefaultsBuiltInSectionKey)) customGroups.set(group.id, group);
  }
  for (const section of defaults.customSections) {
    const groupId = customReportSectionGroupId(section);
    if (!builtInIds.has(groupId as ReportDefaultsBuiltInSectionKey) && !customGroups.has(groupId)) {
      customGroups.set(groupId, { id: groupId, title: customReportSectionGroupTitle(section) });
    }
  }

  const builtInGroups: ReportDefaultsSectionGroup[] = REPORT_DEFAULTS_BUILT_IN_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    kind: "built-in",
    builtInKey: section.id,
    fields: section.fields,
    itemCount:
      section.fields.length +
      defaults.customSections.filter((item) => customReportSectionGroupId(item) === section.id).length,
  }));

  const extraGroups: ReportDefaultsSectionGroup[] = Array.from(customGroups.values()).map((group) => ({
    id: group.id,
    title: group.title || REPORT_DEFAULTS_UNGROUPED_CUSTOM_GROUP_TITLE,
    kind: "custom",
    fields: [],
    itemCount: defaults.customSections.filter((item) => customReportSectionGroupId(item) === group.id).length,
  }));

  return [...builtInGroups, ...extraGroups];
}

function buildReportDefaultsNodes(
  defaults: CompanyReportDefaultsForm,
  section: ReportDefaultsSectionGroup,
): ReportDefaultsNode[] {
  const fixedNodes: ReportDefaultsNode[] =
    section.kind === "built-in" && section.builtInKey
      ? section.fields.map((field) => ({
          id: `${section.builtInKey}:${field.key}`,
          kind: "field" as const,
          label: field.label,
          rows: field.rows ?? 5,
          fieldSection: section.builtInKey!,
          fieldKey: field.key,
          value: defaults[section.builtInKey!][field.key as keyof (typeof defaults)[typeof section.builtInKey]] ?? "",
        }))
      : [];

  const customNodes = defaults.customSections
    .filter((item) => customReportSectionGroupId(item) === section.id)
    .map((item) => ({
      id: item.id,
      kind: "custom" as const,
      label: item.sectionNumber ? `${item.sectionNumber} - ${item.title || "بند جديد"}` : item.title || "بند جديد",
      section: item,
      value: item.body,
    }));

  return [...fixedNodes, ...customNodes];
}

const ROLE_LABELS: Record<string, string> = {
  company_admin: "مدير الشركة",
  valuer: "مقيم",
  viewer: "مقيم",
  data_entry: "مدخل بيانات",
  reviewer: "مراجع",
  inspector: "مفتش ميداني",
};

type MemberRoleOption = "valuer" | "data_entry" | "reviewer" | "inspector";

function rowRoleToSelectValue(role: string): MemberRoleOption {
  if (role === "viewer") return "valuer";
  if (role === "data_entry" || role === "reviewer" || role === "inspector" || role === "valuer") {
    return role;
  }
  return "valuer";
}

function canManageCompanyUserRow(target: CompanyUserRow, currentUserId: string | undefined): boolean {
  if (!currentUserId) return false;
  if (target.role === "company_admin" && target.id !== currentUserId) return false;
  return true;
}

function canDeleteCompanyUserRow(target: CompanyUserRow, currentUserId: string | undefined): boolean {
  if (!currentUserId) return false;
  if (target.id === currentUserId) return false;
  if (target.role === "company_admin") return false;
  return true;
}

function userDisplayName(user: Pick<CompanyUserRow, "username" | "phone">): string {
  return user.phone?.trim() || user.username;
}

function isSafeValuationReportName(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized.length > 0 &&
    !/[0-9\u0660-\u0669\u06f0-\u06f9]/.test(normalized) &&
    /[A-Za-z\u00c0-\u024f\u0600-\u06ff]/.test(normalized)
  );
}

function valuationReportDisplayName(
  user: Pick<CompanyUserRow, "valuationReportDisplayName">,
): string {
  const configured = user.valuationReportDisplayName?.trim() ?? "";
  return isSafeValuationReportName(configured) ? configured : "لم يُحدد الاسم";
}

async function apiJson<T>(url: string, csrfToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(toApiUrl(url), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
      details?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | string> };
    };
    const fieldErrs = body.details?.fieldErrors;
    const fieldMsg =
      fieldErrs &&
      Object.entries(fieldErrs)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join(" — ");
    throw new Error(fieldMsg || body.message || body.error || "Request failed");
  }
  return (await response.json()) as T;
}

function LogoUploader({
  dataUrl,
  onChange,
  busy,
}: {
  dataUrl: string | null;
  onChange: (next: string | null) => void;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = useCallback(() => inputRef.current?.click(), []);
  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const url = await imageFileToSignaturePngDataUrl(file, 512);
      if (url) onChange(url);
    },
    [onChange],
  );
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png"
        className="sr-only"
        onChange={onFile}
      />
      <div
        className={cn(
          "flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-inner",
          !dataUrl && "border-dashed",
        )}
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <Building2 className="h-10 w-10 text-slate-300" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5 rounded-xl"
          disabled={busy}
          onClick={pick}
        >
          <Upload className="h-4 w-4" />
          رفع شعار
        </Button>
        {dataUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl text-rose-600 hover:bg-rose-50"
            disabled={busy}
            onClick={() => onChange(null)}
          >
            إزالة
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function newReportDefaultId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `company-section-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildAiTemplateJson(template: Omit<CompanyAiTemplateForm, "templateJson">): Record<string, unknown> {
  const visualRef = (value?: string | null) =>
    value?.startsWith("/uploads/company-report-templates/") ? value : value ? "stored-visual-asset" : null;
  return {
    type: "AI Template",
    version: 1,
    name: template.name,
    sourceFileName: template.sourceFileName,
    analysisSummary: template.analysisSummary,
    visualAssets: {
      coverImageDataUrl: visualRef(template.coverImageDataUrl),
      pageImageDataUrl: visualRef(template.pageImageDataUrl),
      landscapePageImageDataUrl: visualRef(template.landscapePageImageDataUrl),
    },
    theme: template.theme,
    layout: template.layout,
    sections: template.sections,
    dynamicVariables: template.dynamicVariables,
    rules: template.rules,
    binding: {
      projectData: [
        "basicInformation",
        "assetImages",
        "valuationCalculationImages",
        "reportSettings",
        "signatories",
      ],
      fillMode: "auto",
    },
  };
}

function buildLocalAiTemplateAnalysis(
  file: File,
  text: string,
  pageCount: number,
  visual?: Pick<AiTemplatePdfExtraction, "dominantColors" | "fontNames" | "pageSize">,
): Omit<CompanyAiTemplateForm, "id" | "type" | "createdAt" | "updatedAt" | "templateJson"> {
  const lines = text
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3);
  const sectionCandidates = lines.filter((line) =>
    /^(\d{1,2}([.\-]\d{1,2})?\s+|[IVX]{1,6}[.\-]\s+|[أ-ي]\s*[-.)])/.test(line) ||
    /^(scope|methodology|valuation|assumptions|appendix|executive|الفهرس|نطاق|منهجية|الأصل|الافتراضات|المرفقات)/i.test(line),
  );
  const uniqueSections = Array.from(new Set(sectionCandidates))
    .slice(0, 18)
    .map((title, index) => ({
      id: `section_${index + 1}`,
      title: title.slice(0, 180),
      order: index + 1,
      description: "قسم مستخرج من بنية التقرير المرفوع.",
      dynamicVariables: index === 0 ? ["projectName", "clientName", "valuationDate"] : [],
    }));
  const sections =
    uniqueSections.length > 0
      ? uniqueSections
      : [
          { id: "cover", title: "الغلاف", order: 1, description: "صفحة الغلاف والهوية البصرية.", dynamicVariables: ["projectName", "clientName"] },
          { id: "scope", title: "نطاق العمل", order: 2, description: "نطاق العمل والقيود.", dynamicVariables: ["purpose", "valuationDate"] },
          { id: "assets", title: "الأصول محل التقييم", order: 3, description: "وصف الأصول والجداول والصور.", dynamicVariables: ["assetsTable", "assetImages"] },
          { id: "valuation", title: "رأي القيمة", order: 4, description: "نتائج القيمة والتوقيعات.", dynamicVariables: ["finalValue", "signatories"] },
        ];
  const hasToc = /الفهرس|table of contents|contents/i.test(text);
  const hasWatermark = /watermark|علامة مائية|سري|confidential/i.test(text);
  const hasLogo = /logo|شعار|company|شركة/i.test(text);
  const hasTables = /جدول|table|القيمة|value|amount|total/i.test(text);
  const hasSignatures = /توقيع|signature|approved|اعتماد/i.test(text);
  const variableMap: CompanyAiTemplateVariableForm[] = [
    { key: "companyName", label: "اسم الشركة", source: "company.name", required: true },
    { key: "projectName", label: "اسم المشروع", source: "project.name", required: true },
    { key: "clientName", label: "اسم العميل", source: "project.clientName", required: true },
    { key: "valuationDate", label: "تاريخ التقييم", source: "reportData.valuationDate", required: true },
    { key: "reportDate", label: "تاريخ التقرير", source: "reportData.reportDate", required: false },
    { key: "assetsTable", label: "جدول الأصول", source: "project.assets", required: true },
    { key: "assetImages", label: "صور الأصول", source: "project.assetImages", required: false },
    {
      key: "valuationCalculationImages",
      label: "صور حسابات القيمة",
      source: "project.valuationAccountingWorkspace.images",
      required: false,
    },
    { key: "finalValue", label: "رأي القيمة النهائي", source: "reportData.finalValue", required: true },
    { key: "signatories", label: "التوقيعات", source: "company.reportSignatoryRows", required: false },
  ];
  return {
    name: file.name.replace(/\.pdf$/i, "").slice(0, 120) || "AI Template",
    sourceFileName: file.name,
    analysisSummary: `تم استخراج قالب بصري من ${pageCount} صفحة. يتضمن ${sections.length} قسم و${variableMap.length} متغير ديناميكي، مع حفظ خلفيات الغلاف والصفحات وألوان وخطوط التقرير الأصلي.`,
    theme: {
      primaryColor: visual?.dominantColors[0] ?? "#0C447C",
      secondaryColor: visual?.dominantColors[1] ?? "#1F7A8C",
      accentColor: visual?.dominantColors[2] ?? "#C9A227",
      palette: visual?.dominantColors ?? [],
      fontFamily:
        visual?.fontNames[0] ??
        (/arabic|عربي|تقييم|شركة/i.test(text) ? "Arabic report font" : "Document default font"),
      detectedFonts: visual?.fontNames ?? [],
      visualIdentity: hasLogo ? "تم رصد مؤشرات هوية شركة أو شعار داخل النص." : "لم تظهر مؤشرات شعار واضحة من النص المستخرج.",
      logo: hasLogo ? "logo-detected" : "not-detected",
      watermark: hasWatermark ? "watermark-detected" : "not-detected",
    },
    layout: {
      pageSize: `${visual?.pageSize.width ?? 595}x${visual?.pageSize.height ?? 842}`,
      orientation: visual?.pageSize.orientation ?? "portrait",
      margins: "هوامش قياسية قابلة للمراجعة بعد المعاينة.",
      header: hasLogo ? "Header يحتوي على هوية الشركة أو الشعار." : "Header افتراضي.",
      footer: /footer|صفحة|page/i.test(text) ? "Footer مرصود من ترقيم أو نصوص أسفل الصفحات." : "Footer افتراضي.",
      tableStyle: hasTables ? "جداول مالية/وصفية مرصودة." : "جداول اختيارية حسب بيانات المشروع.",
      imagePlacement: "صور الأصول وصور حسابات القيمة تملأ مواضع الصور تلقائيا.",
      signaturePlacement: hasSignatures ? "مواضع توقيع مرصودة." : "توقيعات الشركة تضاف في نهاية رأي القيمة.",
      tableOfContents: hasToc ? "فهرس مرصود." : "فهرس اختياري.",
    },
    sections,
    dynamicVariables: variableMap,
    rules: [
      "استخدم بيانات المشروع الحالية لملء جميع المتغيرات دون إعادة تحليل PDF.",
      "اترك الحقول غير المتوفرة فارغة ولا تستبدلها بنص تخميني.",
      "حافظ على ترتيب الأقسام المستخرج من التقرير المرفوع.",
      "أدرج صور الأصول في مواضع الصور، وصور حسابات القيمة في قسم التحليل أو المرفقات.",
      "استخدم توقيعات الشركة المحفوظة عند وجود موضع توقيع.",
    ],
  };
}

type AiTemplatePdfExtraction = {
  text: string;
  pageCount: number;
  coverImageDataUrl: string | null;
  pageImageDataUrl: string | null;
  landscapePageImageDataUrl: string | null;
  dominantColors: string[];
  fontNames: string[];
  pageSize: {
    width: number;
    height: number;
    orientation: "portrait" | "landscape" | "mixed";
  };
};

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

function sampleCanvasPalette(canvas: HTMLCanvasElement, maxColors = 8): string[] {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const { width, height } = canvas;
  if (width <= 0 || height <= 0) return [];
  const step = Math.max(10, Math.floor(Math.min(width, height) / 80));
  const counts = new Map<string, number>();
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const [rRaw, gRaw, bRaw, alpha = 255] = ctx.getImageData(x, y, 1, 1).data;
      if (alpha < 180) continue;
      const r = Math.round(rRaw / 24) * 24;
      const g = Math.round(gRaw / 24) * 24;
      const b = Math.round(bRaw / 24) * 24;
      const bright = (r + g + b) / 3;
      if (bright > 242 || bright < 18) continue;
      const key = rgbToHex(r, g, b);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxColors)
    .map(([color]) => color);
}

async function renderPdfPageDataUrl(page: PDFPageProxy) {
  const baseViewport = page.getViewport({ scale: 1 });
  const maxEdge = 1500;
  const scale = Math.min(2, maxEdge / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl: null, palette: [] as string[] };
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.82),
    palette: sampleCanvasPalette(canvas),
  };
}

async function extractPdfTextForAiTemplate(file: File): Promise<AiTemplatePdfExtraction> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc ||= new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  const palette = new Set<string>();
  const fontNames = new Set<string>();
  const orientations = new Set<"portrait" | "landscape">();
  let coverImageDataUrl: string | null = null;
  let pageImageDataUrl: string | null = null;
  let landscapePageImageDataUrl: string | null = null;
  let pageSize = { width: 595, height: 842 };
  const maxPages = Math.min(pdf.numPages, 30);
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    if (pageNumber === 1) pageSize = { width: Math.round(viewport.width), height: Math.round(viewport.height) };
    const orientation = viewport.width > viewport.height ? "landscape" : "portrait";
    orientations.add(orientation);
    const content = await page.getTextContent();
    const styles = (content as { styles?: Record<string, { fontFamily?: string }> }).styles ?? {};
    for (const style of Object.values(styles)) {
      if (style.fontFamily) fontNames.add(style.fontFamily.replace(/["']/g, "").trim());
    }
    const pageText = content.items
      .map((item) => {
        const textItem = item as { str?: unknown; fontName?: unknown };
        if (typeof textItem.fontName === "string") {
          const style = styles[textItem.fontName];
          if (style?.fontFamily) fontNames.add(style.fontFamily.replace(/["']/g, "").trim());
          else fontNames.add(textItem.fontName);
        }
        return typeof textItem.str === "string" ? textItem.str : "";
      })
      .filter(Boolean)
      .join(" ");
    pages.push(pageText);

    if (pageNumber <= Math.min(6, pdf.numPages)) {
      if (pageNumber === 1 || pageNumber === 2 || (orientation === "landscape" && !landscapePageImageDataUrl)) {
        const rendered = await renderPdfPageDataUrl(page);
        rendered.palette.forEach((color) => palette.add(color));
        if (pageNumber === 1) coverImageDataUrl = rendered.dataUrl;
        if (pageNumber === 2 || (pageNumber === 1 && pdf.numPages === 1)) pageImageDataUrl = rendered.dataUrl;
        if (orientation === "landscape" && !landscapePageImageDataUrl) landscapePageImageDataUrl = rendered.dataUrl;
      }
    }
  }
  return {
    text: pages.join("\n").slice(0, 60_000),
    pageCount: pdf.numPages,
    coverImageDataUrl,
    pageImageDataUrl: pageImageDataUrl ?? coverImageDataUrl,
    landscapePageImageDataUrl,
    dominantColors: Array.from(palette).slice(0, 10),
    fontNames: Array.from(fontNames).filter(Boolean).slice(0, 12),
    pageSize: {
      ...pageSize,
      orientation: orientations.size > 1 ? "mixed" : orientations.has("landscape") ? "landscape" : "portrait",
    },
  };
}

async function imageFileToReportTemplateDataUrl(
  file: File,
  options: { maxEdge: number; transparent?: boolean },
): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) return null;
    const scale = Math.min(1, options.maxEdge / Math.max(bmp.width, bmp.height));
    const width = Math.max(1, Math.round(bmp.width * scale));
    const height = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return null;
    }
    if (!options.transparent) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();
    return options.transparent ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.84);
  } catch {
    return null;
  }
}

function ReportTemplateImageUploader({
  label,
  helper,
  value,
  onChange,
  maxEdge,
  transparent = false,
}: {
  label: string;
  helper: string;
  value: string | null;
  onChange: (next: string | null) => void;
  maxEdge: number;
  transparent?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = useCallback(() => inputRef.current?.click(), []);
  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const url = await imageFileToReportTemplateDataUrl(file, { maxEdge, transparent });
      if (url) onChange(url);
    },
    [maxEdge, onChange, transparent],
  );
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        onChange={onFile}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-right">
          <div className="text-[12px] font-bold text-slate-800">{label}</div>
          <div className="mt-1 text-[10.5px] font-medium leading-5 text-slate-500">{helper}</div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#0C447C]">
          {transparent ? <Stamp className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-300" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" className="h-8 gap-1 rounded-xl" onClick={pick}>
            <Upload className="h-3.5 w-3.5" />
            رفع
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl text-rose-600 hover:bg-rose-50"
              onClick={() => onChange(null)}
            >
              حذف
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MemberSignatureCell({
  savedUrl,
  busy,
  onPersist,
}: {
  savedUrl: string | null;
  busy: boolean;
  onPersist: (url: string | null) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = useCallback(() => inputRef.current?.click(), []);
  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const url = await imageFileToSignaturePngDataUrl(file);
      if (url) await onPersist(url);
    },
    [onPersist],
  );
  const has = Boolean(savedUrl);
  return (
    <div className="flex min-h-[4rem] flex-col items-stretch justify-center gap-2 p-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png"
        className="sr-only"
        onChange={onFile}
      />
      {has ? (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={savedUrl!} alt="" className="max-h-16 max-w-full bg-transparent object-contain" />
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-[11px]"
              disabled={busy}
              onClick={pick}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              تغيير
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-[11px] text-rose-600"
              disabled={busy}
              onClick={() => void onPersist(null)}
            >
              حذف
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1 text-[11px]"
          disabled={busy}
          onClick={pick}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          رفع توقيع
        </Button>
      )}
    </div>
  );
}

function ProfessionalModalShell({
  icon,
  title,
  description,
  accent = "sky",
  children,
  footer,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  accent?: "sky" | "violet" | "emerald";
  children: ReactNode;
  footer: ReactNode;
}) {
  const accentClasses =
    accent === "violet"
      ? {
          glow: "from-violet-500/15 via-fuchsia-400/10 to-transparent",
          badge: "bg-violet-600 text-white shadow-violet-600/25",
        }
      : accent === "emerald"
        ? {
            glow: "from-emerald-500/15 via-teal-400/10 to-transparent",
            badge: "bg-emerald-600 text-white shadow-emerald-600/25",
          }
        : {
            glow: "from-sky-500/15 via-cyan-400/10 to-transparent",
            badge: "bg-[#0C447C] text-white shadow-[#0C447C]/25",
          };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="relative shrink-0 overflow-hidden border-b border-slate-100">
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-bl",
            accentClasses.glow,
          )}
        />
        <div className="relative flex items-start gap-3 px-5 pb-3.5 pt-5 sm:px-6 sm:pb-4 sm:pt-6">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg ring-4 ring-white sm:h-11 sm:w-11",
              accentClasses.badge,
            )}
          >
            {icon}
          </span>
          <DialogHeader className="min-w-0 flex-1 space-y-1 pe-8 pt-0.5 text-right">
            <DialogTitle className="text-[16px] font-black tracking-tight text-slate-950 sm:text-[17px]">
              {title}
            </DialogTitle>
            <DialogDescription className="text-[11.5px] font-medium leading-5 text-slate-500 sm:text-[12px] sm:leading-6">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
        <div className="grid gap-4">{children}</div>
      </div>
      <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 bg-slate-50/90 px-5 py-3.5 sm:justify-start sm:space-x-0 sm:px-6 sm:py-4">
        {footer}
      </DialogFooter>
    </div>
  );
}

const PROFESSIONAL_DIALOG_CONTENT_CLASS =
  "flex max-h-[min(92dvh,920px)] w-[min(96vw,32rem)] max-w-[min(96vw,32rem)] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 shadow-2xl sm:rounded-3xl";

function ReportDefaultsCard({
  title,
  description,
  icon,
  fields,
  values,
  onChange,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  fields: ReportDefaultsField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#0C447C] shadow-sm">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">{description}</p>
        </div>
      </header>
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="grid gap-2 text-right">
            <span className="text-[12px] font-bold text-slate-700">{field.label}</span>
            <Textarea
              value={values[field.key] ?? ""}
              onChange={(event) => onChange(field.key, event.target.value)}
              rows={field.rows ?? 5}
              dir="rtl"
              className="min-h-32 rounded-xl border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium leading-7 text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-100"
            />
            {field.helper ? (
              <span className="text-[10.5px] font-medium leading-5 text-slate-500">{field.helper}</span>
            ) : null}
          </label>
        ))}
      </div>
    </section>
  );
}

export default function CompanyAdminDashboard({
  variant,
  mode = "general",
  productId,
}: {
  variant: CompanyAdminDashboardVariant;
  mode?: CompanyAdminDashboardMode;
  productId?: ValueTechProductId;
}) {
  const { user, profile, csrfToken, loading, backendUnavailable, updateProfile } = useAuthTracking();
  const [data, setData] = useState<{
    company: CompanyInfo | null;
    users: CompanyUserRow[];
    reportOnlySignatories: ReportOnlySignatoryRow[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [brandingBusy, setBrandingBusy] = useState(false);
  const [signatureBusyUserId, setSignatureBusyUserId] = useState<string | null>(null);
  const [logoDraft, setLogoDraft] = useState<string | null>(null);
  const [commercialRegistrationDraft, setCommercialRegistrationDraft] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"valuer" | "data_entry" | "reviewer" | "inspector">("valuer");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newReportDisplayName, setNewReportDisplayName] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newMembershipNo, setNewMembershipNo] = useState("");

  const [addReportOnlyOpen, setAddReportOnlyOpen] = useState(false);
  const [reportOnlyName, setReportOnlyName] = useState("");
  const [reportOnlyJobTitle, setReportOnlyJobTitle] = useState("");
  const [reportOnlyMembershipNo, setReportOnlyMembershipNo] = useState("");
  const [editReportOnlyOpen, setEditReportOnlyOpen] = useState(false);
  const [editReportOnlyTarget, setEditReportOnlyTarget] = useState<ReportOnlySignatoryRow | null>(null);
  const [editReportOnlyName, setEditReportOnlyName] = useState("");
  const [editReportOnlyJobTitle, setEditReportOnlyJobTitle] = useState("");
  const [editReportOnlyMembershipNo, setEditReportOnlyMembershipNo] = useState("");
  const [deleteReportOnlyTarget, setDeleteReportOnlyTarget] = useState<ReportOnlySignatoryRow | null>(null);
  const [reportOnlyBusy, setReportOnlyBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyUserRow | null>(null);
  const [editRole, setEditRole] = useState<MemberRoleOption>("valuer");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editReportDisplayName, setEditReportDisplayName] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editMembershipNo, setEditMembershipNo] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CompanyUserRow | null>(null);
  const [userActionBusy, setUserActionBusy] = useState(false);

  const [reportDefaults, setReportDefaults] = useState<CompanyReportDefaultsForm>(() => emptyReportDefaults());
  const [reportDefaultsLoaded, setReportDefaultsLoaded] = useState(false);
  const [reportDefaultsSaving, setReportDefaultsSaving] = useState(false);
  const [reportDefaultsDirty, setReportDefaultsDirty] = useState(false);
  const [reportDefaultsBaseline, setReportDefaultsBaseline] = useState<CompanyReportDefaultsForm | null>(null);
  const [selectedCompanyWordTemplateId, setSelectedCompanyWordTemplateId] = useState("");
  const [selectedCompanyPptxTemplateId, setSelectedCompanyPptxTemplateId] = useState("");
  const reportDefaultsRef = useRef(reportDefaults);
  reportDefaultsRef.current = reportDefaults;
  const [activeReportDefaultsSectionId, setActiveReportDefaultsSectionId] = useState<string>("scope");
  const [activeReportDefaultsNodeId, setActiveReportDefaultsNodeId] = useState("");
  const [newReportDefaultsSectionTitle, setNewReportDefaultsSectionTitle] = useState("");
  const [newReportDefaultsNodeTitle, setNewReportDefaultsNodeTitle] = useState("");
  const [reportSectionOpen, setReportSectionOpen] = useState(false);
  const [reportSectionEditingId, setReportSectionEditingId] = useState<string | null>(null);
  const [reportSectionNumber, setReportSectionNumber] = useState("");
  const [reportSectionTitle, setReportSectionTitle] = useState("");
  const [reportSectionBody, setReportSectionBody] = useState("");
  const [letterheadImagesOpen, setLetterheadImagesOpen] = useState(false);
  const [letterheadPreviewId, setLetterheadPreviewId] = useState<string | null>(null);
  const [aiTemplateFile, setAiTemplateFile] = useState<File | null>(null);
  const [aiTemplateAnalyzing, setAiTemplateAnalyzing] = useState(false);
  const [aiTemplateReview, setAiTemplateReview] = useState<CompanyAiTemplateForm | null>(null);
  const [aiTemplateReviewJson, setAiTemplateReviewJson] = useState("");
  const [aiTemplateError, setAiTemplateError] = useState<string | null>(null);
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [personalJobTitle, setPersonalJobTitle] = useState("");
  const [personalMembershipNo, setPersonalMembershipNo] = useState("");
  const [personalSignature, setPersonalSignature] = useState<string | null>(null);
  const [personalBusy, setPersonalBusy] = useState(false);
  const [personalSignatureBusy, setPersonalSignatureBusy] = useState(false);

  useEffect(() => {
    setSelectedCompanyWordTemplateId((current) =>
      reportDefaults.wordTemplates.some((template) => template.id === current)
        ? current
        : reportDefaults.wordTemplates[0]?.id ?? "",
    );
  }, [reportDefaults.wordTemplates]);

  useEffect(() => {
    setSelectedCompanyPptxTemplateId((current) =>
      reportDefaults.pptxTemplates.some((template) => template.id === current)
        ? current
        : reportDefaults.pptxTemplates[0]?.id ?? "",
    );
  }, [reportDefaults.pptxTemplates]);
  const productQuery = useMemo(
    () => (productId ? `?productId=${encodeURIComponent(productId)}` : ""),
    [productId],
  );
  const productPayload = useMemo(() => (productId ? { productId } : {}), [productId]);
  const productLabel = productId ? VALUE_TECH_PRODUCT_LABELS_AR[productId] : null;

  const visibleReportOnlySignatories = useMemo(() => {
    if (!data) return [];
    if (!productId) {
      console.log("No product id found")
      return data.reportOnlySignatories;
    }
    console.log("product id found")

    return data.reportOnlySignatories.filter((row) => {
      const rowProductIds = row.productIds ?? [];
      if (rowProductIds.length === 0) {
        // Untagged legacy rows default to machine-valuation (equipment) only
        return productId === "machine-valuation";
      }
      return rowProductIds.includes(productId);
    });
  }, [data, productId]);

  const reportDefaultsOnly = mode === "report-defaults";
  const isCompanyAdmin = user?.role === "company_admin";

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const payload = await apiJson<{
        company: CompanyInfo | null;
        users: CompanyUserRow[];
        reportOnlySignatories?: ReportOnlySignatoryRow[];
      }>(`/api/company/users${productQuery}`, csrfToken);
      setData({
        company: payload.company,
        users: payload.users ?? [],
        reportOnlySignatories: (payload.reportOnlySignatories ?? []).map((row) => ({
          id: row.id,
          name: row.name ?? "",
          jobTitle: row.jobTitle ?? "",
          membershipNo: row.membershipNo ?? "",
          signatureImageDataUrl: row.signatureImageDataUrl ?? null,
          productIds: row.productIds ?? [], // NEW
          createdAt: row.createdAt ?? "",
          updatedAt: row.updatedAt ?? "",
          isReportOnly: true,
        })),
      });
      setLogoDraft(payload.company?.logoDataUrl ?? null);
      setCommercialRegistrationDraft(payload.company?.commercialRegistration?.trim() ?? "");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "تعذر التحميل.");
    }
  }, [csrfToken, productQuery]);

  useEffect(() => {
    if (!loading && isCompanyAdmin) {
      void load();
    }
  }, [isCompanyAdmin, load, loading]);

  const canAccess = Boolean(user) && (!reportDefaultsOnly || isCompanyAdmin);

  useEffect(() => {
    if (!user) return;
    setPersonalEmail(profile?.email ?? user.email ?? "");
    setPersonalPhone(profile?.phone ?? user.phone ?? user.username ?? "");
    setPersonalJobTitle(user.valuationReportJobTitle ?? "");
    setPersonalMembershipNo(user.valuationReportMembershipNo ?? "");
  }, [profile?.email, profile?.phone, user]);

  const loadPersonalSignature = useCallback(async () => {
    try {
      const payload = await apiJson<{
        userId: string;
        valuationReportSignatureDataUrl: string | null;
      }>("/api/company/user-signature", csrfToken);
      setPersonalSignature(payload.valuationReportSignatureDataUrl ?? null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "تعذر تحميل توقيع المستخدم.");
    }
  }, [csrfToken]);

  useEffect(() => {
    if (!loading && user && !isCompanyAdmin && !reportDefaultsOnly) {
      void loadPersonalSignature();
    }
  }, [isCompanyAdmin, loadPersonalSignature, loading, reportDefaultsOnly, user]);

  const persistPersonalProfile = useCallback(async () => {
    setPersonalBusy(true);
    setSubmitError(null);
    setStatus(null);
    try {
      await updateProfile({
        email: personalEmail.trim() || null,
        phone: personalPhone.trim() || null,
        valuationReportJobTitle: personalJobTitle.trim() || null,
        valuationReportMembershipNo: personalMembershipNo.trim() || null,
      });
      setStatus("تم حفظ بياناتك الشخصية.");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل حفظ بيانات المستخدم.");
    } finally {
      setPersonalBusy(false);
    }
  }, [personalEmail, personalJobTitle, personalMembershipNo, personalPhone, updateProfile]);

  const persistPersonalSignature = useCallback(
    async (url: string | null) => {
      setPersonalSignatureBusy(true);
      setSubmitError(null);
      setStatus(null);
      try {
        await apiJson("/api/company/user-signature", csrfToken, {
          method: "PATCH",
          body: JSON.stringify({ valuationReportSignatureDataUrl: url }),
        });
        setPersonalSignature(url);
        setStatus("تم حفظ توقيعك.");
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "فشل حفظ التوقيع.");
      } finally {
        setPersonalSignatureBusy(false);
      }
    },
    [csrfToken],
  );

  const persistLogo = async () => {
    setBrandingBusy(true);
    setSubmitError(null);
    try {
      await apiJson("/api/company/branding", csrfToken, {
        method: "PATCH",
        body: JSON.stringify({
          logoDataUrl: logoDraft && logoDraft.length > 0 ? logoDraft : null,
          commercialRegistration: commercialRegistrationDraft.trim(),
        }),
      });
      setStatus("تم حفظ بيانات الشركة.");
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل الحفظ.");
    } finally {
      setBrandingBusy(false);
    }
  };

  const persistCompanyInfo = async () => {
    setBrandingBusy(true);
    setSubmitError(null);
    try {
      await apiJson("/api/company/branding", csrfToken, {
        method: "PATCH",
        body: JSON.stringify({
          commercialRegistration: commercialRegistrationDraft.trim(),
        }),
      });
      setStatus("تم حفظ السجل التجاري.");
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل الحفظ.");
    } finally {
      setBrandingBusy(false);
    }
  };

  const loadReportDefaults = useCallback(async () => {
    try {
      const payload = await apiJson<{ reportDefaults?: Partial<CompanyReportDefaultsForm> | null }>(
        "/api/company/admin/report-defaults",
        csrfToken,
      );
      const normalized = normalizeReportDefaults(payload.reportDefaults ?? null);
      setReportDefaults(normalized);
      setReportDefaultsBaseline(normalized);
      setReportDefaultsDirty(false);
      setReportDefaultsLoaded(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "تعذر تحميل أقسام التقرير.");
    }
  }, [csrfToken]);

  useEffect(() => {
    if (!loading && isCompanyAdmin && !reportDefaultsLoaded) {
      void loadReportDefaults();
    }
  }, [isCompanyAdmin, loadReportDefaults, loading, reportDefaultsLoaded]);

  const reportDefaultsSectionGroups = useMemo(
    () => buildReportDefaultsSectionGroups(reportDefaults),
    [reportDefaults],
  );
  const activeReportDefaultsSection =
    reportDefaultsSectionGroups.find((section) => section.id === activeReportDefaultsSectionId) ??
    reportDefaultsSectionGroups[0];
  const activeReportDefaultsNodes = useMemo(
    () =>
      activeReportDefaultsSection
        ? buildReportDefaultsNodes(reportDefaults, activeReportDefaultsSection)
        : [],
    [activeReportDefaultsSection, reportDefaults],
  );
  const activeReportDefaultsNode =
    activeReportDefaultsNodes.find((node) => node.id === activeReportDefaultsNodeId) ??
    activeReportDefaultsNodes[0] ??
    null;

  useEffect(() => {
    if (reportDefaultsSectionGroups.length === 0) return;
    if (!reportDefaultsSectionGroups.some((section) => section.id === activeReportDefaultsSectionId)) {
      setActiveReportDefaultsSectionId(reportDefaultsSectionGroups[0]!.id);
    }
  }, [activeReportDefaultsSectionId, reportDefaultsSectionGroups]);

  useEffect(() => {
    if (activeReportDefaultsNodes.length === 0) {
      if (activeReportDefaultsNodeId) setActiveReportDefaultsNodeId("");
      return;
    }
    if (!activeReportDefaultsNodes.some((node) => node.id === activeReportDefaultsNodeId)) {
      setActiveReportDefaultsNodeId(activeReportDefaultsNodes[0]!.id);
    }
  }, [activeReportDefaultsNodeId, activeReportDefaultsNodes]);

  const updateReportDefaultsField = useCallback(
    (section: "scope" | "methodology" | "assumptions", key: string, value: string) => {
      setReportDefaults((current) => ({
        ...current,
        [section]: { ...current[section], [key]: value },
      }));
      setReportDefaultsDirty(true);
    },
    [],
  );

  const addReportDefaultsSectionGroup = useCallback(() => {
    const title = newReportDefaultsSectionTitle.trim();
    if (!title) {
      setSubmitError("أدخل اسم القسم أولا.");
      return;
    }
    const group: CompanyReportCustomGroupForm = {
      id: `company-group-${newReportDefaultId()}`,
      title,
    };
    setReportDefaults((current) => ({
      ...current,
      customGroups: [...current.customGroups, group],
    }));
    setActiveReportDefaultsSectionId(group.id);
    setActiveReportDefaultsNodeId("");
    setNewReportDefaultsSectionTitle("");
    setSubmitError(null);
    setReportDefaultsDirty(true);
  }, [newReportDefaultsSectionTitle]);

  const renameCustomReportDefaultsGroup = useCallback((groupId: string, title: string) => {
    setReportDefaults((current) => ({
      ...current,
      customGroups: current.customGroups.some((group) => group.id === groupId)
        ? current.customGroups.map((group) => (group.id === groupId ? { ...group, title } : group))
        : [...current.customGroups, { id: groupId, title }],
      customSections: current.customSections.map((section) =>
        customReportSectionGroupId(section) === groupId ? { ...section, groupTitle: title } : section,
      ),
    }));
    setReportDefaultsDirty(true);
  }, []);

  const removeCustomReportDefaultsGroup = useCallback((groupId: string) => {
    if (!window.confirm("سيتم حذف القسم وكل البنود داخله. هل تريد المتابعة؟")) return;
    setReportDefaults((current) => ({
      ...current,
      customGroups: current.customGroups.filter((group) => group.id !== groupId),
      customSections: current.customSections.filter((section) => customReportSectionGroupId(section) !== groupId),
    }));
    setActiveReportDefaultsSectionId("scope");
    setActiveReportDefaultsNodeId("");
    setReportDefaultsDirty(true);
  }, []);

  const addReportDefaultsNode = useCallback(() => {
    if (!activeReportDefaultsSection) return;
    const title = newReportDefaultsNodeTitle.trim() || "بند جديد";
    const section: CompanyReportCustomSectionForm = {
      id: newReportDefaultId(),
      groupId: activeReportDefaultsSection.id,
      groupTitle: activeReportDefaultsSection.title,
      sectionNumber: "",
      title,
      body: "",
    };
    setReportDefaults((current) => ({
      ...current,
      customSections: [...current.customSections, section],
    }));
    setActiveReportDefaultsNodeId(section.id);
    setNewReportDefaultsNodeTitle("");
    setReportDefaultsDirty(true);
  }, [activeReportDefaultsSection, newReportDefaultsNodeTitle]);

  const updateReportDefaultsCustomSection = useCallback(
    (sectionId: string, patch: Partial<CompanyReportCustomSectionForm>) => {
      setReportDefaults((current) => ({
        ...current,
        customSections: current.customSections.map((section) =>
          section.id === sectionId ? { ...section, ...patch } : section,
        ),
      }));
      setReportDefaultsDirty(true);
    },
    [],
  );

  const openNewReportSection = useCallback(() => {
    setReportSectionEditingId(null);
    setReportSectionNumber("");
    setReportSectionTitle("");
    setReportSectionBody("");
    setReportSectionOpen(true);
  }, []);

  const openEditReportSection = useCallback((section: CompanyReportCustomSectionForm) => {
    setReportSectionEditingId(section.id);
    setReportSectionNumber(section.sectionNumber);
    setReportSectionTitle(section.title);
    setReportSectionBody(section.body);
    setReportSectionOpen(true);
  }, []);

  const persistReportSectionDraft = useCallback(() => {
    const title = reportSectionTitle.trim();
    const body = reportSectionBody.trim();
    if (!title && !body) {
      setSubmitError("أدخل عنوان البند أو تفاصيله أولاً.");
      return;
    }
    const section: CompanyReportCustomSectionForm = {
      id: reportSectionEditingId ?? newReportDefaultId(),
      sectionNumber: reportSectionNumber.trim(),
      title: title || "بند إضافي",
      body,
    };
    setReportDefaults((current) => {
      const exists = current.customSections.some((item) => item.id === section.id);
      return {
        ...current,
        customSections: exists
          ? current.customSections.map((item) => (item.id === section.id ? section : item))
          : [...current.customSections, section],
      };
    });
    setReportDefaultsDirty(true);
    setSubmitError(null);
    setReportSectionOpen(false);
  }, [reportSectionBody, reportSectionEditingId, reportSectionNumber, reportSectionTitle]);

  const removeReportSection = useCallback((id: string) => {
    setReportDefaults((current) => ({
      ...current,
      customSections: current.customSections.filter((item) => item.id !== id),
    }));
    setActiveReportDefaultsNodeId((current) => (current === id ? "" : current));
    setReportDefaultsDirty(true);
  }, []);

  const updateLetterhead = useCallback(
    <K extends keyof CompanyReportLetterheadForm,>(key: K, value: CompanyReportLetterheadForm[K]) => {
      setReportDefaults((current) => ({
        ...current,
        letterhead: { ...current.letterhead, [key]: value },
      }));
      setReportDefaultsDirty(true);
    },
    [],
  );

  const persistReportDefaults = useCallback(async (nextReportDefaults?: CompanyReportDefaultsForm) => {
    const payloadToSave = prepareCompanyDocumentTemplatesForSave(
      nextReportDefaults ?? reportDefaultsRef.current,
    );
    // Canonical arrays already contain the files. Do not duplicate a large
    // data URL in the legacy singleton mirrors inside the same PATCH body.
    const requestPayload = {
      ...payloadToSave,
      wordTemplate: null,
      pptxTemplate: null,
    };
    setReportDefaultsSaving(true);
    setSubmitError(null);
    setStatus(null);
    try {
      const payload = await apiJson<{ reportDefaults?: Partial<CompanyReportDefaultsForm> | null }>(
        "/api/company/admin/report-defaults",
        csrfToken,
        {
          method: "PATCH",
          body: JSON.stringify(requestPayload),
        },
      );
      if (payload.reportDefaults) {
        const normalized = normalizeReportDefaults(payload.reportDefaults);
        setReportDefaults(normalized);
        setReportDefaultsBaseline(normalized);
      } else {
        setReportDefaults(payloadToSave);
        setReportDefaultsBaseline(payloadToSave);
      }
      setReportDefaultsDirty(false);
      setStatus("تم حفظ أقسام التقرير وروابط القوالب.");
      return true;
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل حفظ أقسام التقرير.");
      return false;
    } finally {
      setReportDefaultsSaving(false);
    }
  }, [csrfToken]);

  /**
   * Selecting a system report template is an explicit adoption action, not a
   * draft-only field edit.  Persist the exact next object so a reload cannot
   * fall back to the previously saved template while the project still shows
   * a different one.
   */
  const applySystemReportTemplate = useCallback(
    async (template: LetterheadTemplateOption) => {
      if (reportDefaultsSaving) return;

      const isCompanyLetterhead = template.id === COMPANY_LETTERHEAD_TEMPLATE_OPTION.id;
      const next: CompanyReportDefaultsForm = {
        ...reportDefaultsRef.current,
        letterhead: {
          ...reportDefaultsRef.current.letterhead,
          templateId: template.id,
          outputFormat: template.outputFormat,
          enabled: isCompanyLetterhead,
        },
      };

      setReportDefaults(next);
      setReportDefaultsDirty(true);
      const hasConfiguredCompanyLetterheadImages = [
        next.letterhead.coverImageDataUrl,
        next.letterhead.pageImageDataUrl,
        next.letterhead.landscapePageImageDataUrl,
        next.letterhead.logoDataUrl,
        next.letterhead.footerImageDataUrl,
        next.letterhead.signatureStampDataUrl,
      ].some(Boolean);
      if (isCompanyLetterhead && !hasConfiguredCompanyLetterheadImages) {
        setLetterheadImagesOpen(true);
      }

      const saved = await persistReportDefaults(next);
      if (saved) {
        setStatus(`تم اعتماد قالب «${template.title}» وحفظه كقالب النظام.`);
      }
    },
    [persistReportDefaults, reportDefaultsSaving],
  );

  const analyzeAiTemplatePdf = useCallback(async () => {
    if (!aiTemplateFile) {
      setAiTemplateError("ارفع ملف PDF أولا.");
      return;
    }
    if (!aiTemplateFile.name.toLowerCase().endsWith(".pdf")) {
      setAiTemplateError("يجب رفع ملف PDF فقط.");
      return;
    }
    setAiTemplateAnalyzing(true);
    setAiTemplateError(null);
    setSubmitError(null);
    try {
      const extracted = await extractPdfTextForAiTemplate(aiTemplateFile);
      if (!extracted.text.trim()) {
        throw new Error("تعذر استخراج نص من PDF. جرّب ملفا يحتوي على نص قابل للنسخ.");
      }

      let analysis: Omit<CompanyAiTemplateForm, "id" | "type" | "createdAt" | "updatedAt" | "templateJson">;
      try {
        const response = await fetch("/api/mv/ai-template/analyze", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: aiTemplateFile.name,
            pageCount: extracted.pageCount,
            text: extracted.text,
            visualSummary: {
              dominantColors: extracted.dominantColors,
              fontNames: extracted.fontNames,
              pageSize: extracted.pageSize,
              hasCoverImage: Boolean(extracted.coverImageDataUrl),
              hasPageImage: Boolean(extracted.pageImageDataUrl),
              hasLandscapePageImage: Boolean(extracted.landscapePageImageDataUrl),
            },
          }),
        });
        const payload = (await response.json()) as {
          template?: Partial<Omit<CompanyAiTemplateForm, "id" | "type" | "createdAt" | "updatedAt" | "templateJson">>;
          message?: string;
        };
        if (!response.ok || !payload.template) {
          throw new Error(payload.message || "تعذر تشغيل تحليل Gemini.");
        }
        const fallback = buildLocalAiTemplateAnalysis(aiTemplateFile, extracted.text, extracted.pageCount, extracted);
        analysis = {
          ...fallback,
          ...payload.template,
          theme: {
            ...fallback.theme,
            ...normalizeAiTemplateRecord(payload.template.theme),
            palette: extracted.dominantColors,
            detectedFonts: extracted.fontNames,
          },
          layout: {
            ...fallback.layout,
            ...normalizeAiTemplateRecord(payload.template.layout),
            pageSize: `${extracted.pageSize.width}x${extracted.pageSize.height}`,
            orientation: extracted.pageSize.orientation,
          },
          sections: normalizeCompanyAiTemplates([
            {
              name: "preview",
              sections: payload.template.sections,
              dynamicVariables: payload.template.dynamicVariables,
            },
          ])[0]?.sections ?? fallback.sections,
          dynamicVariables:
            normalizeCompanyAiTemplates([
              {
                name: "preview",
                sections: payload.template.sections,
                dynamicVariables: payload.template.dynamicVariables,
              },
            ])[0]?.dynamicVariables ?? fallback.dynamicVariables,
          rules: normalizeAiTemplateStringList(payload.template.rules).length
            ? normalizeAiTemplateStringList(payload.template.rules)
            : fallback.rules,
        };
      } catch {
        analysis = buildLocalAiTemplateAnalysis(aiTemplateFile, extracted.text, extracted.pageCount, extracted);
      }

      const now = new Date().toISOString();
      const templateWithoutJson = {
        id: `ai-template-${newReportDefaultId()}`,
        type: "AI Template" as const,
        name: analysis.name || aiTemplateFile.name.replace(/\.pdf$/i, ""),
        sourceFileName: aiTemplateFile.name,
        createdAt: now,
        updatedAt: now,
        analysisSummary: analysis.analysisSummary,
        coverImageDataUrl: extracted.coverImageDataUrl,
        pageImageDataUrl: extracted.pageImageDataUrl,
        landscapePageImageDataUrl: extracted.landscapePageImageDataUrl,
        theme: analysis.theme,
        layout: analysis.layout,
        sections: analysis.sections,
        dynamicVariables: analysis.dynamicVariables,
        rules: analysis.rules,
      };
      const template: CompanyAiTemplateForm = {
        ...templateWithoutJson,
        templateJson: buildAiTemplateJson(templateWithoutJson),
      };
      setAiTemplateReview(template);
      setAiTemplateReviewJson(JSON.stringify(template.templateJson, null, 2));
      setStatus("تم تحليل PDF. راجع القالب ثم احفظه.");
    } catch (error) {
      setAiTemplateError(error instanceof Error ? error.message : "تعذر تحليل PDF.");
    } finally {
      setAiTemplateAnalyzing(false);
    }
  }, [aiTemplateFile]);

  const saveAiTemplateReview = useCallback(async () => {
    if (!aiTemplateReview) return;
    let templateJson: Record<string, unknown>;
    try {
      const parsed = JSON.parse(aiTemplateReviewJson || "{}") as unknown;
      templateJson = normalizeAiTemplateRecord(parsed);
    } catch {
      setAiTemplateError("JSON غير صالح. أصلح المراجعة قبل الحفظ.");
      return;
    }
    const now = new Date().toISOString();
    const template: CompanyAiTemplateForm = {
      ...aiTemplateReview,
      updatedAt: now,
      templateJson,
    };
    const next: CompanyReportDefaultsForm = {
      ...reportDefaults,
      aiTemplates: [
        template,
        ...reportDefaults.aiTemplates.filter((item) => item.id !== template.id),
      ].slice(0, 20),
    };
    setReportDefaults(next);
    setReportDefaultsDirty(true);
    const saved = await persistReportDefaults(next);
    if (saved) {
      setAiTemplateFile(null);
      setAiTemplateReview(null);
      setAiTemplateReviewJson("");
      setAiTemplateError(null);
      setStatus("تم حفظ قالب الذكاء الاصطناعي.");
    }
  }, [aiTemplateReview, aiTemplateReviewJson, persistReportDefaults, reportDefaults]);

  const removeAiTemplate = useCallback(
    async (templateId: string) => {
      if (!window.confirm("سيتم حذف قالب الذكاء الاصطناعي من إعدادات الشركة. هل تريد المتابعة؟")) return;
      const next: CompanyReportDefaultsForm = {
        ...reportDefaults,
        aiTemplates: reportDefaults.aiTemplates.filter((template) => template.id !== templateId),
      };
      setReportDefaults(next);
      setReportDefaultsDirty(true);
      await persistReportDefaults(next);
    },
    [persistReportDefaults, reportDefaults],
  );

  const uploadCompanyWordTemplate = useCallback(
    async (file: File, mode: "new" | "replace") => {
      if (!file.name.toLowerCase().endsWith(".docx")) {
        setSubmitError("يرجى رفع ملف Word بصيغة .docx فقط.");
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setSubmitError("حجم قالب Word يجب ألا يتجاوز 25MB.");
        return;
      }
      setSubmitError(null);
      setStatus(null);
      try {
        const buffer = await file.arrayBuffer();
        const templateVariables = scanDocxTemplateVariables(buffer);
        const previousDefaults = reportDefaults;
        const wasDirty = reportDefaultsDirty;
        const previousSelection = selectedCompanyWordTemplateId;
        const previousTemplate = mode === "replace"
          ? reportDefaults.wordTemplates.find((template) => template.id === selectedCompanyWordTemplateId) ?? null
          : null;
        if (mode === "replace" && !previousTemplate) {
          setSubmitError("اختر قالب Word المراد استبداله أولاً.");
          return;
        }
        const previousDetected = new Set(
          (previousTemplate?.bookmarkNames ?? []).map((name) => normalizeTemplateVariableKey(name)),
        );
        const nextDetected = new Set(
          templateVariables.map((name) => normalizeTemplateVariableKey(name)),
        );
        const preservedMappings = mergeTemplateVariableMappings({
          variables: templateVariables,
          previousMappings: previousTemplate?.variableMappings ?? [],
          previousDetected,
          nextDetected,
        });
        const id = previousTemplate?.id ?? newCompanyDocumentTemplateId("word");
        const name = previousTemplate?.name ?? uniqueCompanyDocumentTemplateName(
          file.name.replace(/\.docx$/i, ""),
          file.name,
          reportDefaults.wordTemplates,
        );
        const uploadedTemplate: CompanyReportWordTemplateForm = {
          id,
          name,
          fileName: file.name,
          fileDataUrl: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${arrayBufferToBase64(buffer)}`,
          fileUrl: null,
          uploadedAt: new Date().toISOString(),
          sizeBytes: file.size,
          bookmarkNames: templateVariables,
          variableMappings: preservedMappings,
          // Uploading a fresh version intentionally reads its discovered
          // variables again, including rows hidden in the prior dashboard.
          excludedVariableNames: [],
        };
        const wordTemplates = previousTemplate
          ? reportDefaults.wordTemplates.map((template) => template.id === id ? uploadedTemplate : template)
          : [...reportDefaults.wordTemplates, uploadedTemplate];
        const next: CompanyReportDefaultsForm = {
          ...withCompanyDocumentTemplates(reportDefaults, "word", wordTemplates),
        };
        setSelectedCompanyWordTemplateId(id);
        setReportDefaults(next);
        setReportDefaultsDirty(true);
        const saved = await persistReportDefaults(next);
        if (!saved) {
          // A template must not remain visible as saved if persistence failed.
          setReportDefaults(previousDefaults);
          setReportDefaultsDirty(wasDirty);
          setSelectedCompanyWordTemplateId(previousSelection);
          return;
        }
        if (saved) setStatus(mode === "new" ? "تم إرفاق قالب Word جديد للشركة." : "تم استبدال ملف قالب Word المحدد.");
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "تعذر قراءة قالب Word.");
      }
    },
    [persistReportDefaults, reportDefaults, reportDefaultsDirty, selectedCompanyWordTemplateId],
  );

  const removeCompanyWordTemplate = useCallback(async () => {
    const selected = reportDefaults.wordTemplates.find((template) => template.id === selectedCompanyWordTemplateId);
    if (!selected) return;
    if (!window.confirm(`سيتم حذف قالب Word «${selected.name}» من إعدادات الشركة. هل تريد المتابعة؟`)) return;
    const previousDefaults = reportDefaults;
    const wasDirty = reportDefaultsDirty;
    const wordTemplates = reportDefaults.wordTemplates.filter((template) => template.id !== selected.id);
    const next = withCompanyDocumentTemplates(reportDefaults, "word", wordTemplates);
    const nextSelection = wordTemplates[0]?.id ?? "";
    setSelectedCompanyWordTemplateId(nextSelection);
    setReportDefaults(next);
    setReportDefaultsDirty(true);
    const saved = await persistReportDefaults(next);
    if (!saved) {
      setReportDefaults(previousDefaults);
      setReportDefaultsDirty(wasDirty);
      setSelectedCompanyWordTemplateId(selected.id);
      return;
    }
    if (saved) setStatus(`تم حذف قالب Word «${selected.name}».`);
  }, [persistReportDefaults, reportDefaults, reportDefaultsDirty, selectedCompanyWordTemplateId]);

  const uploadCompanyPptxTemplate = useCallback(
    async (file: File, mode: "new" | "replace") => {
      if (!file.name.toLowerCase().endsWith(".pptx")) {
        setSubmitError("يرجى رفع ملف PowerPoint بصيغة .pptx فقط.");
        return;
      }
      if (file.size > 35 * 1024 * 1024) {
        setSubmitError("حجم قالب PowerPoint يجب ألا يتجاوز 35MB.");
        return;
      }
      setSubmitError(null);
      setStatus(null);
      try {
        const buffer = await file.arrayBuffer();
        const scan = scanPptxTemplate(buffer);
        const previousDefaults = reportDefaults;
        const wasDirty = reportDefaultsDirty;
        const previousSelection = selectedCompanyPptxTemplateId;
        const variables = [...new Set([
          ...scan.variables,
          // A number of legacy presentation templates use a visible image
          // marker, rather than a text placeholder. Make it configurable too.
          ...scan.assetImageMarkerNames,
        ])];
        const prior = mode === "replace"
          ? reportDefaults.pptxTemplates.find((template) => template.id === selectedCompanyPptxTemplateId) ?? null
          : null;
        if (mode === "replace" && !prior) {
          setSubmitError("اختر قالب PowerPoint المراد استبداله أولاً.");
          return;
        }
        const priorDetected = new Set(
          (prior?.bookmarkNames ?? []).map((name) => normalizeTemplateVariableKey(name)),
        );
        const nextDetected = new Set(
          variables.map((name) => normalizeTemplateVariableKey(name)),
        );
        const preservedMappings = mergeTemplateVariableMappings({
          variables,
          previousMappings: prior?.variableMappings ?? [],
          previousDetected: priorDetected,
          nextDetected,
        });
        const id = prior?.id ?? newCompanyDocumentTemplateId("pptx");
        const name = prior?.name ?? uniqueCompanyDocumentTemplateName(
          file.name.replace(/\.pptx$/i, ""),
          file.name,
          reportDefaults.pptxTemplates,
        );
        const uploadedTemplate: CompanyReportPptxTemplateForm = {
          id,
          name,
          fileName: file.name,
          fileDataUrl: `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${arrayBufferToBase64(buffer)}`,
          fileUrl: null,
          uploadedAt: new Date().toISOString(),
          sizeBytes: file.size,
          bookmarkNames: variables,
          variableMappings: preservedMappings,
          excludedVariableNames: [],
        };
        const pptxTemplates = prior
          ? reportDefaults.pptxTemplates.map((template) => template.id === id ? uploadedTemplate : template)
          : [...reportDefaults.pptxTemplates, uploadedTemplate];
        const next = withCompanyDocumentTemplates(reportDefaults, "pptx", pptxTemplates);
        setSelectedCompanyPptxTemplateId(id);
        setReportDefaults(next);
        setReportDefaultsDirty(true);
        const saved = await persistReportDefaults(next);
        if (!saved) {
          // Never display a browser-only template as if it were saved for the
          // company. The merge endpoint must only use persisted templates.
          setReportDefaults(previousDefaults);
          setReportDefaultsDirty(wasDirty);
          setSelectedCompanyPptxTemplateId(previousSelection);
          return;
        }
        if (saved) setStatus(mode === "new" ? "تم إرفاق قالب PowerPoint جديد للشركة." : "تم استبدال ملف قالب PowerPoint المحدد.");
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "تعذر قراءة قالب PowerPoint.");
      }
    },
    [persistReportDefaults, reportDefaults, reportDefaultsDirty, selectedCompanyPptxTemplateId],
  );

  const updateCompanyDocumentTemplateMappings = useCallback(
    (
      format: "word" | "pptx",
      variableMappings: CompanyReportTemplateVariableMappingForm[],
      excludedVariableNames: string[],
    ) => {
      setReportDefaults((current) => {
        const selectedId = format === "word" ? selectedCompanyWordTemplateId : selectedCompanyPptxTemplateId;
        const templates = format === "word" ? current.wordTemplates : current.pptxTemplates;
        if (!templates.some((template) => template.id === selectedId)) return current;
        const nextTemplates = templates.map((template) =>
          template.id === selectedId
            ? { ...template, variableMappings, excludedVariableNames }
            : template,
        );
        return withCompanyDocumentTemplates(current, format, nextTemplates);
      });
      setReportDefaultsDirty(true);
    },
    [selectedCompanyPptxTemplateId, selectedCompanyWordTemplateId],
  );

  const renameCompanyDocumentTemplate = useCallback((
    format: "word" | "pptx",
    name: string,
    finalize = false,
  ) => {
    const selectedId = format === "word" ? selectedCompanyWordTemplateId : selectedCompanyPptxTemplateId;
    setReportDefaults((current) => {
      const templates = format === "word" ? current.wordTemplates : current.pptxTemplates;
      const selected = templates.find((template) => template.id === selectedId);
      if (!selected) return current;
      const nextName = finalize
        ? uniqueCompanyDocumentTemplateName(name, selected.fileName, templates, selectedId)
        : name;
      return withCompanyDocumentTemplates(
        current,
        format,
        templates.map((template) => template.id === selectedId ? { ...template, name: nextName } : template),
      );
    });
    setReportDefaultsDirty(true);
  }, [selectedCompanyPptxTemplateId, selectedCompanyWordTemplateId]);

  const removeCompanyPptxTemplate = useCallback(async () => {
    const selected = reportDefaults.pptxTemplates.find((template) => template.id === selectedCompanyPptxTemplateId);
    if (!selected) return;
    if (!window.confirm(`سيتم حذف قالب PowerPoint «${selected.name}» من إعدادات الشركة. هل تريد المتابعة؟`)) return;
    const previousDefaults = reportDefaults;
    const wasDirty = reportDefaultsDirty;
    const pptxTemplates = reportDefaults.pptxTemplates.filter((template) => template.id !== selected.id);
    const next = withCompanyDocumentTemplates(reportDefaults, "pptx", pptxTemplates);
    setSelectedCompanyPptxTemplateId(pptxTemplates[0]?.id ?? "");
    setReportDefaults(next);
    setReportDefaultsDirty(true);
    const saved = await persistReportDefaults(next);
    if (!saved) {
      setReportDefaults(previousDefaults);
      setReportDefaultsDirty(wasDirty);
      setSelectedCompanyPptxTemplateId(selected.id);
      return;
    }
    if (saved) setStatus(`تم حذف قالب PowerPoint «${selected.name}».`);
  }, [persistReportDefaults, reportDefaults, reportDefaultsDirty, selectedCompanyPptxTemplateId]);

  const resetReportDefaults = useCallback(() => {
    if (!reportDefaultsBaseline) return;
    setReportDefaults(reportDefaultsBaseline);
    setReportDefaultsDirty(false);
  }, [reportDefaultsBaseline]);

  const persistMemberSignature = useCallback(
    async (userId: string, url: string | null) => {
      setSignatureBusyUserId(userId);
      setSubmitError(null);
      setStatus(null);
      try {
        await apiJson("/api/company/user-signature", csrfToken, {
          method: "PATCH",
          body: JSON.stringify({ userId, valuationReportSignatureDataUrl: url }),
        });
        setStatus("تم حفظ التوقيع.");
        await load();
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "فشل حفظ التوقيع.");
      } finally {
        setSignatureBusyUserId(null);
      }
    },
    [csrfToken, load],
  );

  const persistReportOnlySignature = useCallback(
    async (signatoryId: string, url: string | null) => {
      setSignatureBusyUserId(signatoryId);
      setSubmitError(null);
      setStatus(null);
      try {
        await apiJson(
          `/api/company/report-signatories/${encodeURIComponent(signatoryId)}/signature`,
          csrfToken,
          {
            method: "PATCH",
            body: JSON.stringify({ signatureImageDataUrl: url }),
          },
        );
        setStatus("تم حفظ توقيع معدّ التقرير.");
        await load();
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "فشل حفظ التوقيع.");
      } finally {
        setSignatureBusyUserId(null);
      }
    },
    [csrfToken, load],
  );

  const onAddReportOnlySignatory = async () => {
    const name = reportOnlyName.trim();
    if (!name || !isSafeValuationReportName(name)) {
      setSubmitError("أدخل اسماً نصياً صالحاً يظهر في التقرير (وليس رقم هاتف).");
      return;
    }
    setReportOnlyBusy(true);
    setSubmitError(null);
    setStatus(null);
    try {
      await apiJson(`/api/company/report-signatories${productQuery}`, csrfToken, { // CHANGED
        method: "POST",
        body: JSON.stringify({
          name,
          jobTitle: reportOnlyJobTitle.trim(),
          membershipNo: reportOnlyMembershipNo.trim(),
        }),
      });
      setStatus("تم إضافة معدّ التقرير.");
      setReportOnlyName("");
      setReportOnlyJobTitle("");
      setReportOnlyMembershipNo("");
      setAddReportOnlyOpen(false);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل إضافة معدّ التقرير.");
    } finally {
      setReportOnlyBusy(false);
    }
  };

  const openEditReportOnly = useCallback((row: ReportOnlySignatoryRow) => {
    setEditReportOnlyTarget(row);
    setEditReportOnlyName(row.name);
    setEditReportOnlyJobTitle(row.jobTitle);
    setEditReportOnlyMembershipNo(row.membershipNo);
    setEditReportOnlyOpen(true);
    setSubmitError(null);
  }, []);

  const onSaveReportOnlySignatory = async () => {
    if (!editReportOnlyTarget) return;
    const name = editReportOnlyName.trim();
    if (!name || !isSafeValuationReportName(name)) {
      setSubmitError("أدخل اسماً نصياً صالحاً يظهر في التقرير (وليس رقم هاتف).");
      return;
    }
    setReportOnlyBusy(true);
    setSubmitError(null);
    setStatus(null);
    try {
      await apiJson(
        `/api/company/report-signatories/${encodeURIComponent(editReportOnlyTarget.id)}`,
        csrfToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            name,
            jobTitle: editReportOnlyJobTitle.trim(),
            membershipNo: editReportOnlyMembershipNo.trim(),
          }),
        },
      );
      setStatus("تم تحديث بيانات معدّ التقرير.");
      setEditReportOnlyOpen(false);
      setEditReportOnlyTarget(null);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل تحديث معدّ التقرير.");
    } finally {
      setReportOnlyBusy(false);
    }
  };

  const onDeleteReportOnlySignatory = async () => {
    if (!deleteReportOnlyTarget) return;
    setReportOnlyBusy(true);
    setSubmitError(null);
    setStatus(null);
    try {
      await apiJson(
        `/api/company/report-signatories/${encodeURIComponent(deleteReportOnlyTarget.id)}`,
        csrfToken,
        { method: "DELETE" },
      );
      setStatus("تم حذف معدّ التقرير.");
      setDeleteReportOnlyTarget(null);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل حذف معدّ التقرير.");
    } finally {
      setReportOnlyBusy(false);
    }
  };

  const onAddUser = async () => {
    const reportDisplayName = newReportDisplayName.trim();
    if (reportDisplayName && !isSafeValuationReportName(reportDisplayName)) {
      setSubmitError("الاسم الذي يظهر في التقرير يجب أن يكون اسماً نصياً ولا يمكن أن يكون رقم هاتف.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setStatus(null);
    try {
      const em = newEmail.trim();
      const ph = newPhone.trim();
      await apiJson("/api/company/users", csrfToken, {
        method: "POST",
        body: JSON.stringify({
          username: ph,
          password: newPassword,
          role: newRole,
          ...productPayload,
          ...(em ? { email: em } : {}),
          valuationReportDisplayName: reportDisplayName,
          valuationReportJobTitle: newJobTitle.trim(),
          valuationReportMembershipNo: newMembershipNo.trim(),
          phone: ph,
        }),
      });
      setStatus("تم إنشاء المستخدم.");
      setNewPassword("");
      setNewEmail("");
      setNewPhone("");
      setNewReportDisplayName("");
      setNewJobTitle("");
      setNewMembershipNo("");
      setAddOpen(false);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل الإنشاء.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditUser = useCallback((u: CompanyUserRow) => {
    setEditTarget(u);
    setEditRole(rowRoleToSelectValue(u.role));
    setEditEmail(u.email ?? "");
    setEditPhone(u.phone ?? "");
    setEditReportDisplayName(u.valuationReportDisplayName ?? "");
    setEditJobTitle(u.valuationReportJobTitle ?? "");
    setEditMembershipNo(u.valuationReportMembershipNo ?? "");
    setEditNewPassword("");
    setEditOpen(true);
    setSubmitError(null);
    setStatus(null);
  }, []);

  const onSaveEditedUser = async () => {
    if (!editTarget) return;
    const reportDisplayName = editReportDisplayName.trim();
    if (reportDisplayName && !isSafeValuationReportName(reportDisplayName)) {
      setSubmitError("الاسم الذي يظهر في التقرير يجب أن يكون اسماً نصياً ولا يمكن أن يكون رقم هاتف.");
      return;
    }
    const body: Record<string, unknown> = {};
    const origEmail = editTarget.email ?? "";
    const origPhone = editTarget.phone ?? "";
    const origReportDisplayName = editTarget.valuationReportDisplayName ?? "";
    const origJobTitle = editTarget.valuationReportJobTitle ?? "";
    const origMembershipNo = editTarget.valuationReportMembershipNo ?? "";
    if (editEmail.trim() !== origEmail.trim()) {
      body.email = editEmail.trim() || "";
    }
    if (editPhone.trim() !== origPhone.trim()) {
      if (!editPhone.trim()) {
        setSubmitError("رقم الهاتف مطلوب لأنه أصبح معرّف تسجيل الدخول.");
        return;
      }
      body.phone = editPhone.trim();
    }
    if (editTarget.role !== "company_admin" && editRole !== rowRoleToSelectValue(editTarget.role)) {
      body.role = editRole;
    }
    if (reportDisplayName !== origReportDisplayName.trim()) {
      body.valuationReportDisplayName = reportDisplayName;
    }
    if (editJobTitle.trim() !== origJobTitle.trim()) {
      body.valuationReportJobTitle = editJobTitle.trim();
    }
    if (editMembershipNo.trim() !== origMembershipNo.trim()) {
      body.valuationReportMembershipNo = editMembershipNo.trim();
    }
    if (editNewPassword.trim().length > 0) {
      if (editNewPassword.trim().length < 8) {
        setSubmitError("كلمة المرور الجديدة يجب أن لا تقل عن 8 أحرف.");
        return;
      }
      body.newPassword = editNewPassword.trim();
    }
    if (Object.keys(body).length === 0) {
      setSubmitError("لم يتغيّر أي حقل.");
      return;
    }
    Object.assign(body, productPayload);
    setUserActionBusy(true);
    setSubmitError(null);
    setStatus(null);
    try {
      await apiJson(`/api/company/users/${encodeURIComponent(editTarget.id)}${productQuery}`, csrfToken, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setStatus("تم تحديث المستخدم.");
      setEditOpen(false);
      setEditTarget(null);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل التحديث.");
    } finally {
      setUserActionBusy(false);
    }
  };

  const onConfirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setUserActionBusy(true);
    setSubmitError(null);
    setStatus(null);
    try {
      await apiJson(`/api/company/users/${encodeURIComponent(deleteTarget.id)}${productQuery}`, csrfToken, {
        method: "DELETE",
      });
      setStatus("تم حذف المستخدم.");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل الحذف.");
    } finally {
      setUserActionBusy(false);
    }
  };

  const shellClass =
    variant === "embedded"
      ? "flex min-h-0 flex-1 flex-col overflow-hidden"
      : "flex min-h-screen flex-col bg-[#f4f6fb]";
  const hasLetterheadImages = [
    reportDefaults.letterhead.coverImageDataUrl,
    reportDefaults.letterhead.pageImageDataUrl,
    reportDefaults.letterhead.landscapePageImageDataUrl,
    reportDefaults.letterhead.logoDataUrl,
    reportDefaults.letterhead.footerImageDataUrl,
    reportDefaults.letterhead.signatureStampDataUrl,
  ].some(Boolean);
  const letterheadCatalogTemplates = [
    ...LETTERHEAD_TEMPLATE_OPTIONS,
    COMPANY_LETTERHEAD_TEMPLATE_OPTION,
  ];
  const letterheadPreviewTemplate = letterheadPreviewId
    ? (letterheadCatalogTemplates.find((item) => item.id === letterheadPreviewId) ?? null)
    : null;
  const selectedSystemTemplate =
    letterheadCatalogTemplates.find((item) => item.id === reportDefaults.letterhead.templateId) ??
    LETTERHEAD_TEMPLATE_OPTIONS[0]!;

  const reportSectionsEditor = (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-l from-sky-50/80 via-white to-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0C447C] text-white shadow-sm shadow-sky-900/20">
            <ClipboardList className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-black text-slate-900">محتوى وأقسام التقرير</h3>
            <p className="mt-0.5 text-[11px] font-semibold leading-5 text-slate-500">
              عدّل التعريفات المعتمدة وأضف أقساماً خاصة لتظهر في تقارير الشركة.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
            {reportDefaultsSectionGroups.length} مجموعات
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
            {reportDefaults.customSections.length} بنود مخصصة
          </span>
        </div>
      </div>

      {!reportDefaultsLoaded ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      ) : (
        <div className="grid min-h-[560px] lg:grid-cols-[238px_300px_minmax(0,1fr)]" dir="rtl">
          <aside className="border-l border-slate-100 bg-slate-50/70 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-black text-slate-700">مجموعات التقرير</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-slate-500 ring-1 ring-slate-200">
                {reportDefaultsSectionGroups.length}
              </span>
            </div>
            <div className="mb-3 flex gap-1.5">
              <Input
                value={newReportDefaultsSectionTitle}
                onChange={(event) => setNewReportDefaultsSectionTitle(event.target.value)}
                placeholder="مجموعة جديدة"
                className="h-8 rounded-lg border-slate-200 bg-white px-2 text-[11px] font-bold"
              />
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-lg bg-[#0C447C] hover:bg-[#0a3a66]"
                onClick={addReportDefaultsSectionGroup}
                title="إضافة مجموعة"
                aria-label="إضافة مجموعة"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-1">
              {reportDefaultsSectionGroups.map((section) => {
                const active = section.id === activeReportDefaultsSection?.id;
                return (
                  <div key={section.id} className="group/section flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveReportDefaultsSectionId(section.id);
                        setActiveReportDefaultsNodeId("");
                      }}
                      className={cn(
                        "flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border px-2.5 text-right text-[11px] font-black transition",
                        active
                          ? "border-sky-200 bg-white text-[#0C447C] shadow-sm"
                          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white",
                      )}
                    >
                      <span className="truncate">{section.title}</span>
                      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] tabular-nums text-slate-500">
                        {section.itemCount}
                      </span>
                    </button>
                    {section.kind === "custom" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-lg text-rose-500 opacity-0 hover:bg-rose-50 hover:text-rose-700 group-hover/section:opacity-100 focus-visible:opacity-100"
                        onClick={() => removeCustomReportDefaultsGroup(section.id)}
                        title="حذف المجموعة"
                        aria-label="حذف المجموعة"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="border-l border-slate-100 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-black text-slate-700">بنود المجموعة</span>
              {activeReportDefaultsSection?.kind === "custom" ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">مخصصة</span>
              ) : null}
            </div>
            {activeReportDefaultsSection?.kind === "custom" ? (
              <Input
                value={activeReportDefaultsSection.title}
                onChange={(event) =>
                  renameCustomReportDefaultsGroup(activeReportDefaultsSection.id, event.target.value)
                }
                className="mb-2 h-8 rounded-lg border-slate-200 text-[11px] font-black"
                aria-label="اسم المجموعة"
              />
            ) : (
              <div className="mb-2 flex h-8 items-center rounded-lg bg-slate-50 px-2 text-[11px] font-black text-slate-700">
                {activeReportDefaultsSection?.title ?? "—"}
              </div>
            )}
            <div className="mb-2 flex gap-1.5">
              <Input
                value={newReportDefaultsNodeTitle}
                onChange={(event) => setNewReportDefaultsNodeTitle(event.target.value)}
                placeholder="بند مخصص جديد"
                className="h-8 rounded-lg border-slate-200 px-2 text-[11px] font-bold"
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-8 w-8 shrink-0 rounded-lg"
                onClick={addReportDefaultsNode}
                title="إضافة بند"
                aria-label="إضافة بند"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="max-h-[442px] space-y-1 overflow-y-auto pe-0.5">
              {activeReportDefaultsNodes.length > 0 ? (
                activeReportDefaultsNodes.map((node) => {
                  const active = node.id === activeReportDefaultsNode?.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setActiveReportDefaultsNodeId(node.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-right text-[11px] font-bold transition",
                        active
                          ? "border-sky-200 bg-sky-50 text-[#0C447C]"
                          : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      <span className="line-clamp-2 min-w-0">{node.label}</span>
                      {node.kind === "custom" ? (
                        <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700">جديد</span>
                      ) : null}
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-7 text-center text-[11px] font-bold text-slate-400">
                  لا توجد بنود في هذه المجموعة بعد.
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 bg-slate-50/30 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-black text-slate-700">نص وتعريف البند</span>
              {reportDefaultsDirty ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black text-amber-700">تعديل غير محفوظ</span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">محفوظ</span>
              )}
            </div>
            {activeReportDefaultsNode ? (
              <div className="flex min-h-[485px] flex-col gap-2">
                {activeReportDefaultsNode.kind === "custom" ? (
                  <div className="grid gap-2 sm:grid-cols-[92px_minmax(0,1fr)_auto]">
                    <Input
                      value={activeReportDefaultsNode.section.sectionNumber}
                      onChange={(event) =>
                        updateReportDefaultsCustomSection(activeReportDefaultsNode.section.id, {
                          sectionNumber: event.target.value,
                        })
                      }
                      placeholder="الرقم"
                      dir="ltr"
                      className="h-9 rounded-lg border-slate-200 text-[12px] font-bold"
                    />
                    <Input
                      value={activeReportDefaultsNode.section.title}
                      onChange={(event) =>
                        updateReportDefaultsCustomSection(activeReportDefaultsNode.section.id, {
                          title: event.target.value,
                        })
                      }
                      placeholder="عنوان البند"
                      className="h-9 rounded-lg border-slate-200 text-[12px] font-black"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-lg px-2 text-[11px] text-rose-600 hover:bg-rose-50"
                      onClick={() => removeReportSection(activeReportDefaultsNode.section.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </Button>
                  </div>
                ) : (
                  <div className="flex min-h-9 items-center rounded-lg border border-slate-100 bg-white px-3 text-[12px] font-black text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                    {activeReportDefaultsNode.label}
                  </div>
                )}
                <Textarea
                  value={activeReportDefaultsNode.value}
                  onChange={(event) => {
                    if (activeReportDefaultsNode.kind === "field") {
                      updateReportDefaultsField(
                        activeReportDefaultsNode.fieldSection,
                        activeReportDefaultsNode.fieldKey,
                        event.target.value,
                      );
                    } else {
                      updateReportDefaultsCustomSection(activeReportDefaultsNode.section.id, {
                        body: event.target.value,
                      });
                    }
                  }}
                  rows={activeReportDefaultsNode.kind === "field" ? activeReportDefaultsNode.rows : 14}
                  dir="rtl"
                  className="min-h-[410px] flex-1 resize-none rounded-xl border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium leading-7 text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-100"
                />
              </div>
            ) : (
              <div className="flex min-h-[485px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-[12px] font-bold text-slate-400">
                اختر بنداً لبدء التعديل.
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );

  if (!loading && backendUnavailable) {
    return (
      <div className={cn(shellClass, "items-center justify-center p-6")} dir="rtl">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">الخادم الخلفي غير متصل.</p>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            شغل SparkVision-Backend ثم أعد تحميل الصفحة.
          </p>
          <Button type="button" className="mt-6 rounded-xl" onClick={() => window.location.reload()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  if (!loading && user && !isCompanyAdmin && !reportDefaultsOnly) {
    return (
      <div className={cn(shellClass, "p-4 md:p-6")} dir="rtl">
        <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">بياناتي الشخصية</h1>
              {productLabel ? (
                <p className="text-[13px] font-medium text-slate-500">{productLabel}</p>
              ) : null}
            </div>
          </div>

          {submitError ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {submitError}
            </p>
          ) : null}
          {status ? (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {status}
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <Label>رقم الهاتف</Label>
                  <PhoneNumberInput value={personalPhone} onChange={setPersonalPhone} />
                </label>
                <label className="grid gap-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    value={personalEmail}
                    onChange={(event) => setPersonalEmail(event.target.value)}
                    dir="ltr"
                    inputMode="email"
                  />
                </label>
                <label className="grid gap-2">
                  <Label>الوظيفة</Label>
                  <Input
                    value={personalJobTitle}
                    onChange={(event) => setPersonalJobTitle(event.target.value)}
                    placeholder="مقيم منتسب آلات ومعدات"
                    dir="rtl"
                  />
                </label>
                <label className="grid gap-2">
                  <Label>رقم العضوية</Label>
                  <Input
                    value={personalMembershipNo}
                    onChange={(event) => setPersonalMembershipNo(event.target.value)}
                    placeholder="421000000"
                    dir="ltr"
                  />
                </label>
              </div>
              <div className="mt-5 flex justify-end">
                <Button
                  type="button"
                  className="gap-2 rounded-xl bg-[#0C447C] hover:bg-[#0a3a66]"
                  disabled={personalBusy}
                  onClick={() => void persistPersonalProfile()}
                >
                  {personalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  حفظ البيانات
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-slate-800">
                <PenLine className="h-4 w-4 text-sky-600" />
                <h2 className="text-sm font-bold">توقيعي في التقرير</h2>
              </div>
              <MemberSignatureCell
                savedUrl={personalSignature}
                busy={personalSignatureBusy}
                onPersist={persistPersonalSignature}
              />
            </section>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && !canAccess) {
    return (
      <div className={cn(shellClass, "items-center justify-center p-6")} dir="rtl">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-800">هذه اللوحة لمديري الشركة فقط.</p>
          <Button asChild className="mt-6 rounded-xl" variant="outline">
            <Link href="/value-tech">العودة</Link>
          </Button>
        </div>
      </div>
    );
  }

  const inner = (
    <div
      className={cn(
        "w-full flex-1",
        variant === "embedded" ? "min-h-0 overflow-y-auto px-3 py-4 md:px-6 md:py-5" : "px-4 py-8 md:px-8",
      )}
    >
      <div
        className={cn(
          "mx-auto w-full",
          variant === "embedded" ? "max-w-[1400px]" : "max-w-[1200px]",
        )}
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-[#0C447C] text-white shadow-md shadow-sky-900/15">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 md:text-xl">
                {reportDefaultsOnly ? "بيانات إعداد التقرير النهائي" : "إعدادات عامة"}
              </h1>
              {data?.company?.name ? (
                <p className="text-[13px] font-medium text-slate-500">{data.company.name}</p>
              ) : null}
            </div>
          </div>
        </div>

        {loadError ? (
          <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {loadError}
          </p>
        ) : null}
        {submitError ? (
          <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {submitError}
          </p>
        ) : null}
        {status ? (
          <p className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {status}
          </p>
        ) : null}

        <Tabs
          defaultValue={reportDefaultsOnly ? "word-template" : "info"}
          className="flex min-h-0 flex-col gap-4"
          dir="rtl"
        >
          {reportDefaultsOnly ? (
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-slate-200/40 p-1 md:w-auto">
              <TabsTrigger
                value="word-template"
                className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                قوالب Word
              </TabsTrigger>
              <TabsTrigger
                value="pptx-template"
                className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                قوالب PowerPoint
              </TabsTrigger>
              <TabsTrigger
                value="letterhead"
                className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                قوالب النظام والكلاشية
              </TabsTrigger>
              <TabsTrigger
                value="report-data-models"
                className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                نماذج بيانات التقرير
              </TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-slate-200/40 p-1 md:w-auto">
              <TabsTrigger
                value="info"
                className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                بيانات الشركة
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                مستخدمو الشركة
              </TabsTrigger>
              <TabsTrigger
                value="signatories"
                className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                المقيمون والتوقيعات
              </TabsTrigger>
              <TabsTrigger
                value="asset-descriptions"
                className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                تصنيفات الأصول
              </TabsTrigger>
            </TabsList>
          )}

          {!reportDefaultsOnly ? (
            <>
          <TabsContent value="info" className="mt-0 outline-none">
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm md:p-8">
              {!data ? (
                <div className="flex justify-center py-16 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-100">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">الاسم</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">{data.company?.name ?? "—"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-100">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">عدد الموظفين</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {data.company?.employeeCount ?? data.users.length}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-100 sm:col-span-2">
                        <label htmlFor="company-commercial-registration" className="text-[11px] font-semibold text-slate-500">
                          السجل التجاري للشركة
                        </label>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            id="company-commercial-registration"
                            value={commercialRegistrationDraft}
                            onChange={(event) => {
                              setCommercialRegistrationDraft(event.target.value);
                              setStatus(null);
                            }}
                            dir="ltr"
                            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-slate-900 outline-none ring-[#0C447C]/20 focus:ring-2"
                            placeholder="رقم السجل التجاري"
                          />
                          <Button
                            type="button"
                            className="h-11 shrink-0 rounded-xl bg-[#0C447C] px-4 hover:bg-[#0a3a66]"
                            disabled={brandingBusy}
                            onClick={() => void persistCompanyInfo()}
                          >
                            {brandingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            حفظ السجل التجاري
                          </Button>
                        </div>
                      </div>
                    </div>
                    {data.company ? (
                      <p className="text-[12px] leading-relaxed text-slate-500">
                        منتجات فاليو تك:{" "}
                        {(() => {
                          const licensed = data.company.valueTechProductIds.filter((id) =>
                            (VALUE_TECH_PRODUCT_IDS as readonly string[]).includes(id),
                          );
                          return licensed.length
                            ? licensed
                                .map((id) => VALUE_TECH_PRODUCT_LABELS_AR[id as ValueTechProductId] ?? id)
                                .join("، ")
                            : "—";
                        })()}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-gradient-to-b from-sky-50/50 to-white p-5">
                    <p className="mb-3 text-[12px] font-semibold text-slate-600">شعار الشركة</p>
                    <LogoUploader
                      dataUrl={logoDraft}
                      onChange={(v) => {
                        setLogoDraft(v);
                        setStatus(null);
                      }}
                      busy={brandingBusy}
                    />
                    <Button
                      type="button"
                      className="mt-4 w-full rounded-xl bg-[#0C447C] hover:bg-[#0a3a66]"
                      disabled={brandingBusy}
                      onClick={() => void persistLogo()}
                    >
                      {brandingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      حفظ الشعار
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-0 outline-none">
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-6">
                <div className="flex items-center gap-2 text-slate-700">
                  <Users className="h-4 w-4 text-sky-600" />
                  <span className="text-[13px] font-semibold">الفريق</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  مستخدم جديد
                </Button>
              </div>
              <div className="overflow-x-auto p-2 md:p-4">
                {!data ? (
                  <div className="flex justify-center py-12 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 hover:bg-transparent">
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">رقم الهاتف</TableHead>
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">الدور</TableHead>
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">آخر دخول</TableHead>
                        <TableHead className="w-[52px] text-center text-[12px] font-semibold text-slate-500">
                          إجراءات
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.users.map((u) => {
                        const canEdit = canManageCompanyUserRow(u, user?.id);
                        const canDel = canDeleteCompanyUserRow(u, user?.id);
                        return (
                          <TableRow key={u.id} className="border-slate-100">
                            <TableCell className="font-medium text-slate-900">
                              <div className="grid gap-0.5">
                                <span dir="ltr">{userDisplayName(u)}</span>
                                {u.valuationReportJobTitle ? (
                                  <span className="text-[11px] font-semibold text-slate-500" dir="rtl">
                                    {u.valuationReportJobTitle}
                                  </span>
                                ) : null}
                                {u.valuationReportMembershipNo ? (
                                  <span className="text-[10.5px] font-semibold text-slate-400" dir="rtl">
                                    رقم العضوية: {u.valuationReportMembershipNo}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-700">{ROLE_LABELS[u.role] ?? u.role}</TableCell>
                            <TableCell className="text-[12px] text-slate-500">
                              {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ar") : "—"}
                            </TableCell>
                            <TableCell className="p-1 text-center">
                              {canEdit || canDel ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-600"
                                      disabled={userActionBusy}
                                      aria-label={`إجراءات ${userDisplayName(u)}`}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="z-[960] min-w-[10rem] [direction:rtl]"
                                  >
                                    {canEdit ? (
                                      <DropdownMenuItem
                                        className="cursor-pointer gap-2"
                                        onClick={() => openEditUser(u)}
                                      >
                                        تعديل البيانات
                                      </DropdownMenuItem>
                                    ) : null}
                                    {canDel ? (
                                      <DropdownMenuItem
                                        className="cursor-pointer gap-2 text-red-600 focus:text-red-600"
                                        onClick={() => {
                                          setDeleteTarget(u);
                                          setSubmitError(null);
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        حذف المستخدم
                                      </DropdownMenuItem>
                                    ) : null}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <span className="text-[11px] text-slate-300">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="signatories" className="mt-0 outline-none">
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-slate-700">
                    <PenLine className="h-4 w-4 text-violet-600" />
                    <span className="text-[13px] font-semibold">المقيمون والتوقيعات</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    مستخدمو الشركة يظهرون تلقائياً. يمكنك أيضاً إضافة معدّي تقرير للتقارير فقط بدون حساب دخول.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700"
                  onClick={() => {
                    setReportOnlyName("");
                    setReportOnlyJobTitle("");
                    setReportOnlyMembershipNo("");
                    setSubmitError(null);
                    setAddReportOnlyOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  إضافة معدّ تقرير
                </Button>
              </div>
              <div className="overflow-x-auto p-2 md:p-4">
                {!data ? (
                  <div className="flex justify-center py-12 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 hover:bg-transparent">
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">الاسم في التقرير</TableHead>
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">النوع</TableHead>
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">ملاحظة</TableHead>
                        <TableHead className="min-w-[200px] text-right text-[12px] font-semibold text-slate-500">
                          التوقيع (PNG)
                        </TableHead>
                        <TableHead className="w-[120px] text-center text-[12px] font-semibold text-slate-500">
                          إجراءات
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.users.map((u) => {
                        const canEdit = canManageCompanyUserRow(u, user?.id);
                        return (
                          <TableRow key={u.id} className="border-slate-100">
                            <TableCell className="font-medium text-slate-900">
                              <div className="grid gap-0.5">
                                <span dir="rtl">{valuationReportDisplayName(u)}</span>
                                {u.valuationReportJobTitle ? (
                                  <span className="text-[11px] font-semibold text-slate-500" dir="rtl">
                                    {u.valuationReportJobTitle}
                                  </span>
                                ) : null}
                                {u.valuationReportMembershipNo ? (
                                  <span className="text-[10.5px] font-semibold text-slate-400" dir="rtl">
                                    رقم العضوية: {u.valuationReportMembershipNo}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-700">
                              <Badge variant="secondary" className="rounded-lg bg-sky-50 text-[10px] font-bold text-sky-800">
                                مستخدم الشركة
                              </Badge>
                              <p className="mt-1 text-[11px] text-slate-500">{ROLE_LABELS[u.role] ?? u.role}</p>
                            </TableCell>
                            <TableCell className="text-[12px] text-slate-500">
                              {u.lastLoginAt
                                ? `آخر دخول: ${new Date(u.lastLoginAt).toLocaleString("ar")}`
                                : "حساب دخول للنظام"}
                            </TableCell>
                            <TableCell className="p-0 align-top">
                              <MemberSignatureCell
                                savedUrl={u.valuationReportSignatureDataUrl ?? null}
                                busy={signatureBusyUserId === u.id}
                                onPersist={(url) => persistMemberSignature(u.id, url)}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              {canEdit ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg px-2 text-[11px]"
                                  disabled={userActionBusy}
                                  onClick={() => openEditUser(u)}
                                >
                                  تعديل البيانات
                                </Button>
                              ) : (
                                <span className="text-[11px] text-slate-300">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {visibleReportOnlySignatories.map((row) => (
                        <TableRow key={row.id} className="border-slate-100 bg-violet-50/20">
                          <TableCell className="font-medium text-slate-900">
                            <div className="grid gap-0.5">
                              <span dir="rtl">{row.name || "—"}</span>
                              {row.jobTitle ? (
                                <span className="text-[11px] font-semibold text-slate-500" dir="rtl">
                                  {row.jobTitle}
                                </span>
                              ) : null}
                              {row.membershipNo ? (
                                <span className="text-[10.5px] font-semibold text-slate-400" dir="rtl">
                                  رقم العضوية: {row.membershipNo}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="rounded-lg bg-violet-100 text-[10px] font-bold text-violet-800 hover:bg-violet-100">
                              للتقرير فقط
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[12px] text-slate-500">
                            بدون هاتف أو كلمة مرور — يظهر في اختيار معدّي التقرير
                          </TableCell>
                          <TableCell className="p-0 align-top">
                            <MemberSignatureCell
                              savedUrl={row.signatureImageDataUrl}
                              busy={signatureBusyUserId === row.id}
                              onPersist={(url) => persistReportOnlySignature(row.id, url)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg px-2 text-[11px]"
                                disabled={reportOnlyBusy}
                                onClick={() => openEditReportOnly(row)}
                              >
                                تعديل
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg px-2 text-[11px] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                disabled={reportOnlyBusy}
                                onClick={() => setDeleteReportOnlyTarget(row)}
                              >
                                حذف
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.users.length === 0 && visibleReportOnlySignatories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-[12px] text-slate-500">
                            لا يوجد مقيمون بعد. أضف مستخدماً من تبويب مستخدمو الشركة أو معدّ تقرير من هنا.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </TabsContent>

            </>
          ) : null}

          {!reportDefaultsOnly ? (
            <TabsContent value="asset-descriptions" className="mt-0 outline-none">
              <CompanyAssetDescriptionsDashboard csrfToken={csrfToken} />
            </TabsContent>
          ) : null}

          <TabsContent value="report-defaults" className="mt-0 outline-none">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0C447C]">
                    <FileText className="h-4 w-4" />
                  </span>
                  <h2 className="truncate text-[14px] font-black text-slate-900">أقسام التقرير</h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 rounded-lg px-2 text-[11px]"
                    disabled={!reportDefaultsDirty || reportDefaultsSaving}
                    onClick={resetReportDefaults}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    تراجع
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1 rounded-lg bg-[#0C447C] px-3 text-[11px] hover:bg-[#0a3a66]"
                    disabled={!reportDefaultsDirty || reportDefaultsSaving}
                    onClick={() => void persistReportDefaults()}
                  >
                    {reportDefaultsSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    حفظ
                  </Button>
                </div>
              </div>

              {!reportDefaultsLoaded ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              ) : (
                <div className="grid min-h-[540px] lg:grid-cols-[230px_290px_minmax(0,1fr)]" dir="rtl">
                  <aside className="border-l border-slate-100 bg-slate-50/70 p-2">
                    <div className="mb-2 flex gap-1">
                      <Input
                        value={newReportDefaultsSectionTitle}
                        onChange={(event) => setNewReportDefaultsSectionTitle(event.target.value)}
                        placeholder="قسم جديد"
                        className="h-8 rounded-lg border-slate-200 bg-white px-2 text-[11px] font-bold"
                      />
                      <Button
                        type="button"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-lg bg-[#0C447C] hover:bg-[#0a3a66]"
                        onClick={addReportDefaultsSectionGroup}
                        title="إضافة قسم"
                        aria-label="إضافة قسم"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {reportDefaultsSectionGroups.map((section) => {
                        const active = section.id === activeReportDefaultsSection?.id;
                        return (
                          <div key={section.id} className="group/section flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveReportDefaultsSectionId(section.id);
                                setActiveReportDefaultsNodeId("");
                              }}
                              className={cn(
                                "flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 text-right text-[11px] font-black transition",
                                active
                                  ? "bg-white text-[#0C447C] shadow-sm ring-1 ring-sky-100"
                                  : "text-slate-600 hover:bg-white/80",
                              )}
                            >
                              <span className="truncate">{section.title}</span>
                              <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] tabular-nums text-slate-500">
                                {section.itemCount}
                              </span>
                            </button>
                            {section.kind === "custom" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 rounded-lg text-rose-500 opacity-0 hover:bg-rose-50 hover:text-rose-700 group-hover/section:opacity-100"
                                onClick={() => removeCustomReportDefaultsGroup(section.id)}
                                title="حذف القسم"
                                aria-label="حذف القسم"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </aside>

                  <section className="border-l border-slate-100 p-2">
                    {activeReportDefaultsSection?.kind === "custom" ? (
                      <Input
                        value={activeReportDefaultsSection.title}
                        onChange={(event) =>
                          renameCustomReportDefaultsGroup(activeReportDefaultsSection.id, event.target.value)
                        }
                        className="mb-2 h-8 rounded-lg border-slate-200 text-[11px] font-black"
                      />
                    ) : (
                      <div className="mb-2 flex h-8 items-center rounded-lg bg-slate-50 px-2 text-[11px] font-black text-slate-700">
                        {activeReportDefaultsSection?.title}
                      </div>
                    )}

                    {activeReportDefaultsNodes.length > 0 ? (
                      <Select value={activeReportDefaultsNode?.id} onValueChange={setActiveReportDefaultsNodeId}>
                        <SelectTrigger className="mb-2 h-8 rounded-lg border-slate-200 text-right text-[11px] font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[960]">
                          {activeReportDefaultsNodes.map((node) => (
                            <SelectItem key={node.id} value={node.id}>
                              {node.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mb-2 flex h-8 items-center rounded-lg border border-dashed border-slate-200 px-2 text-[11px] font-bold text-slate-400">
                        لا توجد بنود
                      </div>
                    )}

                    <div className="mb-2 flex gap-1">
                      <Input
                        value={newReportDefaultsNodeTitle}
                        onChange={(event) => setNewReportDefaultsNodeTitle(event.target.value)}
                        placeholder="بند جديد"
                        className="h-8 rounded-lg border-slate-200 px-2 text-[11px] font-bold"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 shrink-0 rounded-lg"
                        onClick={addReportDefaultsNode}
                        title="إضافة بند"
                        aria-label="إضافة بند"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="max-h-[430px] space-y-1 overflow-y-auto pr-0.5">
                      {activeReportDefaultsNodes.map((node) => {
                        const active = node.id === activeReportDefaultsNode?.id;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => setActiveReportDefaultsNodeId(node.id)}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-2 text-right text-[11px] font-bold transition",
                              active
                                ? "border-sky-200 bg-sky-50 text-[#0C447C]"
                                : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50",
                            )}
                          >
                            <span className="line-clamp-2 min-w-0">{node.label}</span>
                            {node.kind === "custom" ? (
                              <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700">
                                جديد
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="min-w-0 p-2">
                    {activeReportDefaultsNode ? (
                      <div className="flex h-full min-h-[500px] flex-col gap-2">
                        {activeReportDefaultsNode.kind === "custom" ? (
                          <div className="grid gap-2 sm:grid-cols-[100px_minmax(0,1fr)_auto]">
                            <Input
                              value={activeReportDefaultsNode.section.sectionNumber}
                              onChange={(event) =>
                                updateReportDefaultsCustomSection(activeReportDefaultsNode.section.id, {
                                  sectionNumber: event.target.value,
                                })
                              }
                              placeholder="رقم"
                              dir="ltr"
                              className="h-9 rounded-lg border-slate-200 text-[12px] font-bold"
                            />
                            <Input
                              value={activeReportDefaultsNode.section.title}
                              onChange={(event) =>
                                updateReportDefaultsCustomSection(activeReportDefaultsNode.section.id, {
                                  title: event.target.value,
                                })
                              }
                              placeholder="عنوان البند"
                              className="h-9 rounded-lg border-slate-200 text-[12px] font-black"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-lg px-2 text-[11px] text-rose-600 hover:bg-rose-50"
                              onClick={() => removeReportSection(activeReportDefaultsNode.section.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              حذف
                            </Button>
                          </div>
                        ) : (
                          <div className="flex min-h-9 items-center rounded-lg border border-slate-100 bg-slate-50 px-3 text-[12px] font-black text-slate-800">
                            {activeReportDefaultsNode.label}
                          </div>
                        )}
                        <Textarea
                          value={activeReportDefaultsNode.value}
                          onChange={(event) => {
                            if (activeReportDefaultsNode.kind === "field") {
                              updateReportDefaultsField(
                                activeReportDefaultsNode.fieldSection,
                                activeReportDefaultsNode.fieldKey,
                                event.target.value,
                              );
                            } else {
                              updateReportDefaultsCustomSection(activeReportDefaultsNode.section.id, {
                                body: event.target.value,
                              });
                            }
                          }}
                          rows={activeReportDefaultsNode.kind === "field" ? activeReportDefaultsNode.rows : 14}
                          dir="rtl"
                          className="min-h-[390px] flex-1 resize-none rounded-xl border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium leading-7 text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-100"
                        />
                      </div>
                    ) : (
                      <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-[12px] font-bold text-slate-400">
                        اختر قسما أو أضف بندا جديدا
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="letterhead" className="m-0 outline-none">
            <div className="m-0 space-y-3 p-0">
              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[linear-gradient(120deg,#071f33_0%,#0C447C_62%,#0f6d91_100%)] px-4 py-3 text-white">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/12 text-[#f6b56d] ring-1 ring-white/15">
                      <Palette className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-black tracking-tight">استوديو التقرير النظامي</h2>
                      <p className="mt-0.5 text-[11px] font-semibold leading-5 text-sky-100/90">
                        قالب موحّد، أكلاشية الشركة، وتعريفات التقرير في مساحة واحدة.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="hidden items-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-1.5 text-[10px] font-bold ring-1 ring-white/10 sm:flex">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#f6b56d]" />
                      {selectedSystemTemplate.title}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl border-white/20 bg-white/10 text-[12px] font-black text-white hover:bg-white/20 hover:text-white"
                      onClick={() => setLetterheadImagesOpen(true)}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      الأكلاشية
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl border-white/20 bg-white/10 text-[12px] font-bold text-white hover:bg-white/20 hover:text-white"
                      disabled={!reportDefaultsDirty || reportDefaultsSaving}
                      onClick={resetReportDefaults}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      تراجع
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl bg-[#f37021] text-[12px] font-black text-white shadow-sm hover:bg-[#dd6317]"
                      disabled={!reportDefaultsDirty || reportDefaultsSaving}
                      onClick={() => void persistReportDefaults()}
                    >
                      {reportDefaultsSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      حفظ التعديلات
                    </Button>
                  </div>
                </div>
                <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0" dir="rtl">
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-[#0C447C]"><Palette className="h-3.5 w-3.5" /></span>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400">القالب المعتمد</p>
                      <p className="max-w-[190px] truncate text-[11px] font-black text-slate-800">{selectedSystemTemplate.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", hasLetterheadImages ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}><Stamp className="h-3.5 w-3.5" /></span>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400">أكلاشية الشركة</p>
                      <p className="text-[11px] font-black text-slate-800">{hasLetterheadImages ? "الصور جاهزة للاستخدام" : "لم تكتمل الصور بعد"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><ClipboardList className="h-3.5 w-3.5" /></span>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400">محتوى التقرير</p>
                      <p className="text-[11px] font-black text-slate-800">{reportDefaultsSectionGroups.length} مجموعات · {reportDefaults.customSections.length} بنود خاصة</p>
                    </div>
                  </div>
                </div>
              </section>

              {!reportDefaultsLoaded ? (
                <div className="flex items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-16 text-slate-400 shadow-sm">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              ) : (
                <Tabs defaultValue="system-template" className="space-y-3" dir="rtl">
                  <TabsList className="h-auto w-full justify-start gap-1 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm md:w-auto">
                    <TabsTrigger value="system-template" className="rounded-xl px-3 py-2 text-[12px] font-bold data-[state=active]:bg-[#0C447C] data-[state=active]:text-white data-[state=active]:shadow-sm">
                      قالب النظام
                    </TabsTrigger>
                    <TabsTrigger value="company-letterhead" className="rounded-xl px-3 py-2 text-[12px] font-bold data-[state=active]:bg-[#0C447C] data-[state=active]:text-white data-[state=active]:shadow-sm">
                      أكلاشية الشركة
                    </TabsTrigger>
                    <TabsTrigger value="report-sections" className="rounded-xl px-3 py-2 text-[12px] font-bold data-[state=active]:bg-[#0C447C] data-[state=active]:text-white data-[state=active]:shadow-sm">
                      أقسام وتعريفات التقرير
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="system-template" className="m-0 space-y-3 outline-none">
                    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                      <div className="grid gap-0 lg:grid-cols-[250px_minmax(0,1fr)]">
                        <div className="flex items-center justify-center border-b border-slate-100 bg-[radial-gradient(circle_at_50%_18%,#e0f2fe,transparent_58%),linear-gradient(135deg,#f8fafc,#eaf3f8)] p-5 lg:border-b-0 lg:border-l">
                          <SystemReportTemplatePreview
                            template={selectedSystemTemplate}
                            letterhead={reportDefaults.letterhead}
                            companyName={data?.company?.name ?? "شركة التقييم"}
                            companyLogoSrc={reportDefaults.letterhead.logoDataUrl || logoDraft}
                          />
                        </div>
                        <div className="flex min-w-0 flex-col justify-center p-4 md:p-5">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] text-[#0C447C] ring-1 ring-sky-100">القالب المعتمد للنظام</Badge>
                            <Badge variant="secondary" className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600">{selectedSystemTemplate.badge}</Badge>
                          </div>
                          <h3 className="text-[18px] font-black tracking-tight text-slate-950">{selectedSystemTemplate.title}</h3>
                          <p className="mt-1.5 max-w-2xl text-[12px] font-semibold leading-6 text-slate-500">{selectedSystemTemplate.description}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button type="button" variant="outline" className="h-9 gap-1.5 rounded-xl text-[12px] font-black" onClick={() => setLetterheadPreviewId(selectedSystemTemplate.id)}>
                              <Eye className="h-3.5 w-3.5" />
                              معاينة كاملة
                            </Button>
                            <span className="inline-flex h-9 items-center rounded-xl bg-slate-50 px-3 text-[10.5px] font-bold text-slate-500 ring-1 ring-slate-100">
                              يُستخدم تلقائياً للمشاريع التي لم تحدد قالباً، دون تغيير اختيار أي مشروع قائم.
                            </span>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-[14px] font-black text-slate-900">مكتبة قوالب النظام</h3>
                          <p className="mt-0.5 text-[10.5px] font-semibold text-slate-500">اختر القالب المعتمد ليُحفظ فورًا ويُستخدم في التقارير الجديدة.</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-700">{letterheadCatalogTemplates.length} قوالب</Badge>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {letterheadCatalogTemplates.map((template) => {
                          const isCompanyTemplate = template.id === COMPANY_LETTERHEAD_TEMPLATE_OPTION.id;
                          const selected = template.id === selectedSystemTemplate.id;
                          return (
                            <article
                              key={template.id}
                              className={cn(
                                "overflow-hidden rounded-2xl border bg-white shadow-sm transition",
                                selected ? "border-[#0C447C] ring-2 ring-[#0C447C]/10" : "border-slate-200 hover:border-slate-300",
                              )}
                            >
                              <div className="relative overflow-hidden bg-slate-100/80 py-3">
                                <SystemReportTemplatePreview
                                  template={template}
                                  letterhead={reportDefaults.letterhead}
                                  companyName={data?.company?.name ?? "شركة التقييم"}
                                  companyLogoSrc={reportDefaults.letterhead.logoDataUrl || logoDraft}
                                />
                                <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    className="h-8 w-8 rounded-full bg-white/95 text-slate-800 shadow-sm hover:bg-white"
                                    title="معاينة"
                                    aria-label={`معاينة ${template.title}`}
                                    onClick={() => setLetterheadPreviewId(template.id)}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Badge className="rounded-full bg-white text-[10px] text-slate-800 shadow-sm">{template.badge}</Badge>
                                </div>
                              </div>
                              <div className="p-3 text-right">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="min-w-0 truncate text-[13px] font-black text-slate-900">{template.title}</h4>
                                  {selected ? (
                                    <Badge className="gap-1 rounded-full bg-[#0C447C] px-2 py-0.5 text-[9px] text-white"><CheckCircle2 className="h-3 w-3" />معتمد</Badge>
                                  ) : isCompanyTemplate ? (
                                    <Badge variant="secondary" className={cn("rounded-full px-2 py-0.5 text-[9px]", hasLetterheadImages ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                                      {hasLetterheadImages ? "جاهزة" : "تحتاج صوراً"}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="mt-1.5 min-h-10 text-[10.5px] font-semibold leading-5 text-slate-500">{template.description}</p>
                                <Button
                                  type="button"
                                  variant={selected ? "outline" : "default"}
                                  className={cn("mt-3 h-8 w-full gap-1.5 rounded-lg text-[10.5px] font-black", !selected && "bg-[#0C447C] hover:bg-[#0a3a66]")}
                                  disabled={selected || reportDefaultsSaving}
                                  onClick={() => void applySystemReportTemplate(template)}
                                >
                                  {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Palette className="h-3.5 w-3.5" />}
                                  {selected ? "القالب المعتمد" : "اعتماد كقالب النظام"}
                                </Button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  </TabsContent>

                  <TabsContent value="company-letterhead" className="m-0 outline-none">
                    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                      <div className="grid lg:grid-cols-[minmax(0,1fr)_310px]">
                        <div className="p-4 md:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex gap-2.5">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Stamp className="h-5 w-5" /></span>
                              <div>
                                <h3 className="text-[15px] font-black text-slate-900">أكلاشية الشركة</h3>
                                <p className="mt-1 max-w-xl text-[11px] font-semibold leading-5 text-slate-500">ارفع الغلاف والصفحات الداخلية والشعار والفوتر ليستخدمها التقرير عند اختيار «أكلاشية الشركة» من شاشة المشروع.</p>
                              </div>
                            </div>
                            <Badge className={cn("rounded-full px-2.5 py-1 text-[10px]", hasLetterheadImages ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                              {hasLetterheadImages ? "جاهزة للتطبيق" : "تحتاج تجهيزاً"}
                            </Badge>
                          </div>
                          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {[
                              ["الغلاف", reportDefaults.letterhead.coverImageDataUrl],
                              ["الصفحات الطولية", reportDefaults.letterhead.pageImageDataUrl],
                              ["الصفحات بالعرض", reportDefaults.letterhead.landscapePageImageDataUrl],
                              ["شعار التقرير", reportDefaults.letterhead.logoDataUrl],
                              ["الفوتر", reportDefaults.letterhead.footerImageDataUrl],
                              ["التوقيع والختم", reportDefaults.letterhead.signatureStampDataUrl],
                            ].map(([label, value]) => (
                              <div key={label} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                                <span className="text-[10.5px] font-bold text-slate-700">{label}</span>
                                <span className={cn("h-2 w-2 shrink-0 rounded-full", value ? "bg-emerald-500" : "bg-slate-300")} title={value ? "مرفوع" : "غير مرفوع"} />
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button type="button" className="h-9 gap-1.5 rounded-xl bg-[#0C447C] text-[11px] font-black hover:bg-[#0a3a66]" onClick={() => setLetterheadImagesOpen(true)}>
                              <Upload className="h-3.5 w-3.5" />
                              إدارة صور الأكلاشية
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 gap-1.5 rounded-xl text-[11px] font-black"
                              disabled={!hasLetterheadImages}
                              onClick={() => {
                                updateLetterhead("templateId", COMPANY_LETTERHEAD_TEMPLATE_OPTION.id);
                                updateLetterhead("outputFormat", "pdf");
                                updateLetterhead("enabled", true);
                                setStatus("تم اعتماد أكلاشية الشركة. احفظ التعديلات لتطبيقها في إعدادات الشركة.");
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              اعتماد الأكلاشية
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-center border-t border-slate-100 bg-[linear-gradient(135deg,#fff7ed,#fffbeb)] p-5 lg:border-r lg:border-t-0">
                          <SystemReportTemplatePreview
                            template={COMPANY_LETTERHEAD_TEMPLATE_OPTION}
                            letterhead={reportDefaults.letterhead}
                            companyName={data?.company?.name ?? "شركة التقييم"}
                            companyLogoSrc={reportDefaults.letterhead.logoDataUrl || logoDraft}
                          />
                        </div>
                      </div>
                    </section>
                  </TabsContent>

                  <TabsContent value="report-sections" className="m-0 outline-none">
                    {reportSectionsEditor}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </TabsContent>

          <TabsContent value="word-template" className="m-0 outline-none">
            <CompanyReportDocumentTemplateDashboard
              format="word"
              templates={reportDefaults.wordTemplates}
              reportDataModels={reportDefaults.reportDataModels}
              selectedTemplateId={selectedCompanyWordTemplateId}
              loading={!reportDefaultsLoaded}
              saving={reportDefaultsSaving}
              dirty={reportDefaultsDirty}
              onSelect={setSelectedCompanyWordTemplateId}
              onUploadNew={(file) => uploadCompanyWordTemplate(file, "new")}
              onReplace={(file) => uploadCompanyWordTemplate(file, "replace")}
              onRename={(name, finalize) => renameCompanyDocumentTemplate("word", name, finalize)}
              onRemove={removeCompanyWordTemplate}
              onChange={({ variableMappings, excludedVariableNames }) =>
                updateCompanyDocumentTemplateMappings("word", variableMappings, excludedVariableNames)
              }
              onSave={() => void persistReportDefaults()}
            />
          </TabsContent>

          <TabsContent value="pptx-template" className="m-0 outline-none">
            <CompanyReportDocumentTemplateDashboard
              format="pptx"
              templates={reportDefaults.pptxTemplates}
              reportDataModels={reportDefaults.reportDataModels}
              selectedTemplateId={selectedCompanyPptxTemplateId}
              loading={!reportDefaultsLoaded}
              saving={reportDefaultsSaving}
              dirty={reportDefaultsDirty}
              onSelect={setSelectedCompanyPptxTemplateId}
              onUploadNew={(file) => uploadCompanyPptxTemplate(file, "new")}
              onReplace={(file) => uploadCompanyPptxTemplate(file, "replace")}
              onRename={(name, finalize) => renameCompanyDocumentTemplate("pptx", name, finalize)}
              onRemove={removeCompanyPptxTemplate}
              onChange={({ variableMappings, excludedVariableNames }) =>
                updateCompanyDocumentTemplateMappings("pptx", variableMappings, excludedVariableNames)
              }
              onSave={() => void persistReportDefaults()}
            />
          </TabsContent>

          <TabsContent value="report-data-models" className="m-0 outline-none">
            {!reportDefaultsLoaded ? (
              <div className="flex items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-16 text-slate-400 shadow-sm">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            ) : (
              <CompanyReportDataModelDashboard
                models={reportDefaults.reportDataModels}
                saving={reportDefaultsSaving}
                dirty={reportDefaultsDirty}
                onChange={(models) => {
                  setReportDefaults((current) => ({
                    ...current,
                    reportDataModels: normalizeReportDataModels(models),
                  }));
                  setReportDefaultsDirty(true);
                }}
                onSave={() => void persistReportDefaults()}
              />
            )}
          </TabsContent>

          <TabsContent value="ai-templates" className="m-0 outline-none">
            <div className="m-0 space-y-3 p-0">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-[15px] font-black text-slate-900">قالب الذكاء الاصطناعي</h2>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                        قالب اختياري مستقل يعتمد على PDF شركة ولا يغيّر القوالب الحالية.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl text-[12px] font-bold"
                      disabled={!reportDefaultsDirty || reportDefaultsSaving}
                      onClick={resetReportDefaults}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      تراجع
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl bg-[#0C447C] text-[12px] font-black hover:bg-[#0a3a66]"
                      disabled={!reportDefaultsDirty || reportDefaultsSaving}
                      onClick={() => void persistReportDefaults()}
                    >
                      {reportDefaultsSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      حفظ
                    </Button>
                  </div>
                </div>
              </section>

              {!reportDefaultsLoaded ? (
                <div className="flex items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-16 text-slate-400 shadow-sm">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="mb-4 grid gap-2 sm:grid-cols-4">
                      {["رفع PDF", "تحليل", "مراجعة", "حفظ"].map((step, index) => {
                        const active =
                          (index === 0 && !aiTemplateFile && !aiTemplateReview) ||
                          (index === 1 && aiTemplateFile && !aiTemplateReview) ||
                          (index === 2 && aiTemplateReview) ||
                          false;
                        return (
                          <div
                            key={step}
                            className={cn(
                              "rounded-xl border px-3 py-2 text-center text-[11px] font-black",
                              active ? "border-violet-200 bg-violet-50 text-violet-800" : "border-slate-100 bg-slate-50 text-slate-500",
                            )}
                          >
                            {index + 1}. {step}
                          </div>
                        );
                      })}
                    </div>

                    <label className="grid cursor-pointer gap-3 rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-4 text-center transition hover:border-violet-300 hover:bg-violet-50">
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          event.target.value = "";
                          setAiTemplateFile(file);
                          setAiTemplateReview(null);
                          setAiTemplateReviewJson("");
                          setAiTemplateError(null);
                        }}
                      />
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm">
                        <Upload className="h-5 w-5" />
                      </span>
                      <span className="text-[13px] font-black text-slate-900">
                        {aiTemplateFile ? aiTemplateFile.name : "إنشاء قالب بالذكاء الاصطناعي"}
                      </span>
                      <span className="text-[11px] font-semibold leading-5 text-slate-500">
                        ارفع PDF لتقرير شركة، ثم استخرج منه الهوية البصرية والأقسام والمتغيرات الديناميكية.
                      </span>
                    </label>

                    {aiTemplateError ? (
                      <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                        {aiTemplateError}
                      </p>
                    ) : null}

                    <Button
                      type="button"
                      className="mt-3 h-10 w-full gap-2 rounded-xl bg-violet-700 text-[12px] font-black hover:bg-violet-800"
                      disabled={!aiTemplateFile || aiTemplateAnalyzing}
                      onClick={() => void analyzeAiTemplatePdf()}
                    >
                      {aiTemplateAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      تحليل PDF
                    </Button>

                    {aiTemplateReview ? (
                      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                          <div className="text-right">
                            <p className="text-[12px] font-black text-emerald-900">{aiTemplateReview.name}</p>
                            <p className="mt-1 text-[11px] font-semibold leading-5 text-emerald-800">
                              {aiTemplateReview.analysisSummary}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="mt-3 h-9 w-full gap-2 rounded-xl bg-emerald-700 text-[12px] font-black hover:bg-emerald-800"
                          disabled={reportDefaultsSaving}
                          onClick={() => void saveAiTemplateReview()}
                        >
                          {reportDefaultsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          حفظ القالب
                        </Button>
                      </div>
                    ) : null}
                  </section>

                  <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-right">
                        <h3 className="text-[14px] font-black text-slate-900">المراجعة والقوالب المحفوظة</h3>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                          JSON المحفوظ يستخدم لاحقا بدون إعادة تحليل PDF.
                        </p>
                      </div>
                      <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-700">
                        {reportDefaults.aiTemplates.length}
                      </Badge>
                    </div>

                    {aiTemplateReview ? (
                      <div className="mb-4 grid gap-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1.5 text-right">
                            <span className="text-[11px] font-bold text-slate-600">اسم القالب</span>
                            <Input
                              value={aiTemplateReview.name}
                              onChange={(event) =>
                                setAiTemplateReview((current) =>
                                  current ? { ...current, name: event.target.value, updatedAt: new Date().toISOString() } : current,
                                )
                              }
                              className="h-9 rounded-xl text-[12px] font-bold"
                            />
                          </label>
                          <div className="grid gap-1.5 text-right">
                            <span className="text-[11px] font-bold text-slate-600">المخرجات</span>
                            <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[11px] font-bold text-slate-600">
                              <span>{aiTemplateReview.sections.length} قسم</span>
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              <span>{aiTemplateReview.dynamicVariables.length} متغير</span>
                            </div>
                          </div>
                        </div>
                        {(() => {
                          const previewImage =
                            aiTemplateReview.coverImageDataUrl ||
                            aiTemplateReview.pageImageDataUrl ||
                            aiTemplateReview.landscapePageImageDataUrl;
                          const palette = getAiTemplatePalette(aiTemplateReview);
                          const fonts = getAiTemplateFonts(aiTemplateReview);
                          return (
                            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 lg:grid-cols-[160px_minmax(0,1fr)]">
                              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                {previewImage ? (
                                  <img
                                    src={previewImage}
                                    alt="معاينة شكل قالب الذكاء الاصطناعي"
                                    className="aspect-[3/4] h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex aspect-[3/4] items-center justify-center text-slate-300">
                                    <ImageIcon className="h-8 w-8" />
                                  </div>
                                )}
                              </div>
                              <div className="grid content-start gap-3 text-right">
                                <div>
                                  <div className="mb-2 flex items-center justify-end gap-1.5 text-[11px] font-black text-slate-700">
                                    <span>الألوان المستخرجة</span>
                                    <Palette className="h-3.5 w-3.5" />
                                  </div>
                                  {palette.length ? (
                                    <div className="flex flex-wrap justify-end gap-2">
                                      {palette.map((color) => (
                                        <span key={color} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                                          <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: color }} />
                                          {color}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[11px] font-semibold text-slate-500">لم يتم رصد ألوان واضحة من ملف PDF.</p>
                                  )}
                                </div>
                                <div>
                                  <div className="mb-2 flex items-center justify-end gap-1.5 text-[11px] font-black text-slate-700">
                                    <span>الخطوط ونمط الصفحات</span>
                                    <FileText className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="flex flex-wrap justify-end gap-1.5">
                                    {fonts.length ? (
                                      fonts.map((font) => (
                                        <span key={font} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                                          {font}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                                        خط افتراضي حسب القالب
                                      </span>
                                    )}
                                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                                      {typeof aiTemplateReview.layout.orientation === "string" ? aiTemplateReview.layout.orientation : "portrait"}
                                    </span>
                                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                                      {typeof aiTemplateReview.layout.pageSize === "string" ? aiTemplateReview.layout.pageSize : "A4"}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-[11px] font-semibold leading-5 text-slate-500">
                                  هذه المعاينة تحفظ خلفيات الصفحات وهوية التقرير لتطبيقها عند اختيار قالب AI داخل إعداد التقرير النهائي.
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                        <Textarea
                          value={aiTemplateReviewJson}
                          onChange={(event) => setAiTemplateReviewJson(event.target.value)}
                          dir="ltr"
                          rows={16}
                          className="min-h-[320px] rounded-xl border-slate-200 bg-slate-950 px-3 py-2 font-mono text-[11px] leading-5 text-slate-50"
                        />
                      </div>
                    ) : (
                      <div className="mb-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[12px] font-semibold text-slate-500">
                        ارفع PDF ثم اضغط تحليل لعرض JSON القالب هنا.
                      </div>
                    )}

                    <div className="grid gap-2">
                      {reportDefaults.aiTemplates.length === 0 ? (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-center text-[12px] font-semibold text-slate-500">
                          لا توجد قوالب ذكاء اصطناعي محفوظة.
                        </div>
                      ) : (
                        reportDefaults.aiTemplates.map((template) => (
                          <div key={template.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 text-right">
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <Badge className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] text-violet-800">
                                    AI Template
                                  </Badge>
                                  <h4 className="min-w-0 truncate text-[13px] font-black text-slate-900">{template.name}</h4>
                                </div>
                                <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-slate-500">
                                  {template.analysisSummary || template.sourceFileName || "قالب محفوظ من PDF."}
                                </p>
                                <div className="mt-2 flex flex-wrap justify-end gap-1.5 text-[10px] font-bold text-slate-500">
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5">{template.sections.length} قسم</span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5">{template.dynamicVariables.length} متغير</span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                                    {template.updatedAt ? new Date(template.updatedAt).toLocaleDateString("ar") : "—"}
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 rounded-lg text-rose-600 hover:bg-rose-50"
                                onClick={() => void removeAiTemplate(template.id)}
                                title="حذف القالب"
                                aria-label="حذف القالب"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={letterheadImagesOpen} onOpenChange={setLetterheadImagesOpen}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden rounded-2xl border-slate-200 p-0" dir="rtl">
          <DialogHeader className="border-b border-slate-100 px-4 py-3 text-right">
            <DialogTitle className="text-base font-black">صور الأكلاشية</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <ReportTemplateImageUploader
                label="صورة الغلاف"
                helper="خلفية صفحة الغلاف الأولى."
                value={reportDefaults.letterhead.coverImageDataUrl}
                onChange={(value) => updateLetterhead("coverImageDataUrl", value)}
                maxEdge={1800}
              />
              <ReportTemplateImageUploader
                label="تمبلت الصفحات الطولية"
                helper="الصورة التي تتكرر خلف الصفحات الداخلية."
                value={reportDefaults.letterhead.pageImageDataUrl}
                onChange={(value) => updateLetterhead("pageImageDataUrl", value)}
                maxEdge={1800}
              />
              <ReportTemplateImageUploader
                label="تمبلت الصفحات بالعرض"
                helper="يستخدم عند تدوير صفحة أو صورة إلى الوضع العرضي."
                value={reportDefaults.letterhead.landscapePageImageDataUrl}
                onChange={(value) => updateLetterhead("landscapePageImageDataUrl", value)}
                maxEdge={1800}
              />
              <ReportTemplateImageUploader
                label="لوجو الهيدر"
                helper="إن لم يرفع، يستخدم شعار الشركة من الإعدادات العامة."
                value={reportDefaults.letterhead.logoDataUrl}
                onChange={(value) => updateLetterhead("logoDataUrl", value)}
                maxEdge={900}
                transparent
              />
              <ReportTemplateImageUploader
                label="صورة بيانات الفوتر"
                helper="تظهر أسفل كل صفحة بدلاً من نص الفوتر الافتراضي."
                value={reportDefaults.letterhead.footerImageDataUrl}
                onChange={(value) => updateLetterhead("footerImageDataUrl", value)}
                maxEdge={1400}
              />
              <ReportTemplateImageUploader
                label="صورة التوقيع والختم"
                helper="تظهر في صفحة رأي القيمة عند إخراج التقرير النهائي."
                value={reportDefaults.letterhead.signatureStampDataUrl}
                onChange={(value) => updateLetterhead("signatureStampDataUrl", value)}
                maxEdge={900}
                transparent
              />
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 px-4 py-3 sm:justify-start sm:space-x-0">
            <Button
              type="button"
              className="gap-1.5 rounded-xl bg-[#0C447C] hover:bg-[#0a3a66]"
              disabled={!reportDefaultsDirty || reportDefaultsSaving}
              onClick={async () => {
                await persistReportDefaults();
                setLetterheadImagesOpen(false);
              }}
            >
              {reportDefaultsSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              حفظ
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setLetterheadImagesOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={letterheadPreviewTemplate != null}
        onOpenChange={(open) => {
          if (!open) setLetterheadPreviewId(null);
        }}
      >
        <DialogContent className="flex max-h-[92dvh] max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 p-0" dir="rtl">
          <DialogHeader className="border-b border-slate-100 px-4 py-3 text-right">
            <DialogTitle className="text-base font-black">
              {letterheadPreviewTemplate?.title ?? "معاينة القالب"}
            </DialogTitle>
            {letterheadPreviewTemplate?.description ? (
              <DialogDescription className="pt-1 text-right text-[11px] font-semibold leading-5 text-slate-500">
                {letterheadPreviewTemplate.description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 sm:p-6">
            {letterheadPreviewTemplate ? (
              <div className="mx-auto w-max rounded-xl border border-slate-200 bg-white shadow-xl">
                <SystemReportTemplatePreview
                  template={letterheadPreviewTemplate}
                  letterhead={reportDefaults.letterhead}
                  companyName={data?.company?.name ?? "شركة التقييم"}
                  companyLogoSrc={reportDefaults.letterhead.logoDataUrl || logoDraft}
                  large
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reportSectionOpen} onOpenChange={setReportSectionOpen}>
        <DialogContent className="max-w-xl rounded-2xl border-slate-200" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {reportSectionEditingId ? "تعديل بند التقرير" : "إضافة بند للتقرير النهائي"}
            </DialogTitle>
            <DialogDescription className="text-right text-[12px] leading-6">
              سيتم إدراج هذا البند كقسم مستقل داخل صفحة إعداد التقرير والتقرير النهائي.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">رقم البند</Label>
              <Input
                value={reportSectionNumber}
                onChange={(e) => setReportSectionNumber(e.target.value)}
                placeholder="مثال: 25.0"
                className="rounded-xl"
                dir="ltr"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">عنوان البند</Label>
              <Input
                value={reportSectionTitle}
                onChange={(e) => setReportSectionTitle(e.target.value)}
                placeholder="عنوان القسم"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">تفاصيل البند</Label>
              <Textarea
                value={reportSectionBody}
                onChange={(e) => setReportSectionBody(e.target.value)}
                rows={8}
                placeholder="اكتب البراجراف أو تفاصيل القسم هنا"
                className="rounded-xl leading-7"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-start sm:space-x-0">
            <Button type="button" className="rounded-xl bg-[#0C447C]" onClick={persistReportSectionDraft}>
              حفظ البند
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setReportSectionOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className={PROFESSIONAL_DIALOG_CONTENT_CLASS} dir="rtl">
          <ProfessionalModalShell
            accent="sky"
            icon={<UserPlus className="h-5 w-5" />}
            title="مستخدم جديد"
            description="إنشاء حساب دخول للشركة مع بيانات الظهور في تقارير التقييم."
            footer={
              <>
                <Button
                  type="button"
                  className="min-w-[8rem] rounded-xl bg-[#0C447C] hover:bg-[#0a3a66]"
                  disabled={submitting || !newPhone.trim() || newPassword.length < 8}
                  onClick={() => void onAddUser()}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  إنشاء المستخدم
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={submitting}
                  onClick={() => setAddOpen(false)}
                >
                  إلغاء
                </Button>
              </>
            }
          >
            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-[11px] font-medium leading-5 text-sky-900">
              رقم الهاتف وكلمة المرور للدخول فقط. الاسم والوظيفة ورقم العضوية هي ما يظهر في التقرير.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label className="text-[12px] font-bold text-slate-700">رقم الهاتف</Label>
                <PhoneNumberInput value={newPhone} onChange={setNewPhone} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label className="text-[12px] font-bold text-slate-700">كلمة المرور</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-11 rounded-xl border-slate-200"
                  placeholder="8 أحرف على الأقل"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[12px] font-bold text-slate-700">الدور</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as typeof newRole)}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[960]">
                    <SelectItem value="valuer">مقيم</SelectItem>
                    <SelectItem value="inspector">مفتش / معاين ميداني</SelectItem>
                    <SelectItem value="data_entry">مدخل بيانات</SelectItem>
                    <SelectItem value="reviewer">مراجع</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[12px] font-bold text-slate-700">البريد (اختياري)</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
            </div>
            <div className="h-px bg-gradient-to-l from-transparent via-slate-200 to-transparent" />
            <div className="grid gap-3">
              <p className="text-[11px] font-extrabold tracking-wide text-slate-400">بيانات التقرير</p>
              <div className="grid gap-1.5">
                <Label className="text-[12px] font-bold text-slate-700">الاسم الذي يظهر في التقرير</Label>
                <Input
                  value={newReportDisplayName}
                  onChange={(e) => setNewReportDisplayName(e.target.value)}
                  placeholder="الاسم الكامل للمقيم"
                  className="h-11 rounded-xl border-slate-200"
                  dir="rtl"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-[12px] font-bold text-slate-700">الوظيفة</Label>
                  <Input
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    placeholder="مقيم منتسب آلات ومعدات"
                    className="h-11 rounded-xl border-slate-200"
                    dir="rtl"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[12px] font-bold text-slate-700">رقم العضوية</Label>
                  <Input
                    value={newMembershipNo}
                    onChange={(e) => setNewMembershipNo(e.target.value)}
                    placeholder="421000000"
                    className="h-11 rounded-xl border-slate-200"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </ProfessionalModalShell>
        </DialogContent>
      </Dialog>

      <Dialog open={addReportOnlyOpen} onOpenChange={setAddReportOnlyOpen}>
        <DialogContent className={PROFESSIONAL_DIALOG_CONTENT_CLASS} dir="rtl">
          <ProfessionalModalShell
            accent="violet"
            icon={<PenLine className="h-5 w-5" />}
            title="إضافة معدّ تقرير"
            description="يظهر في المقيمون والتوقيعات واختيار معدّي التقرير فقط، بدون حساب دخول للنظام."
            footer={
              <>
                <Button
                  type="button"
                  className="min-w-[8rem] rounded-xl bg-violet-600 hover:bg-violet-700"
                  disabled={reportOnlyBusy || reportOnlyName.trim().length < 2}
                  onClick={() => void onAddReportOnlySignatory()}
                >
                  {reportOnlyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  حفظ المعدّ
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={reportOnlyBusy}
                  onClick={() => setAddReportOnlyOpen(false)}
                >
                  إلغاء
                </Button>
              </>
            }
          >
            <div className="rounded-2xl border border-violet-100 bg-violet-50/80 px-3 py-2.5 text-[11px] font-medium leading-5 text-violet-950">
              لا يلزم رقم هاتف أو إيميل أو كلمة مرور. بعد الحفظ يمكنك رفع التوقيع من جدول المقيمون والتوقيعات.
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px] font-bold text-slate-700">الاسم الذي يظهر في التقرير</Label>
              <Input
                value={reportOnlyName}
                onChange={(e) => setReportOnlyName(e.target.value)}
                placeholder="الاسم الكامل"
                className="h-11 rounded-xl border-slate-200"
                dir="rtl"
                autoFocus
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-[12px] font-bold text-slate-700">الوظيفة</Label>
                <Input
                  value={reportOnlyJobTitle}
                  onChange={(e) => setReportOnlyJobTitle(e.target.value)}
                  placeholder="مقيم منتسب آلات ومعدات"
                  className="h-11 rounded-xl border-slate-200"
                  dir="rtl"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[12px] font-bold text-slate-700">رقم العضوية</Label>
                <Input
                  value={reportOnlyMembershipNo}
                  onChange={(e) => setReportOnlyMembershipNo(e.target.value)}
                  placeholder="421000000"
                  className="h-11 rounded-xl border-slate-200"
                  dir="ltr"
                />
              </div>
            </div>
          </ProfessionalModalShell>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editReportOnlyOpen}
        onOpenChange={(open) => {
          setEditReportOnlyOpen(open);
          if (!open) setEditReportOnlyTarget(null);
        }}
      >
        <DialogContent className={PROFESSIONAL_DIALOG_CONTENT_CLASS} dir="rtl">
          <ProfessionalModalShell
            accent="violet"
            icon={<PenLine className="h-5 w-5" />}
            title="تعديل معدّ التقرير"
            description="تحديث بيانات الظهور في التقارير دون إنشاء حساب مستخدم."
            footer={
              <>
                <Button
                  type="button"
                  className="min-w-[8rem] rounded-xl bg-violet-600 hover:bg-violet-700"
                  disabled={reportOnlyBusy || editReportOnlyName.trim().length < 2}
                  onClick={() => void onSaveReportOnlySignatory()}
                >
                  {reportOnlyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  حفظ التعديلات
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={reportOnlyBusy}
                  onClick={() => setEditReportOnlyOpen(false)}
                >
                  إلغاء
                </Button>
              </>
            }
          >
            <div className="grid gap-1.5">
              <Label className="text-[12px] font-bold text-slate-700">الاسم الذي يظهر في التقرير</Label>
              <Input
                value={editReportOnlyName}
                onChange={(e) => setEditReportOnlyName(e.target.value)}
                className="h-11 rounded-xl border-slate-200"
                dir="rtl"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-[12px] font-bold text-slate-700">الوظيفة</Label>
                <Input
                  value={editReportOnlyJobTitle}
                  onChange={(e) => setEditReportOnlyJobTitle(e.target.value)}
                  className="h-11 rounded-xl border-slate-200"
                  dir="rtl"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[12px] font-bold text-slate-700">رقم العضوية</Label>
                <Input
                  value={editReportOnlyMembershipNo}
                  onChange={(e) => setEditReportOnlyMembershipNo(e.target.value)}
                  className="h-11 rounded-xl border-slate-200"
                  dir="ltr"
                />
              </div>
            </div>
          </ProfessionalModalShell>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent
          className="flex max-h-[min(92dvh,920px)] w-[min(96vw,28rem)] max-w-[min(96vw,28rem)] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 shadow-2xl"
          dir="rtl"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="shrink-0 space-y-1 border-b border-slate-100 px-5 py-4 pe-12 text-right sm:px-6">
              <DialogTitle className="text-base font-bold">
                تعديل مستخدم{editTarget ? ` — ${userDisplayName(editTarget)}` : ""}
              </DialogTitle>
            </DialogHeader>
            {editTarget ? (
              <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
                <div className="grid gap-3">
                  {editTarget.role === "company_admin" ? (
                    <p className="text-[12px] leading-relaxed text-slate-500">
                      كمدير شركة يمكنك تحديث بيانات الحساب وبيانات ظهورك في التقرير. تغيير الدور غير متاح من هنا.
                    </p>
                  ) : (
                    <div className="grid gap-1.5">
                      <Label className="text-[12px] text-slate-600">الدور</Label>
                      <Select value={editRole} onValueChange={(v) => setEditRole(v as MemberRoleOption)}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[960]">
                          <SelectItem value="valuer">مقيم</SelectItem>
                          <SelectItem value="inspector">مفتش / معاين ميداني</SelectItem>
                          <SelectItem value="data_entry">مدخل بيانات</SelectItem>
                          <SelectItem value="reviewer">مراجع</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid gap-1.5">
                    <Label className="text-[12px] text-slate-600">البريد (اختياري)</Label>
                    <Input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[12px] text-slate-600">رقم الهاتف</Label>
                    <PhoneNumberInput value={editPhone} onChange={setEditPhone} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[12px] text-slate-600">الاسم الذي يظهر في التقرير</Label>
                    <Input
                      value={editReportDisplayName}
                      onChange={(e) => setEditReportDisplayName(e.target.value)}
                      placeholder="الاسم الكامل للمقيم"
                      className="rounded-xl"
                      dir="rtl"
                    />
                    <p className="text-[10.5px] text-slate-400">رقم الهاتف مخصص للدخول ولا يظهر في التقرير.</p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[12px] text-slate-600">الوظيفة</Label>
                    <Input
                      value={editJobTitle}
                      onChange={(e) => setEditJobTitle(e.target.value)}
                      placeholder="مقيم منتسب آلات ومعدات"
                      className="rounded-xl"
                      dir="rtl"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[12px] text-slate-600">رقم العضوية</Label>
                    <Input
                      value={editMembershipNo}
                      onChange={(e) => setEditMembershipNo(e.target.value)}
                      placeholder="421000000"
                      className="rounded-xl"
                      dir="ltr"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[12px] text-slate-600">كلمة مرور جديدة (اختياري)</Label>
                    <Input
                      type="password"
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="اتركه فارغاً إن لم تتغيّر"
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 border-t border-slate-100 bg-slate-50/90 px-5 py-3.5 sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={userActionBusy}
                  onClick={() => setEditOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="button"
                  className="rounded-xl bg-[#0C447C] hover:bg-[#0a3a66]"
                  disabled={userActionBusy}
                  onClick={() => void onSaveEditedUser()}
                >
                  {userActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  حفظ التغييرات
                </Button>
              </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="z-[960] max-w-md rounded-2xl" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستخدم؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {deleteTarget
                ? `سيتم حذف «${userDisplayName(deleteTarget)}» نهائياً من الشركة. لا يمكن التراجع عن هذا الإجراء.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel className="rounded-xl" disabled={userActionBusy}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
              disabled={userActionBusy}
              onClick={(e) => {
                e.preventDefault();
                void onConfirmDeleteUser();
              }}
            >
              {userActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteReportOnlyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteReportOnlyTarget(null);
        }}
      >
        <AlertDialogContent className="z-[960] max-w-md rounded-2xl" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف معدّ التقرير؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {deleteReportOnlyTarget
                ? `سيتم حذف «${deleteReportOnlyTarget.name}» من المقيمون والتوقيعات. لن يظهر لاحقاً في اختيار معدّي التقرير.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel className="rounded-xl" disabled={reportOnlyBusy}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
              disabled={reportOnlyBusy}
              onClick={(e) => {
                e.preventDefault();
                void onDeleteReportOnlySignatory();
              }}
            >
              {reportOnlyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (variant === "standalone") {
    return (
      <div className={shellClass} dir="rtl">
        {inner}
      </div>
    );
  }

  return (
    <div className={shellClass} dir="rtl">
      {inner}
    </div>
  );
}
