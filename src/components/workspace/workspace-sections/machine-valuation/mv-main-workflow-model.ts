/** خطوات المسار الرئيسي النشطة فقط — التسميات من getMainWorkflowSteps في mv-i18n/helpers */
export type MvMainWorkflowSlug = "import" | "asset-images";

export const MV_MAIN_WORKFLOW_SLUGS: readonly MvMainWorkflowSlug[] = ["import", "asset-images"];

export function isMvMainWorkflowSlug(value: string): value is MvMainWorkflowSlug {
  return (MV_MAIN_WORKFLOW_SLUGS as readonly string[]).includes(value);
}
