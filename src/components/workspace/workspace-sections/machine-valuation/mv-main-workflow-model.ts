import type { MvWorkflowStepId } from "./mv-ui";

/** خطوات المسار الرئيسي (صفحة كاملة لكل خطوة، وليست أقساماً في صفحة واحدة) */
export type MvMainWorkflowSlug =
  | "import"
  | "process"
  | "asset-images"
  | "images"
  | "valuation";

export const MV_MAIN_WORKFLOW_STEPS: {
  slug: MvMainWorkflowSlug;
  label: string;
  shortLabel: string;
}[] = [
  { slug: "import", label: "استيراد البيانات", shortLabel: "الاستيراد" },
  { slug: "process", label: "معالجة ومراجعة البيانات", shortLabel: "المعالجة" },
  { slug: "asset-images", label: "تحديد صور الأصول", shortLabel: "صور الأصول" },
  { slug: "images", label: "مراجعة الصور", shortLabel: "الصور" },
  { slug: "valuation", label: "التقييم", shortLabel: "التقييم" },
];

export function isMvMainWorkflowSlug(value: string): value is MvMainWorkflowSlug {
  return MV_MAIN_WORKFLOW_STEPS.some((s) => s.slug === value);
}

export function parseMainWorkflowSlug(segment: string | undefined): MvMainWorkflowSlug {
  if (segment && isMvMainWorkflowSlug(segment)) return segment;
  return "import";
}

/** ربط خطوة المسار الرئيسي بقسم مساحة الأصول الحالية (حتى اكتمال فصل الواجهات) */
export function mainWorkflowSlugToAssetSection(
  slug: MvMainWorkflowSlug,
): MvWorkflowStepId | null {
  if (slug === "import") return "import";
  if (slug === "process") return "review";
  return null;
}

export function mainWorkflowStepIndex(slug: MvMainWorkflowSlug): number {
  return MV_MAIN_WORKFLOW_STEPS.findIndex((s) => s.slug === slug);
}

export function nextMainWorkflowSlug(slug: MvMainWorkflowSlug): MvMainWorkflowSlug | null {
  const i = mainWorkflowStepIndex(slug);
  if (i < 0 || i >= MV_MAIN_WORKFLOW_STEPS.length - 1) return null;
  return MV_MAIN_WORKFLOW_STEPS[i + 1]!.slug;
}
