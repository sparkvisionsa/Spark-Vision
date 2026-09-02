import type { MvProjectWorkflowStatus } from "../types";
import type { MvSimpleReportStepId } from "../mv-simple-report-navigation";
import type { MvAssetType, MvWorkflowStepId } from "../mv-ui";
import { createMvT } from "./resolve";
import { mvTranslations } from "./translations";

export type MvT = ReturnType<typeof createMvT>;

export function getSimpleReportSteps(t: MvT) {
  return [
    { id: "report-data" as MvSimpleReportStepId, title: t("navigation.simpleReportSteps.reportData") },
    { id: "asset-images" as MvSimpleReportStepId, title: t("navigation.simpleReportSteps.assetImages") },
    { id: "valuation-actions" as MvSimpleReportStepId, title: t("navigation.simpleReportSteps.valuationActions") },
    { id: "client-files" as MvSimpleReportStepId, title: t("navigation.simpleReportSteps.clientFiles") },
    { id: "final-report" as MvSimpleReportStepId, title: t("navigation.simpleReportSteps.finalReport") },
  ];
}

export function getMainWorkflowSteps(t: MvT) {
  return [
    { slug: "import" as const, label: t("navigation.mainWorkflow.import"), shortLabel: t("navigation.mainWorkflow.importShort") },
    { slug: "asset-images" as const, label: t("navigation.mainWorkflow.assetImages"), shortLabel: t("navigation.mainWorkflow.assetImagesShort") },
  ];
}

export function getAdvancedWorkflowSteps(t: MvT) {
  const w = (key: string) => t(`navigation.advancedWorkflow.${key}`);
  return [
    { id: "import" as MvWorkflowStepId, label: w("import"), mobileLabel: w("import") },
    { id: "review" as MvWorkflowStepId, label: w("review"), mobileLabel: w("review") },
    { id: "classify" as MvWorkflowStepId, label: w("classify"), mobileLabel: w("classify") },
    { id: "market" as MvWorkflowStepId, label: w("market"), mobileLabel: w("market") },
    { id: "cost" as MvWorkflowStepId, label: w("cost"), mobileLabel: w("cost") },
    { id: "adjustments" as MvWorkflowStepId, label: w("adjustments"), mobileLabel: w("adjustments") },
    { id: "report" as MvWorkflowStepId, label: w("report"), mobileLabel: w("report") },
  ];
}

export function getAssetTypeMeta(t: MvT): Record<
  MvAssetType,
  { label: string; fill: string; text: string; border: string }
> {
  return {
    vehicles: {
      label: t("assetTypes.vehicles"),
      fill: "var(--asset-vehicles-fill)",
      text: "var(--asset-vehicles-text)",
      border: "var(--asset-vehicles-border)",
    },
    machinery: {
      label: t("assetTypes.machinery"),
      fill: "var(--asset-machinery-fill)",
      text: "var(--asset-machinery-text)",
      border: "var(--asset-machinery-border)",
    },
    electronics: {
      label: t("assetTypes.electronics"),
      fill: "var(--asset-electronics-fill)",
      text: "var(--asset-electronics-text)",
      border: "var(--asset-electronics-border)",
    },
    furniture: {
      label: t("assetTypes.furniture"),
      fill: "var(--asset-furniture-fill)",
      text: "var(--asset-furniture-text)",
      border: "var(--asset-furniture-border)",
    },
    other: {
      label: t("assetTypes.other"),
      fill: "var(--asset-other-fill)",
      text: "var(--asset-other-text)",
      border: "var(--asset-other-border)",
    },
  };
}

export function getWorkflowStatusOptions() {
  const ar = createMvT(mvTranslations.ar as Record<string, unknown>);
  const en = createMvT(mvTranslations.en as Record<string, unknown>);
  const rows: { value: MvProjectWorkflowStatus; labelAr: string; labelEn: string }[] = [
    { value: "new", labelAr: ar("status.workflow.new"), labelEn: en("status.workflow.new") },
    { value: "review", labelAr: ar("status.workflow.review"), labelEn: en("status.workflow.review") },
    { value: "approved", labelAr: ar("status.workflow.approved"), labelEn: en("status.workflow.approved") },
  ];
  return rows;
}

/** قراءة اللغة خارج مكوّن React (مثل عميل API). */
export function readMvLanguage(): "ar" | "en" {
  if (typeof window === "undefined") return "ar";
  try {
    return localStorage.getItem("spark-vision-lang") === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}
