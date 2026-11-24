import test from "node:test";
import assert from "node:assert/strict";
import {
  applyReportDataModel,
  reportDataHasUserInput,
  reportDataNeedsModelMaterialization,
} from "../src/components/workspace/workspace-sections/machine-valuation/mv-report-data-model-apply";
import {
  createDefaultReportDataModel,
  normalizeReportDataModels,
  resolveProjectReportDataModel,
  type MvReportDataModel,
} from "../src/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";
import type { MvProjectReportData } from "../src/components/workspace/workspace-sections/machine-valuation/types";

const equipmentModel: MvReportDataModel = {
  id: "model-equipment",
  name: "نموذج المعدات",
  sections: [
    {
      id: "basic",
      title: "البيانات الأساسية",
      fields: [
        { id: "reportTitle", label: "عنوان التقرير", sourceKey: "reportTitle", type: "text", required: true, system: true },
        { id: "serial", label: "الرقم التسلسلي", sourceKey: "field:serial", type: "text", required: true },
      ],
    },
    {
      id: "machine",
      title: "بيانات الآلة",
      fields: [
        { id: "maker", label: "الشركة المصنعة", sourceKey: "field:maker", type: "text", required: false },
        { id: "year", label: "سنة الصنع", sourceKey: "field:year", type: "number", required: false },
      ],
    },
  ],
};

const vehiclesModel: MvReportDataModel = {
  id: "model-vehicles",
  name: "نموذج المركبات",
  sections: [
    {
      id: "vehicle",
      title: "بيانات المركبة",
      fields: [{ id: "plate", label: "رقم اللوحة", sourceKey: "field:plate", type: "text", required: true }],
    },
  ],
};

const companyModels = normalizeReportDataModels([createDefaultReportDataModel(), equipmentModel, vehiclesModel]);

/** Simulates the JSON round trip through the API (undefined keys vanish). */
const roundTrip = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function filledEquipmentReport(): MvProjectReportData {
  const applied = applyReportDataModel({ reportTitle: "تقرير خط الإنتاج" }, equipmentModel);
  return roundTrip({
    ...applied,
    customFields: (applied.customFields ?? []).map((field) => ({
      ...field,
      value: field.id === "serial" ? "SN-778" : field.id === "maker" ? "سيمنس" : field.id === "year" ? "2019" : "",
    })),
  });
}

const valueOf = (data: MvProjectReportData, id: string) => data.customFields?.find((field) => field.id === id)?.value;

test("the project stores its own copy of the model it was set up with", () => {
  const data = filledEquipmentReport();
  assert.equal(data.reportDataModelId, "model-equipment");
  assert.equal(data.reportDataModelSnapshot?.id, "model-equipment");
  assert.deepEqual(
    data.reportDataModelSnapshot?.sections.map((section) => section.id),
    ["basic", "machine"],
  );
  // Applying again changes nothing: no loop, no false "unsaved changes".
  assert.equal(reportDataNeedsModelMaterialization(data, equipmentModel), false);
});

test("deleting the company model never switches the report to another model nor drops its data", () => {
  const data = filledEquipmentReport();
  const afterDelete = normalizeReportDataModels([createDefaultReportDataModel(), vehiclesModel]);

  const resolved = resolveProjectReportDataModel(afterDelete, data);
  assert.ok(resolved);
  assert.equal(resolved.source, "snapshot");
  assert.equal(resolved.model.id, "model-equipment");
  assert.deepEqual(
    resolved.model.sections.flatMap((section) => section.fields.map((field) => field.label)),
    ["عنوان التقرير", "الرقم التسلسلي", "الشركة المصنعة", "سنة الصنع"],
  );
  // The page keeps the project exactly as it is.
  assert.equal(reportDataNeedsModelMaterialization(data, resolved.model), false);
  const kept = applyReportDataModel(data, resolved.model);
  assert.equal(kept.reportDataModelId, "model-equipment");
  assert.equal(valueOf(kept, "serial"), "SN-778");
  assert.equal(valueOf(kept, "maker"), "سيمنس");
  assert.equal(valueOf(kept, "year"), "2019");
  assert.deepEqual(kept.customSections?.map((section) => section.id), ["machine"]);
});

test("older projects without a saved copy are rebuilt from their own fields after the model is deleted", () => {
  const legacy = filledEquipmentReport();
  delete legacy.reportDataModelSnapshot;
  const afterDelete = normalizeReportDataModels([createDefaultReportDataModel()]);

  const resolved = resolveProjectReportDataModel(afterDelete, legacy);
  assert.ok(resolved);
  assert.equal(resolved.source, "recovered");
  assert.equal(resolved.model.id, "model-equipment");
  const labels = resolved.model.sections.flatMap((section) => section.fields.map((field) => field.label));
  for (const label of ["الرقم التسلسلي", "الشركة المصنعة", "سنة الصنع", "اسم العميل", "عنوان التقرير"]) {
    assert.ok(labels.includes(label), label);
  }
  const kept = applyReportDataModel(legacy, resolved.model);
  assert.equal(valueOf(kept, "serial"), "SN-778");
  assert.equal(valueOf(kept, "maker"), "سيمنس");
  assert.equal(kept.reportDataModelSnapshot?.id, "model-equipment");
  // Once the copy is stored the result is stable.
  assert.equal(reportDataNeedsModelMaterialization(roundTrip(kept), resolveProjectReportDataModel(afterDelete, roundTrip(kept))!.model), false);
});

test("a field removed from the company model keeps its value in the report", () => {
  const data = filledEquipmentReport();
  const edited: MvReportDataModel = {
    ...equipmentModel,
    sections: [
      equipmentModel.sections[0]!,
      { ...equipmentModel.sections[1]!, fields: [equipmentModel.sections[1]!.fields[1]!] }, // "maker" removed
    ],
  };
  assert.equal(reportDataNeedsModelMaterialization(data, edited), true);
  const next = roundTrip(applyReportDataModel(data, edited));
  const maker = next.customFields?.find((field) => field.id === "maker");
  assert.ok(maker, "the removed field still exists with its value");
  assert.equal(maker.value, "سيمنس");
  assert.equal(maker.modelId, undefined, "it became the project's own field");
  assert.equal(valueOf(next, "serial"), "SN-778");
  assert.equal(reportDataNeedsModelMaterialization(next, edited), false);
});

test("switching models deliberately keeps every value, and switching back restores the fields", () => {
  const data = filledEquipmentReport();
  const switched = roundTrip(applyReportDataModel(data, vehiclesModel));
  assert.equal(switched.reportDataModelId, "model-vehicles");
  assert.equal(valueOf(switched, "serial"), "SN-778");
  assert.equal(valueOf(switched, "maker"), "سيمنس");
  assert.equal(valueOf(switched, "year"), "2019");
  assert.ok(switched.customSections?.some((section) => section.id === "machine"), "section with values kept");
  assert.ok(switched.customSections?.some((section) => section.id === "vehicle"));

  const back = roundTrip(applyReportDataModel(switched, equipmentModel));
  assert.equal(back.reportDataModelId, "model-equipment");
  for (const id of ["serial", "maker", "year"]) {
    const field = back.customFields?.find((item) => item.id === id);
    assert.equal(field?.modelId, "model-equipment", id);
  }
  assert.equal(valueOf(back, "serial"), "SN-778");
  assert.equal(back.customFields?.filter((field) => field.id === "serial").length, 1, "no duplicates");
  // The empty vehicle field disappears; nothing else does.
  assert.equal(back.customFields?.some((field) => field.id === "plate"), false);
});

test("the model picker belongs to new projects only", () => {
  // A new project: only system-filled values (reference, definitions).
  assert.equal(
    reportDataHasUserInput({ reportReference: "MV-0001", assetSingularPlural: "أصل/أصول", standardsVersion: "IVS 2025" }),
    false,
  );
  assert.equal(reportDataHasUserInput({ reportTitle: "تقرير" }), true);
  assert.equal(reportDataHasUserInput({ finalValue: 0 }), true);
  assert.equal(
    reportDataHasUserInput({ customFields: [{ id: "a", sectionId: "basic", label: "x", type: "text", required: false }] }),
    true,
  );
  // A project that already chose a model is resolved without asking.
  assert.equal(resolveProjectReportDataModel(companyModels, filledEquipmentReport())?.source, "company");
  assert.equal(resolveProjectReportDataModel(companyModels, { reportReference: "MV-1" } as MvProjectReportData), null);
});

test("the system template keeps printing a field's value after its model is deleted or switched", async () => {
  const { resolveTemplateVariableValue } = await import("../src/components/system-template-summary-table");
  const context = (data: MvProjectReportData) => ({
    resolved: {},
    reportData: data as Record<string, unknown>,
    customFields: data.customFields ?? [],
  });
  const data = filledEquipmentReport();
  const afterDelete = normalizeReportDataModels([createDefaultReportDataModel()]);
  const kept = roundTrip(applyReportDataModel(data, resolveProjectReportDataModel(afterDelete, data)!.model));
  assert.equal(resolveTemplateVariableValue("field:maker", context(kept)), "سيمنس");
  assert.equal(resolveTemplateVariableValue("field:serial", context(kept)), "SN-778");
  const switched = roundTrip(applyReportDataModel(data, vehiclesModel));
  assert.equal(resolveTemplateVariableValue("field:maker", context(switched)), "سيمنس");
  // Values print as typed (a year is not grouped), like Word / PowerPoint.
  assert.equal(resolveTemplateVariableValue("field:year", context(kept)), "2019");
  assert.equal(resolveTemplateVariableValue("reportTitle", context(kept)), "تقرير خط الإنتاج");
});
