"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { downloadPptxFromPngSlides } from "@/lib/pptx-export";
import {
  Building2,
  ClipboardList,
  Download,
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
  Stamp,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

export type CompanyAdminDashboardVariant = "standalone" | "embedded";
export type CompanyAdminDashboardMode = "general" | "report-defaults";

type CompanyInfo = {
  id: string;
  name: string;
  valueTechProductIds: string[];
  logoDataUrl?: string | null;
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
  createdAt: string;
  lastLoginAt?: string | null;
  valuationReportSignatureDataUrl?: string | null;
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
  letterhead: CompanyReportLetterheadForm;
};

function emptyReportLetterhead(): CompanyReportLetterheadForm {
  return {
    enabled: false,
    templateId: "classic-letterhead",
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
    id: "classic-letterhead",
    title: "كلاسيكي رسمي",
    description: "قالب PDF محافظ يعتمد على غلاف وصفحات داخلية وفوتر واضح.",
    outputFormat: "pdf",
    accentClass: "from-sky-600 to-cyan-500",
    badge: "PDF",
  },
  {
    id: "modern-letterhead",
    title: "حديث مدمج",
    description: "قالب أنظف للمحتوى الطويل مع إبراز الشعار والتوقيع في أماكن ثابتة.",
    outputFormat: "pdf",
    accentClass: "from-emerald-600 to-teal-500",
    badge: "PDF",
  },
  {
    id: "powerpoint-deck",
    title: "PowerPoint Deck",
    description: "يحوّل صفحات التقرير إلى شرائح PowerPoint بنسبة عرض 16:9 قابلة للتنزيل كملف PPTX.",
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
    letterhead: emptyReportLetterhead(),
  };
}

function isReportTemplateImageSource(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.startsWith("data:image/") || trimmed.startsWith("/uploads/company-report-templates/");
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
  return {
    scope: merge(base.scope, raw.scope as Partial<typeof base.scope> | undefined),
    methodology: merge(base.methodology, raw.methodology as Partial<typeof base.methodology> | undefined),
    assumptions: merge(base.assumptions, raw.assumptions as Partial<typeof base.assumptions> | undefined),
    customGroups,
    customSections,
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
    label: "3.0 الامتثال لمعايير التقييم الدولية",
    helper: "بيان امتثال التقييم لمعايير IVS وأنظمة الهيئة السعودية للمقيمين المعتمدين (تقييم).",
    rows: 5,
  },
  {
    key: "independenceStatement",
    label: "4.0 إقرار بالاستقلالية وعدم تضارب المصالح",
    helper:
      "إقرار باستقلالية فريق التقييم — يدعم تعويض {companyName} باسم الشركة تلقائياً عند العرض.",
    rows: 5,
  },
  {
    key: "intendedUseStatement",
    label: "10.0 الاستخدام المقصود",
    helper: "نص افتراضي يصف الجهة المستفيدة وغرض الاستخدام من التقرير.",
    rows: 4,
  },
  {
    key: "scopeOfWorkDetails",
    label: "8.0 نطاق العمل",
    helper:
      "ما يتم الاتفاق عليه قبل البدء: المقابلات والمعاينة وأبحاث السوق ومراجعة المستندات وما إلى ذلك.",
    rows: 7,
  },
  {
    key: "valuationBasisDefinition",
    label: "11.0 أساس القيمة — التعريف الكامل",
    helper: "تعريف القيمة السوقية أو ما يماثلها وفق معايير IVS.",
    rows: 5,
  },
  {
    key: "valuePremiseDefinition",
    label: "12.0 فرضية القيمة — المرجع المعياري",
    helper: "نص قصير يحيل إلى مرجع IVS لفرضية القيمة.",
    rows: 2,
  },
  {
    key: "useRestriction",
    label: "13.0 القيود على الاستخدام أو التوزيع أو النشر",
    helper: "تحديد الأطراف المصرّح لها بالاستخدام وحدود نشر التقرير.",
    rows: 5,
  },
  {
    key: "externalSpecialistUse",
    label: "14.0 الاستعانة بأخصائيين خارجيين",
    helper: "بيان مدى الاعتماد على متخصصين خارج فريق التقييم.",
    rows: 4,
  },
  {
    key: "esgConsiderations",
    label: "15.0 العوامل البيئية والاجتماعية والحوكمة (ESG)",
    helper: "أثر العوامل البيئية والاجتماعية والحوكمة على رأي القيمة.",
    rows: 4,
  },
  {
    key: "informationSources",
    label: "17.0 طبيعة ومصادر المعلومات المعتمد عليها",
    helper: "المدخلات من العميل، أبحاث السوق، المصادر العامة والمتخصصة، إلخ.",
    rows: 6,
  },
];

const REPORT_DEFAULTS_METHODOLOGY_FIELDS: ReportDefaultsField[] = [
  {
    key: "assetSubjectDescription",
    label: "18.0 الأصل محل التقييم — وصف عام",
    helper: "نص افتراضي يلي العنوان «18.0 الأصل محل التقييم»؛ يُستبدل تلقائياً بالقيم الديناميكية للمشروع.",
    rows: 4,
  },
  {
    key: "assetDetailedDescription",
    label: "18.1 الوصف الجزئي",
    helper: "نص افتراضي يلي العنوان «18.1 الوصف الجزئي» — يُحال إلى المرفقات للتفاصيل.",
    rows: 5,
  },
  {
    key: "methodologyRationale",
    label: "21.0 منهجية التقييم والتحليل",
    rows: 6,
  },
  {
    key: "costApproachDetails",
    label: "22.0 تطبيق أسلوب التكلفة",
    rows: 7,
  },
  {
    key: "salvageValueDescription",
    label: "22.1 القيمة المتبقية (القيمة التخريدية)",
    rows: 5,
  },
  {
    key: "physicalDepreciationDescription",
    label: "22.2 الإهلاك المادي",
    rows: 7,
  },
  {
    key: "functionalObsolescenceDescription",
    label: "22.3 التقادم الوظيفي",
    rows: 4,
  },
  {
    key: "economicObsolescenceDescription",
    label: "22.4 التقادم الاقتصادي",
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
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [brandingBusy, setBrandingBusy] = useState(false);
  const [signatureBusyUserId, setSignatureBusyUserId] = useState<string | null>(null);
  const [logoDraft, setLogoDraft] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"valuer" | "data_entry" | "reviewer" | "inspector">("valuer");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyUserRow | null>(null);
  const [editRole, setEditRole] = useState<MemberRoleOption>("valuer");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CompanyUserRow | null>(null);
  const [userActionBusy, setUserActionBusy] = useState(false);

  const [reportDefaults, setReportDefaults] = useState<CompanyReportDefaultsForm>(() => emptyReportDefaults());
  const [reportDefaultsLoaded, setReportDefaultsLoaded] = useState(false);
  const [reportDefaultsSaving, setReportDefaultsSaving] = useState(false);
  const [reportDefaultsDirty, setReportDefaultsDirty] = useState(false);
  const [reportDefaultsBaseline, setReportDefaultsBaseline] = useState<CompanyReportDefaultsForm | null>(null);
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
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [personalSignature, setPersonalSignature] = useState<string | null>(null);
  const [personalBusy, setPersonalBusy] = useState(false);
  const [personalSignatureBusy, setPersonalSignatureBusy] = useState(false);
  const productQuery = useMemo(
    () => (productId ? `?productId=${encodeURIComponent(productId)}` : ""),
    [productId],
  );
  const productPayload = useMemo(() => (productId ? { productId } : {}), [productId]);
  const productLabel = productId ? VALUE_TECH_PRODUCT_LABELS_AR[productId] : null;
  const reportDefaultsOnly = mode === "report-defaults";
  const isCompanyAdmin = user?.role === "company_admin";

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const payload = await apiJson<{
        company: CompanyInfo | null;
        users: CompanyUserRow[];
      }>(`/api/company/users${productQuery}`, csrfToken);
      setData({ company: payload.company, users: payload.users ?? [] });
      setLogoDraft(payload.company?.logoDataUrl ?? null);
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
      });
      setStatus("تم حفظ بياناتك الشخصية.");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل حفظ بيانات المستخدم.");
    } finally {
      setPersonalBusy(false);
    }
  }, [personalEmail, personalPhone, updateProfile]);

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
        }),
      });
      setStatus("تم حفظ الشعار.");
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

  const downloadPowerPointTemplateSample = useCallback(() => {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#eef6ff");
    gradient.addColorStop(0.55, "#ffffff");
    gradient.addColorStop(1, "#fff7ed");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#0C447C";
    ctx.fillRect(0, 0, canvas.width, 88);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(0, 88, canvas.width, 8);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 42px Arial";
    ctx.textAlign = "right";
    ctx.fillText("قالب التقرير النهائي - PowerPoint", 1510, 57);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#d7dee8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(165, 160, 1270, 600, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 34px Arial";
    ctx.fillText("محتوى صفحة التقرير يظهر داخل إطار PowerPoint", 1350, 245);
    ctx.fillStyle = "#475569";
    ctx.font = "500 25px Arial";
    ctx.fillText("يتم تحويل كل صفحة من التقرير النهائي إلى شريحة مستقلة قابلة للعرض والمشاركة.", 1350, 305);

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
      const y = 390 + i * 56;
      ctx.beginPath();
      ctx.moveTo(330, y);
      ctx.lineTo(1270, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#0f766e";
    ctx.beginPath();
    ctx.roundRect(330, 650, 360, 54, 18);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PPTX", 510, 686);

    downloadPptxFromPngSlides(
      [{ dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height, title: "PowerPoint Template" }],
      "spark-vision-report-template.pptx",
      "Spark Vision PowerPoint Template",
    );
  }, []);

  const persistReportDefaults = useCallback(async () => {
    setReportDefaultsSaving(true);
    setSubmitError(null);
    setStatus(null);
    try {
      const payload = await apiJson<{ reportDefaults?: Partial<CompanyReportDefaultsForm> | null }>(
        "/api/company/admin/report-defaults",
        csrfToken,
        {
          method: "PATCH",
          body: JSON.stringify(reportDefaults),
        },
      );
      if (payload.reportDefaults) {
        const normalized = normalizeReportDefaults(payload.reportDefaults);
        setReportDefaults(normalized);
        setReportDefaultsBaseline(normalized);
      } else {
        setReportDefaultsBaseline(reportDefaults);
      }
      setReportDefaultsDirty(false);
      setStatus("تم حفظ أقسام التقرير.");
      return true;
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل حفظ أقسام التقرير.");
      return false;
    } finally {
      setReportDefaultsSaving(false);
    }
  }, [csrfToken, reportDefaults]);

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

  const onAddUser = async () => {
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
          phone: ph,
        }),
      });
      setStatus("تم إنشاء المستخدم.");
      setNewPassword("");
      setNewEmail("");
      setNewPhone("");
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
    setEditNewPassword("");
    setEditOpen(true);
    setSubmitError(null);
    setStatus(null);
  }, []);

  const onSaveEditedUser = async () => {
    if (!editTarget) return;
    const body: Record<string, unknown> = {};
    const origEmail = editTarget.email ?? "";
    const origPhone = editTarget.phone ?? "";
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
  const letterheadCatalogTemplates = hasLetterheadImages
    ? [...LETTERHEAD_TEMPLATE_OPTIONS, COMPANY_LETTERHEAD_TEMPLATE_OPTION]
    : LETTERHEAD_TEMPLATE_OPTIONS;
  const letterheadPreviewTemplate = letterheadPreviewId
    ? (letterheadCatalogTemplates.find((item) => item.id === letterheadPreviewId) ?? null)
    : null;

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
          defaultValue={reportDefaultsOnly ? "report-defaults" : "info"}
          className="flex min-h-0 flex-col gap-4"
          dir="rtl"
        >
          {reportDefaultsOnly ? (
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-slate-200/40 p-1 md:w-auto">
              <TabsTrigger
                value="report-defaults"
                className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                أقسام التقرير
              </TabsTrigger>
              <TabsTrigger
                value="letterhead"
                className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                الأكلاشية والقوالب
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
                            <TableCell className="font-medium text-slate-900" dir="ltr">
                              {userDisplayName(u)}
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
                <div className="flex items-center gap-2 text-slate-700">
                  <PenLine className="h-4 w-4 text-violet-600" />
                  <span className="text-[13px] font-semibold">المقيمون والتوقيعات</span>
                </div>
                <p className="text-[11px] text-slate-500">نفس مستخدمي الشركة — التوقيع يُحفظ لكل مستخدم في قاعدة البيانات.</p>
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
                        <TableHead className="min-w-[200px] text-right text-[12px] font-semibold text-slate-500">
                          التوقيع (PNG)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.users.map((u) => (
                        <TableRow key={u.id} className="border-slate-100">
                          <TableCell className="font-medium text-slate-900" dir="ltr">
                            {userDisplayName(u)}
                          </TableCell>
                          <TableCell className="text-slate-700">{ROLE_LABELS[u.role] ?? u.role}</TableCell>
                          <TableCell className="text-[12px] text-slate-500">
                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ar") : "—"}
                          </TableCell>
                          <TableCell className="p-0 align-top">
                            <MemberSignatureCell
                              savedUrl={u.valuationReportSignatureDataUrl ?? null}
                              busy={signatureBusyUserId === u.id}
                              onPersist={(url) => persistMemberSignature(u.id, url)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </TabsContent>

            </>
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
              <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                      <Palette className="h-5 w-5" />
                    </span>
                    <h2 className="text-[15px] font-black text-slate-900">الأكلاشية والقوالب</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl text-[12px] font-black"
                      onClick={() => setLetterheadImagesOpen(true)}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      صور الأكلاشية
                    </Button>
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
                <>
                  <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-[14px] font-black text-slate-900">قوالب جاهزة للاستخدام</h3>
                      <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-700">
                        {letterheadCatalogTemplates.length}
                      </Badge>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-3">
                      {letterheadCatalogTemplates.map((template) => {
                        const isCompanyTemplate = template.id === COMPANY_LETTERHEAD_TEMPLATE_OPTION.id;
                        const previewImage = isCompanyTemplate
                          ? reportDefaults.letterhead.coverImageDataUrl ||
                            reportDefaults.letterhead.pageImageDataUrl ||
                            reportDefaults.letterhead.landscapePageImageDataUrl
                          : null;
                        return (
                          <div
                            key={template.id}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300"
                          >
                            <div className="relative h-32 bg-slate-50">
                              {previewImage ? (
                                <img src={previewImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                              ) : (
                                <>
                                  <div className={cn("absolute inset-x-0 top-0 h-3 bg-gradient-to-l", template.accentClass)} />
                                  <div className="absolute inset-x-5 bottom-4 top-8 rounded-xl border border-slate-200 bg-white shadow-sm">
                                    <div className={cn("h-8 rounded-t-xl bg-gradient-to-l", template.accentClass)} />
                                    <div className="space-y-2 p-3">
                                      <div className="h-2 w-2/3 rounded bg-slate-300" />
                                      <div className="h-2 w-full rounded bg-slate-200" />
                                      <div className="h-2 w-5/6 rounded bg-slate-200" />
                                    </div>
                                  </div>
                                </>
                              )}
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
                                <Badge className="rounded-full bg-white text-[10px] text-slate-800 shadow-sm">
                                  {template.badge}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 p-3">
                              <h4 className="min-w-0 truncate text-right text-[13px] font-black text-slate-900">
                                {template.title}
                              </h4>
                              {template.outputFormat === "pptx" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 shrink-0 gap-1 rounded-xl px-2 text-[11px]"
                                  onClick={downloadPowerPointTemplateSample}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  نموذج
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                </>
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
        <DialogContent className="max-w-3xl rounded-2xl border-slate-200 p-0" dir="rtl">
          <DialogHeader className="border-b border-slate-100 px-4 py-3 text-right">
            <DialogTitle className="text-base font-black">
              {letterheadPreviewTemplate?.title ?? "معاينة القالب"}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-slate-100 p-4">
            <div className="mx-auto aspect-[210/297] max-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {letterheadPreviewTemplate?.id === COMPANY_LETTERHEAD_TEMPLATE_OPTION.id &&
              (reportDefaults.letterhead.coverImageDataUrl ||
                reportDefaults.letterhead.pageImageDataUrl ||
                reportDefaults.letterhead.landscapePageImageDataUrl) ? (
                <img
                  src={
                    reportDefaults.letterhead.coverImageDataUrl ||
                    reportDefaults.letterhead.pageImageDataUrl ||
                    reportDefaults.letterhead.landscapePageImageDataUrl ||
                    ""
                  }
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="relative h-full w-full bg-white">
                  <div
                    className={cn(
                      "absolute inset-x-0 top-0 h-20 bg-gradient-to-l",
                      letterheadPreviewTemplate?.accentClass ?? "from-sky-600 to-cyan-500",
                    )}
                  />
                  <div className="absolute left-8 right-8 top-28 space-y-3">
                    <div className="h-4 w-1/2 rounded bg-slate-300" />
                    <div className="h-3 w-full rounded bg-slate-200" />
                    <div className="h-3 w-11/12 rounded bg-slate-200" />
                    <div className="h-3 w-10/12 rounded bg-slate-200" />
                    <div className="mt-8 grid grid-cols-2 gap-3">
                      <div className="h-24 rounded-lg bg-slate-100" />
                      <div className="h-24 rounded-lg bg-slate-100" />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-slate-100" />
                  {letterheadPreviewTemplate?.outputFormat === "pptx" ? (
                    <div className="absolute inset-8 flex items-center justify-center rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 text-lg font-black text-amber-800">
                      16:9 PowerPoint
                    </div>
                  ) : null}
                </div>
              )}
            </div>
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
        <DialogContent className="max-w-md rounded-2xl border-slate-200" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">مستخدم جديد</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">رقم الهاتف</Label>
              <PhoneNumberInput value={newPhone} onChange={setNewPhone} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">كلمة المرور</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">الدور</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as typeof newRole)}>
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
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">البريد (اختياري)</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <Button
              type="button"
              className="mt-2 rounded-xl bg-[#0C447C] hover:bg-[#0a3a66]"
              disabled={submitting || !newPhone.trim() || newPassword.length < 8}
              onClick={() => void onAddUser()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              إنشاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-slate-200" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              تعديل مستخدم{editTarget ? ` — ${userDisplayName(editTarget)}` : ""}
            </DialogTitle>
          </DialogHeader>
          {editTarget ? (
            <div className="grid gap-3 pt-2">
              {editTarget.role === "company_admin" ? (
                <p className="text-[12px] leading-relaxed text-slate-500">
                  كمدير شركة يمكنك تحديث بريدك وهاتفك وكلمة المرور فقط. تغيير الدور غير متاح من هنا.
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
              <div className="flex flex-wrap gap-2 pt-1">
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
            </div>
          ) : null}
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
