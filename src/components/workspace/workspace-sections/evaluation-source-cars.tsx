import EvaluationSourcePage from "@/app/evaluation-source/evaluation-source-page";

/** يُستبعد فقط قطع الغيار؛ شاحنات ومعدات ثقيلة تظهر ضمن حراج السيارات. */
const HARJ_EXCLUDED_TAG1 = ["قطع غيار وملحقات"];

export default function EvaluationSourceCarsSection() {
  return (
    <EvaluationSourcePage
      tag0="حراج السيارات"
      excludeTag1Values={HARJ_EXCLUDED_TAG1}
      enableBrandFilter
      enableModelFilter
      enableModelYearFilter
      enableMileageFilter
      dataSources={["haraj", "mobasher"]}
      useCarsIndDatabase
      progressiveAdvancedFilters
      requireSearchClickToApplyFilters
      broadDocumentSearch
    />
  );
}
