import EvaluationSourcePage from "../evaluation-source-page";
import ValueTechShell from "@/components/value-tech-shell";

const HARJ_EXCLUDED_TAG1 = ["قطع غيار وملحقات", "شاحنات ومعدات ثقيلة"];

export default function EvaluationSourceCarsPage() {
  return (
    <ValueTechShell>
      <EvaluationSourcePage
        tag0="حراج السيارات"
        excludeTag1Values={HARJ_EXCLUDED_TAG1}
        enableBrandFilter
        enableModelFilter
        enableModelYearFilter
        enableMileageFilter
        dataSources={["haraj", "yallamotor", "syarah"]}
        progressiveAdvancedFilters
        requireSearchClickToApplyFilters
        forceExactSearch
      />
    </ValueTechShell>
  );
}
