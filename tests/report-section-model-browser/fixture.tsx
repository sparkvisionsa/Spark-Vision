import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CompanyReportSectionModelDashboard } from "../../src/components/company-report-section-model-dashboard";
import type { MvCompanyReportSectionModel } from "../../src/components/workspace/workspace-sections/machine-valuation/types";

const initialModels: MvCompanyReportSectionModel[] = [
  {
    id: "model-1",
    name: "نموذج اختبار",
    isDefault: true,
    visibleInReport: true,
    sections: [
      {
        id: "section-1",
        sectionNumber: "1",
        title: "القسم الأول",
        visibleInReport: true,
        items: [
          { id: "item-1", title: "البند الأول", body: "نص البند الأول", visibleInReport: true },
        ],
      },
      {
        id: "section-2",
        sectionNumber: "2",
        title: "القسم الثاني",
        visibleInReport: true,
        items: [
          { id: "item-2", title: "البند الثاني", body: "نص البند الثاني", visibleInReport: true },
        ],
      },
    ],
  },
];

function Fixture() {
  const [models, setModels] = useState(initialModels);
  const [saved, setSaved] = useState<MvCompanyReportSectionModel[] | null>(null);

  return (
    <main className="min-h-screen bg-slate-100 p-6" dir="rtl">
      <CompanyReportSectionModelDashboard
        models={models}
        onChange={setModels}
        onSave={async () => {
          setSaved(models);
          return true;
        }}
      />
      <output data-testid="saved-models">{saved ? JSON.stringify(saved) : ""}</output>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
