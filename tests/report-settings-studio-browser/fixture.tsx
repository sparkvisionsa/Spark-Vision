import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CompanyReportDataModelDashboard } from "../../src/components/company-report-data-model-dashboard";
import { CompanyReportDesignTabs } from "../../src/components/company-report-design-tabs";
import { CompanyReportLetterheadEditor, type CompanyLetterheadSettings } from "../../src/components/company-report-letterhead-editor";
import { CompanySystemTemplateLibrary } from "../../src/components/company-system-template-library";
import { createDefaultReportDataModel, type MvReportDataModel } from "../../src/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";
import type { MvCompanyReportSystemTemplateDefinition } from "../../src/components/workspace/workspace-sections/machine-valuation/types";

function Fixture() {
  const [models, setModels] = useState<MvReportDataModel[]>([createDefaultReportDataModel()]);
  const [letterhead, setLetterhead] = useState<CompanyLetterheadSettings>({ logoPosition: "right", showOnAllPages: true });
  const [systemTemplates, setSystemTemplates] = useState<MvCompanyReportSystemTemplateDefinition[]>([]);
  const [selectedSystemTemplateId, setSelectedSystemTemplateId] = useState("default-report-template");

  const panel = (title: string) => (
    <section data-testid={title} className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm font-black text-slate-700">
      {title}
    </section>
  );

  return (
    <main className="min-h-screen bg-[#f5f8fb] p-6">
      <CompanyReportDataModelDashboard
        models={models}
        dirty
        onChange={setModels}
        onSave={() => true}
        reportDesign={
          <CompanyReportDesignTabs
            systemTemplates={
              <CompanySystemTemplateLibrary
                templates={systemTemplates}
                reportDataModels={models}
                selectedTemplateId={selectedSystemTemplateId}
                officialPreview={<div className="mx-auto flex aspect-[210/297] w-32 items-center justify-center rounded bg-[#061b2d] text-[10px] font-black text-white">Value Tech</div>}
                companyData={{ companyName: "شركة فاليو تك للتقييم", commercialRegistration: "1010123456", managerName: "أحمد محمد", managerMembershipNo: "32145", reportTitle: "تقرير تقييم الآلات والمعدات", clientName: "شركة العميل الصناعية", reportReference: "VT-2026-001" }}
                onCommit={async (templates, templateId) => {
                  // Simulated server round-trip; `__failNextTemplateSave` makes the next save fail.
                  await new Promise((resolve) => setTimeout(resolve, 120));
                  const flags = window as unknown as { __failNextTemplateSave?: boolean; __savedTemplates?: unknown };
                  if (flags.__failNextTemplateSave) { flags.__failNextTemplateSave = false; return false; }
                  flags.__savedTemplates = { templates, templateId };
                  setSystemTemplates(templates);
                  setSelectedSystemTemplateId(templateId);
                  return true;
                }}
                onPreviewOfficial={() => undefined}
              />
            }
            reportSections={panel("أقسام وتعريفات التقرير")}
            companyLetterhead={
              <CompanyReportLetterheadEditor
                value={letterhead}
                companyName="شركة فاليو تك للتقييم"
                models={models}
                onChange={setLetterhead}
              />
            }
            wordTemplates={panel("قالب Word")}
            pptxTemplates={panel("قالب PowerPoint")}
          />
        }
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
