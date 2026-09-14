import assert from "node:assert/strict";
import test from "node:test";
import PizZip from "pizzip";
import { buildSuggestedTemplateVariables, suggestedTemplateBinding, mergeTemplateVariableMappings, normalizeTemplateVariableKey } from "../src/lib/report-template-bindings";
import { readReportTemplateUpload } from "../src/lib/report-template-upload";
import { createDefaultReportDataModel, type MvReportDataModel } from "../src/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";

const individual = createDefaultReportDataModel();
const custom: MvReportDataModel = {
  id: "equipment", name: "نموذج المعدات", sections: [{ id: "equipment", title: "المعدات", fields: [
    { id: "serial", sourceKey: "field:serial", label: "الرقم التسلسلي", type: "text", required: false },
    { id: "note1", sourceKey: "field:note1", label: "ملاحظة", type: "text", required: false },
    { id: "note2", sourceKey: "field:note2", label: "ملاحظة", type: "text", required: false },
  ] }],
};

test("every field has a copyable variable that resolves to the same source", () => {
  for (const model of [individual, custom]) {
    const suggestions = buildSuggestedTemplateVariables(model);
    assert.equal(suggestions.length, model.sections.flatMap((s) => s.fields).length);
    assert.equal(new Set(suggestions.map((s) => s.variable)).size, suggestions.length);
    for (const suggestion of suggestions) {
      assert.ok(suggestion.variable.length <= 120);
      assert.match(suggestion.variable, /^[\p{L}\p{N}_]+$/u);
      assert.equal(suggestedTemplateBinding(suggestion.variable, model), suggestion.sourceKey);
    }
  }
  assert.equal(buildSuggestedTemplateVariables(individual).find((s) => s.sourceKey === "valuationBasis")?.variable, "اساس_القيمة");
  assert.equal(suggestedTemplateBinding("أَساس القيمة", individual), "valuationBasis");
  assert.equal(suggestedTemplateBinding("ملاحظة", custom), "");
  assert.equal(suggestedTemplateBinding("متغير_غير_معروف", individual), "");
  assert.equal(suggestedTemplateBinding("الرقم_التسلسلي", individual), "");
});

test("duplicate labels and labels matching generated suffixes stay unambiguous", () => {
  const model = structuredClone(custom);
  model.sections[0].fields.push({ id: "note3", sourceKey: "field:note3", label: "ملاحظة field note1", type: "text", required: false });
  const suggestions = buildSuggestedTemplateVariables(model);
  for (const item of suggestions) assert.equal(suggestedTemplateBinding(item.variable, model), item.sourceKey);
});

test("only uploaded variables are seeded and replacement preserves intentional bindings", () => {
  const variables = ["اساس_القيمة", "الرقم_التسلسلي", "متغير_خاص"];
  const opts = { variables, model: custom, previousDetected: new Set<string>(), nextDetected: new Set(variables.map(normalizeTemplateVariableKey)) };
  const mappings = mergeTemplateVariableMappings({ ...opts, previousMappings: [] });
  assert.deepEqual(mappings.map((m) => [m.variable, m.sourceKey]), [["اساس_القيمة", "valuationBasis"], ["الرقم_التسلسلي", "field:serial"]]);
  const replaced = mergeTemplateVariableMappings({ ...opts, previousDetected: new Set(["اساس_القيمة", "removed"]), previousMappings: [
    { id: "edited", variable: "اساس_القيمة", sourceKey: "static", staticValue: "قيمة محفوظة" },
    { id: "unbound", variable: "الرقم_التسلسلي", sourceKey: "" },
    { id: "removed", variable: "removed", sourceKey: "clientName" },
  ] });
  assert.deepEqual(replaced.map((m) => m.id), ["edited", "unbound"]);
  assert.equal(replaced[0].staticValue, "قيمة محفوظة");
});

function templateFile(format: "word" | "pptx", content: string, extra = "") {
  const zip = new PizZip();
  if (format === "word") {
    zip.file("word/document.xml", `<w:document><w:body><w:p>${content}</w:p>${extra}</w:body></w:document>`);
  } else {
    zip.file("ppt/presentation.xml", "<p:presentation/>");
    zip.file("ppt/slides/slide1.xml", `<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p>${content}</a:p></p:txBody></p:sp>${extra}</p:spTree></p:cSld></p:sld>`);
  }
  return new File([new Uint8Array(zip.generate({ type: "uint8array" })).buffer], `template.${format === "word" ? "docx" : "pptx"}`);
}

for (const format of ["word", "pptx"] as const) {
  const run = (text: string) => format === "word" ? `<w:r><w:t>${text}</w:t></w:r>` : `<a:r><a:t>${text}</a:t></a:r>`;
  test(`${format}: reads variables split across formatted runs and leaves unknown variables available`, async () => {
    const { variables } = await readReportTemplateUpload(templateFile(format, run("&lt;&lt;اساس_") + run("القيمة&gt;&gt;") + run(" «متغير_خاص» ") + run("&lt;&lt;اساس_القيمة&gt;&gt;")), format);
    assert.deepEqual(variables, ["اساس_القيمة", "متغير_خاص"]);
  });
  test(`${format}: distinguishes empty, missing variables, and corrupt documents`, async () => {
    const extension = format === "word" ? "docx" : "pptx";
    await assert.rejects(readReportTemplateUpload(new File([], `empty.${extension}`), format), /فارغ/);
    await assert.rejects(readReportTemplateUpload(templateFile(format, ""), format), /فارغ/);
    await assert.rejects(readReportTemplateUpload(templateFile(format, run("تقرير بدون متغيرات")), format), /لم نعثر على متغيرات.*<<اساس_القيمة>>/);
    await assert.rejects(readReportTemplateUpload(templateFile(format, "", format === "word" ? "<w:drawing/>" : "<p:pic/>"), format), /لم نعثر على متغيرات/);
    await assert.rejects(readReportTemplateUpload(new File(["broken"], `broken.${extension}`), format), /تعذر قراءة/);
  });
}

test("PowerPoint image variables do not appear a second time with delimiters", async () => {
  const result = await readReportTemplateUpload(templateFile("pptx", "<a:r><a:t>&lt;&lt;صور_الأصول&gt;&gt;</a:t></a:r>"), "pptx");
  assert.deepEqual(result.variables, ["صور_الأصول"]);
});
