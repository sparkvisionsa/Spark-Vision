import type { SmartGridAssetType } from "@/components/smart-grid/SmartGrid";

/**
 * ‎hub‎: اختيار المسار (إكسيل جاهز / النظام) — مراحل ‎asset-types | method‎ للتقييم داخل النظام فقط.
 * ‎ready-excel‎: رفع ومراجعة إكسيل مُهيأ مسبقاً.
 */
export type MvValuationPhaseSlug = "hub" | "ready-excel" | "asset-types" | "method";

/** مرحلتان داخل «التقييم عبر النظام» (تُعرض في المخطط فقط) */
export const MV_VALUATION_PHASES: {
  slug: "asset-types" | "method";
  label: string;
  shortLabel: string;
}[] = [
  { slug: "asset-types", label: "تحديد وتصفية نوع الأصول", shortLabel: "نوع الأصول" },
  { slug: "method", label: "أسلوب التقييم", shortLabel: "الأسلوب" },
];

export function isMvValuationPhaseSlug(value: string): value is MvValuationPhaseSlug {
  if (value === "hub" || value === "ready-excel") return true;
  return MV_VALUATION_PHASES.some((p) => p.slug === value);
}

export function parseValuationPhaseSlug(segment: string | undefined): MvValuationPhaseSlug {
  if (segment === "cost-modern") return "method";
  if (segment === "hub" || segment === "ready-excel") return segment;
  if (segment && (segment === "asset-types" || segment === "method")) return segment;
  if (segment && isMvValuationPhaseSlug(segment)) return segment;
  return "asset-types";
}

export function valuationPhaseIndex(slug: MvValuationPhaseSlug): number {
  if (slug === "hub" || slug === "ready-excel") return -1;
  return MV_VALUATION_PHASES.findIndex((p) => p.slug === slug);
}

export function nextValuationPhaseSlug(slug: MvValuationPhaseSlug): MvValuationPhaseSlug | null {
  const i = valuationPhaseIndex(slug);
  if (i < 0 || i >= MV_VALUATION_PHASES.length - 1) return null;
  return MV_VALUATION_PHASES[i + 1]!.slug;
}

/** الأسلوب المختار بعد الحوار */
export type MvValuationApproach = "market" | "cost-modern" | "cost-reproduction";

/** فرع أسلوب التكلفة داخل الحوار (ليس السوق) */
export type MvCostSubApproach = Extract<MvValuationApproach, "cost-modern" | "cost-reproduction">;

export const MV_APPROACH_TOP: { id: "market" | "cost"; label: string; description: string }[] = [
  {
    id: "market",
    label: "أسلوب السوق",
    description: "المقارنات والقيمة السوقية — مراحل التنفيذ قيد الإعداد وستظهر لاحقاً تحت الصيانة حتى جاهزيتها.",
  },
  {
    id: "cost",
    label: "أسلوب التكلفة",
    description: "بعد الاختيار ستُحدد الطريقة: الأحلال الحديثة (جاهزة) أو إعادة الإنتاج (قيد الإعداد).",
  },
];

export const MV_COST_METHOD_CARDS: {
  id: MvCostSubApproach;
  label: string;
  description: string;
  ready: boolean;
}[] = [
  {
    id: "cost-modern",
    label: "الأحلال الحديثة",
    description: "خطوات التقييم مبنية — يمكنك المتابعة في نفس الصفحة.",
    ready: true,
  },
  {
    id: "cost-reproduction",
    label: "إعادة الإنتاج",
    description: "المراحل قيد الإعداد — يُعرض أدناه تحت الصيانة حتى اكتمال الخطة.",
    ready: false,
  },
];

export const MV_VALUATION_APPROACH_META: Record<
  MvValuationApproach,
  { label: string; description: string; banner: string; maintenance: boolean }
> = {
  market: {
    label: "أسلوب السوق",
    description: "تم اختيار أسلوب السوق.",
    banner: "الأسلوب الحالي: السوق",
    maintenance: true,
  },
  "cost-modern": {
    label: "التكلفة — طريقة الأحلال الحديثة",
    description: "خطوات الأحلال الحديثة والجدول المعتمد.",
    banner: "الأسلوب الحالي: التكلفة — طريقة الأحلال الحديثة",
    maintenance: false,
  },
  "cost-reproduction": {
    label: "التكلفة — إعادة الإنتاج",
    description: "تم اختيار إعادة الإنتاج.",
    banner: "الأسلوب الحالي: التكلفة — إعادة الإنتاج",
    maintenance: true,
  },
};

export function isMaintenanceApproach(a: MvValuationApproach | null): boolean {
  if (!a) return false;
  return MV_VALUATION_APPROACH_META[a].maintenance;
}

const APPROACH_STORAGE_PREFIX = "mv:valuation-approach:";
const WORK_ASSET_TYPE_PREFIX = "mv:valuation-work-asset-type:";

export function valuationApproachStorageKey(projectId: string) {
  return `${APPROACH_STORAGE_PREFIX}${projectId}`;
}

export function workAssetTypeStorageKey(projectId: string) {
  return `${WORK_ASSET_TYPE_PREFIX}${projectId}`;
}

export function readValuationApproach(projectId: string): MvValuationApproach | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(valuationApproachStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { approach?: string };
    if (
      parsed?.approach === "market" ||
      parsed?.approach === "cost-modern" ||
      parsed?.approach === "cost-reproduction"
    ) {
      return parsed.approach;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeValuationApproach(projectId: string, approach: MvValuationApproach) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    valuationApproachStorageKey(projectId),
    JSON.stringify({ approach }),
  );
}

export function clearValuationApproach(projectId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(valuationApproachStorageKey(projectId));
}

export function readWorkAssetType(projectId: string): SmartGridAssetType | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(workAssetTypeStorageKey(projectId));
  if (
    raw === "vehicles" ||
    raw === "machinery" ||
    raw === "electronics" ||
    raw === "furniture" ||
    raw === "other"
  ) {
    return raw;
  }
  return null;
}

export function writeWorkAssetType(projectId: string, assetType: SmartGridAssetType) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(workAssetTypeStorageKey(projectId), assetType);
}

export const MV_COST_MODERN_SUBSTEPS: { id: string; label: string }[] = [
  { id: "market-context", label: "تحديد / مراجعة سياق السوق للأصل" },
  { id: "useful-life", label: "العمر الافتراضي" },
  { id: "manufacture-purchase", label: "سنة الصنع وتاريخ الشراء" },
  { id: "effective-age", label: "العمر الحقيقي / الفعال" },
  { id: "new-price", label: "السعر الجديد" },
  { id: "extra-costs", label: "تكاليف إضافية" },
  { id: "replacement-scrap", label: "تكلفة الأحلال الحديثة — التخريد" },
  { id: "asset-condition", label: "حالة الأصول" },
  { id: "physical-depreciation-factor", label: "معامل الإهلاك المادي" },
  { id: "replacement-depreciated", label: "تكلفة الأحلال المهلكة" },
  { id: "functional-obsolescence", label: "معامل التقادم الوظيفي" },
  { id: "after-functional", label: "القيمة بعد خصم التقادم الوظيفي" },
  { id: "economic-obsolescence", label: "معامل التقادم الاقتصادي" },
  { id: "after-economic", label: "القيمة بعد خصم التقادم الاقتصادي" },
  { id: "scrap-adjustments", label: "ضباط الخردة" },
  { id: "liquidation-factor", label: "معامل التصفية" },
  { id: "after-liquidation", label: "القيمة بعد خصم معامل التصفية" },
  { id: "value-opinion", label: "رأي القيمة" },
];
