import EvaluationSourcePage from "../evaluation-source-page";

const HARJ_EXCLUDED_TAG1 = ["قطع غيار وملحقات", "شاحنات ومعدات ثقيلة"];

export default function EvaluationSourceCarsPage() {
  return (
    <EvaluationSourcePage
      tag0="حراج السيارات"
      excludeTag1Values={HARJ_EXCLUDED_TAG1}
      enableBrandFilter
      enableModelFilter
      enableModelYearFilter
      dataSources={["haraj", "yallamotor"]}
      requireSearchClickToApplyFilters
    />
  );
}
