import EvaluationSourcePage from "../evaluation-source-page";

export default function EvaluationSourceCarsPage() {
  return (
    <EvaluationSourcePage
      tag0="حراج السيارات"
      enableBrandFilter
      enableModelFilter
      enableModelYearFilter
      dataSources={["haraj", "yallamotor"]}
    />
  );
}
