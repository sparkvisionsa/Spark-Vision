import assert from "node:assert/strict";
import test from "node:test";
import {
  customFieldsForSection,
  isCustomFieldValueMissing,
  MV_REPORT_CUSTOM_FIELD_LIMIT,
  MV_REPORT_CUSTOM_LABEL_MAX_LENGTH,
  MV_REPORT_CUSTOM_SECTION_LIMIT,
  MV_REPORT_CUSTOM_VALUE_MAX_LENGTH,
  normalizeReportCustomFields,
  normalizeReportCustomSections,
} from "../src/components/workspace/workspace-sections/machine-valuation/mv-report-custom-fields";
import {
  MV_DEFAULT_REPORT_DATA_MODEL_ID,
  normalizeReportDataModels,
} from "../src/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";

test("custom report fields retain supported types and required-state semantics", () => {
  const fields = normalizeReportCustomFields([
    {
      id: "field-1",
      sectionId: "basic",
      label: " رقم العقد ",
      type: "number",
      required: true,
      value: "0",
    },
    {
      id: "field-2",
      sectionId: "client",
      label: "ملاحظة",
      type: "not-supported",
      required: false,
      value: "",
    },
    { id: "missing-label", sectionId: "basic", label: "" },
  ]);

  assert.deepEqual(fields, [
    {
      id: "field-1",
      sectionId: "basic",
      label: "رقم العقد",
      type: "number",
      required: true,
      value: "0",
    },
    {
      id: "field-2",
      sectionId: "client",
      label: "ملاحظة",
      type: "text",
      required: false,
      value: "",
    },
  ]);
  assert.equal(isCustomFieldValueMissing(fields[0]), false);
  assert.equal(isCustomFieldValueMissing(fields[1]), false);
  assert.equal(
    isCustomFieldValueMissing({ ...fields[0], value: "   " }),
    true,
  );
});

test("custom report fields and sections are constrained before persistence", () => {
  const longLabel = "ح".repeat(MV_REPORT_CUSTOM_LABEL_MAX_LENGTH + 20);
  const longValue = "ق".repeat(MV_REPORT_CUSTOM_VALUE_MAX_LENGTH + 20);
  const fields = normalizeReportCustomFields(
    Array.from({ length: MV_REPORT_CUSTOM_FIELD_LIMIT + 2 }, (_, index) => ({
      id: `field-${index}`,
      sectionId: "custom-section",
      label: longLabel,
      type: "textarea",
      required: index === 0,
      value: longValue,
    })),
  );
  const sections = normalizeReportCustomSections(
    Array.from({ length: MV_REPORT_CUSTOM_SECTION_LIMIT + 2 }, (_, index) => ({
      id: `section-${index}`,
      title: longLabel,
    })),
  );

  assert.equal(fields.length, MV_REPORT_CUSTOM_FIELD_LIMIT);
  assert.equal(fields[0]?.label.length, MV_REPORT_CUSTOM_LABEL_MAX_LENGTH);
  assert.equal(fields[0]?.value?.length, MV_REPORT_CUSTOM_VALUE_MAX_LENGTH);
  assert.equal(sections.length, MV_REPORT_CUSTOM_SECTION_LIMIT);
  assert.equal(sections[0]?.title.length, MV_REPORT_CUSTOM_LABEL_MAX_LENGTH);
});

test("fields stay assigned to their intended built-in or custom section", () => {
  const fields = normalizeReportCustomFields([
    { id: "basic", sectionId: "basic", label: "مرجع داخلي", type: "text" },
    { id: "extra", sectionId: "extra-section", label: "تفصيل إضافي", type: "date" },
  ]);

  assert.deepEqual(customFieldsForSection(fields, "basic").map((field) => field.id), ["basic"]);
  assert.deepEqual(customFieldsForSection(fields, "extra-section").map((field) => field.id), ["extra"]);
});

test("report-data models retain the default individual model and company fields", () => {
  const models = normalizeReportDataModels([
    {
      id: "equipment-model",
      name: "نموذج المعدات",
      sections: [
        {
          id: "equipment",
          title: "بيانات المعدات",
          fields: [
            {
              id: "equipment-serial",
              sourceKey: "field:equipment-serial",
              label: "الرقم التسلسلي",
              type: "text",
              required: true,
            },
          ],
        },
      ],
    },
  ]);

  assert.equal(models[0]?.id, MV_DEFAULT_REPORT_DATA_MODEL_ID);
  assert.equal(models[0]?.name, "نموذج فرد");
  assert.equal(models[1]?.sections[0]?.fields[0]?.sourceKey, "field:equipment-serial");
  assert.equal(models[1]?.sections[0]?.fields[0]?.required, true);
});
