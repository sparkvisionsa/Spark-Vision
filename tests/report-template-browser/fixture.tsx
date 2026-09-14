import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CompanyReportDocumentTemplateDashboard, type CompanyReportDocumentTemplateForm } from "../../src/components/company-report-document-template-dashboard";
import { normalizeReportDataModels, getReportDataModel } from "../../src/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";
import { mergeTemplateVariableMappings, normalizeTemplateVariableKey } from "../../src/lib/report-template-bindings";
import { readReportTemplateUpload } from "../../src/lib/report-template-upload";

const models = normalizeReportDataModels([{ id: "equipment", name: "نموذج المعدات", sections: [{ id: "equipment", title: "المعدات", fields: [
  { id: "serial", sourceKey: "field:serial", label: "الرقم التسلسلي", type: "text" },
  { id: "basis", sourceKey: "valuationBasis", label: "أساس القيمة", type: "text" },
] }] }]);

function Fixture() {
  const format = new URLSearchParams(location.search).get("format") === "pptx" ? "pptx" : "word";
  const [templates, setTemplates] = useState<CompanyReportDocumentTemplateForm[]>(() => JSON.parse(localStorage.getItem(format) ?? "[]"));
  const [selected, setSelected] = useState(templates[0]?.id ?? "");
  const save = (items: CompanyReportDocumentTemplateForm[]) => {
    setTemplates(items);
    localStorage.setItem(format, JSON.stringify(items));
  };
  const upload = async (file: File, modelId: string) => {
    const { variables } = await readReportTemplateUpload(file, format);
    const next = {
      id: crypto.randomUUID(), name: file.name, fileName: file.name, fileUrl: "/fixture", uploadedAt: new Date().toISOString(),
      reportDataModelId: modelId, bookmarkNames: variables,
      variableMappings: mergeTemplateVariableMappings({ variables, model: getReportDataModel(models, modelId), previousMappings: [], previousDetected: new Set<string>(), nextDetected: new Set(variables.map(normalizeTemplateVariableKey)) }),
    };
    save([...templates, next]);
    setSelected(next.id);
    return true;
  };
  return <CompanyReportDocumentTemplateDashboard format={format} templates={templates} reportDataModels={models} selectedTemplateId={selected}
    onSelect={setSelected} onUploadNew={upload} onReplace={upload}
    onRename={() => {}} onRemove={() => {}} onSave={() => {}}
    onChange={(patch) => save(templates.map((item) => item.id === selected ? { ...item, ...patch } : item))} />;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
