import assert from "node:assert/strict";
import test from "node:test";
import { mergeExtractedFieldsIntoReportData } from "../src/components/workspace/workspace-sections/machine-valuation/mv-project-data-import";

test("appends extracted file data as the final editable report-data section", () => {
  let index = 0;
  const result = mergeExtractedFieldsIntoReportData(
    {
      reportTitle: "تقرير قائم",
      customSections: [{ id: "existing-section", title: "قسم قائم" }],
      customFields: [{ id: "existing-field", sectionId: "existing-section", label: "قيمة قائمة", type: "text", required: false, value: "محفوظة" }],
    },
    [
      { label: "رقم القضية", value: "4870385439", category: "document", section: "بيانات القضية" },
      { label: "الجهة", value: "وزارة العدل", category: "organization" },
      { label: "الجهة", value: "وكالة الوزارة للشؤون", category: "organization" },
    ],
    "البيانات المستوردة من الملفات",
    prefix => `${prefix}-${++index}`,
  );

  assert.equal(result.importedCount, 3);
  assert.equal(result.reportData.reportTitle, "تقرير قائم");
  assert.deepEqual(result.reportData.customSections?.map(section => section.title), ["قسم قائم", "البيانات المستوردة من الملفات"]);
  assert.equal(result.reportData.customFields?.[0]?.value, "محفوظة");
  assert.deepEqual(result.reportData.customFields?.slice(1).map(field => field.label), ["رقم القضية", "الجهة (1)", "الجهة (2)"]);
  assert.equal(result.reportData.customFields?.every(field => field.modelId == null), true);
});

