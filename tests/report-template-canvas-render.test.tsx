import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MvReportPageShell } from "../src/components/workspace/workspace-sections/machine-valuation/mv-report-page-shell";
import { defaultSystemTemplateCanvasElements, formatTemplateReportDate } from "../src/components/system-report-template-canvas";
import type { MvCompanyReportSystemTemplateDefinition } from "../src/components/workspace/workspace-sections/machine-valuation/types";

const template: MvCompanyReportSystemTemplateDefinition = {
  id: "system-template-canvas-test",
  name: "Canvas test",
  colors: {
    primary: "#0C447C",
    secondary: "#061B2D",
    accent: "#C9A227",
    coverText: "#FFFFFF",
    text: "#0F172A",
    mutedText: "#475569",
    pageBackground: "#FFFFFF",
    headerBackground: "#FFFFFF",
    footerBackground: "#F8FAFC",
  },
  typography: {
    fontFamily: "Arial, sans-serif",
    headingFontFamily: "Arial, sans-serif",
    baseFontSize: 12,
    headingScale: 1,
    lineHeight: 1.6,
    fontWeight: 500,
  },
  assets: {},
  layout: {
    backgroundFit: "cover",
    contentAlign: "center",
    logoPosition: "right",
    pageMarginMm: 12,
    headerHeightMm: 20,
    footerHeightMm: 15,
    coverOverlayOpacity: 0.2,
    borderRadiusPx: 0,
    showHeader: true,
    showFooter: true,
    showLogo: true,
    showWatermark: false,
  },
  canvasElements: [
    {
      id: "cover-free-text",
      name: "Free text",
      page: "cover",
      kind: "text",
      text: "نص حر محفوظ",
      x: 17.5,
      y: 21,
      width: 45,
      height: 8,
      rotation: 3,
      zIndex: 10,
      opacity: 0.8,
      color: "#FFFFFF",
      fontSize: 19,
      fontWeight: 700,
      textAlign: "center",
    },
    {
      id: "cover-report-content",
      name: "Report content",
      page: "cover",
      kind: "binding",
      binding: "reportContent",
      x: 10,
      y: 40,
      width: 80,
      height: 30,
      rotation: 0,
      zIndex: 20,
      opacity: 1,
    },
    {
      id: "cover-report-title",
      name: "Report title",
      page: "cover",
      kind: "binding",
      binding: "reportTitle",
      x: 10,
      y: 32,
      width: 80,
      height: 8,
      rotation: 0,
      zIndex: 30,
      opacity: 1,
    },
    {
      id: "cover-client-name",
      name: "Client name",
      page: "cover",
      kind: "binding",
      binding: "clientName",
      x: 10,
      y: 70,
      width: 80,
      height: 6,
      rotation: 0,
      zIndex: 30,
      opacity: 1,
    },
    {
      id: "interior-report-content",
      name: "Interior content",
      page: "interior",
      kind: "binding",
      binding: "reportContent",
      x: 8,
      y: 14,
      width: 84,
      height: 70,
      rotation: 0,
      zIndex: 20,
      opacity: 1,
    },
  ],
};

const letterheadTemplate = {
  templateId: template.id,
  outputFormat: "pdf" as const,
  customTemplates: [template],
};

test("default header and footer fields use readable font sizes", () => {
  const elements = defaultSystemTemplateCanvasElements();
  const interiorCompanyName = elements.find((element) => element.id === "interior-company-name");
  const footerFields = elements.filter((element) => element.id.includes("-footer-") || element.id === "closing-footer");

  assert.equal(interiorCompanyName?.fontSize, 18);
  assert.ok(footerFields.length > 0);
  assert.equal(footerFields.every((element) => (element.fontSize ?? 0) >= 14), true);
});

test("free canvas elements render at their saved coordinates on the real report cover", () => {
  const html = renderToStaticMarkup(
    <MvReportPageShell
      variant="cover"
      companyName="شركة الاختبار"
      reportTitle="عنوان تقرير ديناميكي"
      clientName="شركة العميل"
      logoSrc={null}
      footerLines={["بيانات التذييل"]}
      letterheadTemplate={letterheadTemplate}
    >
      <div data-test-report-content>عنوان التقرير الحقيقي</div>
    </MvReportPageShell>,
  );

  assert.match(html, /data-mv-template-element-layer/);
  assert.match(html, /data-mv-template-element="cover-free-text"/);
  assert.match(html, /left:17\.5%/);
  assert.match(html, /transform:rotate\(3deg\)/);
  assert.match(html, /نص حر محفوظ/);
  assert.match(html, /عنوان التقرير الحقيقي/);
  assert.match(html, /عنوان تقرير ديناميكي/);
  assert.match(html, /شركة العميل/);
});

test("an interior content binding replaces the fixed flow visually and receives real page content", () => {
  const html = renderToStaticMarkup(
    <MvReportPageShell
      variant="interior"
      companyName="شركة الاختبار"
      logoSrc={null}
      footerLines={["بيانات التذييل"]}
      letterheadTemplate={letterheadTemplate}
    >
      <section data-test-interior-content>محتوى الصفحة الداخلي الحقيقي</section>
    </MvReportPageShell>,
  );

  assert.match(html, /data-mv-template-element="interior-report-content"/);
  assert.match(html, /left:8%/);
  assert.match(html, /top:14%/);
  assert.match(html, /invisible/);
  assert.match(html, /محتوى الصفحة الداخلي الحقيقي/);
});

test("the paginator frame matches the custom template frame the sheet renders with", async () => {
  const { resolveReportInteriorFrameMm, getReportInteriorBodyMaxPx, REPORT_INTERIOR_FRAME_MM } = await import(
    "../src/components/workspace/workspace-sections/machine-valuation/mv-report-page-metrics"
  );
  assert.deepEqual(resolveReportInteriorFrameMm("portrait", null), REPORT_INTERIOR_FRAME_MM.portrait);
  const frame = resolveReportInteriorFrameMm("portrait", template);
  assert.deepEqual(frame, { paddingInline: 12, header: 20, footer: 15, bodyPaddingTop: 4, bodyPaddingBottom: 4 });
  // A smaller custom header/footer must give the body more room than the default frame.
  assert.ok(getReportInteriorBodyMaxPx("portrait", frame) > getReportInteriorBodyMaxPx("portrait"));
  const hidden = resolveReportInteriorFrameMm("portrait", { layout: { ...template.layout, showHeader: false, showFooter: false } });
  assert.equal(hidden.header, 0);
  assert.equal(hidden.footer, 0);

  const html = renderToStaticMarkup(
    <MvReportPageShell
      variant="interior"
      companyName="شركة الاختبار"
      logoSrc={null}
      footerLines={["بيانات التذييل"]}
      letterheadTemplate={letterheadTemplate}
    >
      <p>محتوى</p>
    </MvReportPageShell>,
  );
  assert.match(html, /height:20mm/);
  assert.match(html, /height:15mm/);
  assert.match(html, /padding-inline:12mm/);
});

test("closing page uses its own colours and text sizes stay physical on landscape sheets", () => {
  const closingTemplate = {
    ...template,
    colors: { ...template.colors, closingPrimary: "#7A1E2C", closingSecondary: "#3A0B14", closingText: "#FFEEDD" },
    layout: { ...template.layout, closingColorMode: "solid" as const },
  };
  const html = renderToStaticMarkup(
    <MvReportPageShell
      variant="cover"
      coverArtwork="closing"
      companyName="شركة الاختبار"
      logoSrc={null}
      footerLines={[]}
      letterheadTemplate={{ templateId: closingTemplate.id, outputFormat: "pdf", customTemplates: [closingTemplate] }}
    >
      <p>شكراً</p>
    </MvReportPageShell>,
  );
  assert.match(html, /background:#7A1E2C/);
  assert.match(html, /color:#FFEEDD/);

  const coverHtml = renderToStaticMarkup(
    <MvReportPageShell variant="cover" companyName="ش" logoSrc={null} footerLines={[]} letterheadTemplate={letterheadTemplate}>
      <p>x</p>
    </MvReportPageShell>,
  );
  assert.match(coverHtml, /font-size:[0-9.]+cqmin/);
  assert.match(coverHtml, /container-type:size/);
});

test("cover bar shows the report reference and the report date as yyyy/mm/dd م", () => {
  assert.equal(formatTemplateReportDate("02/08/2026م"), "2026/08/02 م");
  assert.equal(formatTemplateReportDate("2026-08-02"), "2026/08/02 م");
  assert.equal(formatTemplateReportDate("٠٢/٠٨/٢٠٢٦"), "2026/08/02 م");
  assert.equal(formatTemplateReportDate("1448/02/08 هـ"), "1448/02/08 هـ");
  assert.equal(formatTemplateReportDate("—"), undefined);

  const coverBindings = defaultSystemTemplateCanvasElements()
    .filter((element) => element.page === "cover" && element.id.includes("-footer-"))
    .map((element) => element.binding);
  assert.ok(coverBindings.includes("reportReference"));
  assert.ok(coverBindings.includes("reportDate"));

  const html = renderToStaticMarkup(
    <MvReportPageShell
      variant="cover"
      companyName="شركة الاختبار"
      reportReference="VT-2026-001"
      reportDate="02/08/2026م"
      logoSrc={null}
      footerLines={[]}
      letterheadTemplate={{ templateId: "custom-date", outputFormat: "pdf", customTemplates: [{ ...template, id: "custom-date", canvasElements: defaultSystemTemplateCanvasElements() }] }}
    >
      <p>غلاف</p>
    </MvReportPageShell>,
  );
  assert.match(html, /الرقم المرجعي: <bdi dir="ltr" class="whitespace-nowrap">VT-2026-001<\/bdi>/);
  assert.match(html, /تاريخ التقرير <span class="whitespace-nowrap"><bdi dir="ltr">2026\/08\/02<\/bdi> م<\/span>/);
});

test("executive-summary table: catalog, normalization and values from the project", async () => {
  const summary = await import("../src/components/system-template-summary-table");
  const { createDefaultReportDataModel } = await import("../src/components/workspace/workspace-sections/machine-valuation/mv-report-data-models");
  const { renderReportModelFlowSection } = await import("../src/components/workspace/workspace-sections/machine-valuation/mv-valuation-report-document-body");

  const model = createDefaultReportDataModel();
  model.sections[0]!.fields.push({ id: "custom-1", label: "رقم الصك", sourceKey: "field:custom-1", type: "text", required: false });
  const catalog = summary.buildSummaryFieldCatalog([model]);
  const keys = catalog[0]!.fields.map((field) => field.sourceKey);
  assert.ok(keys.includes("clientName"));
  assert.ok(keys.includes("valuationDate"));
  assert.ok(keys.includes("field:custom-1"));

  const table = summary.normalizeSummaryTable({
    enabled: true,
    title: " الملخص ",
    labelColumnPct: 95,
    fields: [
      { id: "a", sourceKey: "clientName", label: "العميل" },
      { id: "b", sourceKey: "valuationDate", label: "تاريخ التقييم", type: "date" },
      { id: "c", sourceKey: "field:custom-1", label: "رقم الصك" },
      { id: "d", sourceKey: "finalValue", label: "القيمة", type: "number" },
      { id: "e", sourceKey: "valuationPurpose", label: "الغرض" },
      { id: "a", sourceKey: "duplicate", label: "مكرر" },
      { id: "x", sourceKey: "", label: "بلا مصدر" },
    ],
  });
  assert.ok(table && summary.hasActiveSummaryTable(table));
  assert.equal(table.title, "الملخص");
  assert.equal(table.labelColumnPct, 70);
  assert.deepEqual(table.fields.map((field) => field.id), ["a", "b", "c", "d", "e"]);
  assert.equal(summary.hasActiveSummaryTable({ enabled: true, fields: [] }), false);
  assert.equal(summary.hasActiveSummaryTable({ ...table, enabled: false }), false);

  const ctx = {
    resolved: { clientName: "شركة العميل الصناعية", finalValue: "3,545,000 ر.س" },
    reportData: { valuationDate: "2026-08-02", valuationPurpose: "  " },
    customFields: [{ id: "custom-1", value: "4010101" }],
  };
  const values = table.fields.map((field) => summary.resolveSummaryFieldValue(field, ctx));
  assert.deepEqual(values, ["شركة العميل الصناعية", "2026/08/02 م", "4010101", "3,545,000 ر.س", ""]);

  const rows = table.fields.map((field, index) => ({ id: field.id, label: field.label, value: values[index] }));
  const html = renderToStaticMarkup(
    renderReportModelFlowSection({
      id: "s", anchor: "mv-toc-24", sectionNumber: "3", title: "الملخص التنفيذي",
      items: [{ id: "i", anchor: "i", title: "نص", body: "الرأي النهائي للقيمة." }],
      lead: <summary.SystemTemplateSummaryTable table={table} rows={rows} />,
    }),
  );
  assert.match(html, /data-mv-summary-table/);
  assert.match(html, /<col style="width:70%"\/>/);
  assert.match(html, /<th colSpan="2"[^>]*>الملخص<\/th>/);
  assert.match(html, /<th scope="row"[^>]*>العميل<\/th><td[^>]*>شركة العميل الصناعية<\/td>/);
  assert.match(html, /<th scope="row"[^>]*>الغرض<\/th><td[^>]*>—<\/td>/);
  // The table sits under the section heading, before the section text.
  assert.ok(html.indexOf("data-mv-summary-table") > html.indexOf("الملخص التنفيذي"));
  assert.ok(html.indexOf("data-mv-summary-table") < html.indexOf("الرأي النهائي للقيمة."));
});

test("template variables: catalog, interpolation, custom table values and report rendering", async () => {
  const variables = await import("../src/components/system-template-variables");
  const summary = await import("../src/components/system-template-summary-table");
  const { createDefaultReportDataModel } = await import("../src/components/workspace/workspace-sections/machine-valuation/mv-report-data-models");

  const model = createDefaultReportDataModel();
  model.sections[1]!.fields.push({ id: "deed", label: "رقم الصك", sourceKey: "field:deed", type: "text", required: false });
  const catalog = variables.buildTemplateVariableCatalog([model]);
  const keys = catalog.map((option) => option.key);
  assert.ok(keys.includes("companyName"));
  assert.ok(keys.includes("clientName"));
  assert.ok(keys.includes("field:deed"));
  assert.equal(new Set(keys).size, keys.length);

  const ctx = {
    resolved: { clientName: "شركة العميل", companyName: "شركة التقييم" },
    reportData: { valuationDate: "2026-08-02", valuationPurpose: "التمويل" },
    customFields: [{ id: "deed", value: "4010101" }],
  };
  const resolve = (key: string) => summary.resolveTemplateVariableValue(key, ctx);
  assert.equal(variables.interpolateTemplateText("العميل: {{clientName}} | الصك {{ field:deed }} | {{valuationDate}} | {{unknown}}.", resolve), "العميل: شركة العميل | الصك 4010101 | 2026/08/02 م | .");
  assert.equal(variables.hasTemplateVariables("بدون متغيرات"), false);
  assert.equal(variables.hasTemplateVariables("{{clientName}}"), true);

  // Row with its own value (variables inside) and a fully custom row.
  assert.equal(summary.resolveSummaryFieldValue({ id: "r1", sourceKey: "valuationPurpose", label: "الغرض", valueTemplate: "{{valuationPurpose}} لصالح {{clientName}}" }, ctx), "التمويل لصالح شركة العميل");
  assert.equal(summary.resolveSummaryFieldValue({ id: "r2", sourceKey: summary.SUMMARY_CUSTOM_ROW_KEY, label: "بند", valueTemplate: "ثابت" }, ctx), "ثابت");
  assert.equal(summary.resolveSummaryFieldValue({ id: "r3", sourceKey: summary.SUMMARY_CUSTOM_ROW_KEY, label: "بند" }, ctx), "");
  const normalized = summary.normalizeSummaryTable({ enabled: true, fields: [{ id: "r2", sourceKey: "custom", label: "بند", valueTemplate: "{{clientName}}" }] });
  assert.equal(normalized?.fields[0]?.valueTemplate, "{{clientName}}");

  // A text element with variables on a real report page.
  const withVariables = {
    ...template,
    id: "custom-vars",
    canvasElements: [{
      id: "cover-variable-text", name: "نص بمتغير", page: "cover" as const, kind: "text" as const,
      text: "مقدم إلى {{clientName}} — {{valuationDate}}", x: 10, y: 70, width: 80, height: 6, rotation: 0, zIndex: 40, opacity: 1,
    }],
  };
  const html = renderToStaticMarkup(
    <variables.TemplateVariablesProvider resolve={resolve}>
      <MvReportPageShell variant="cover" companyName="شركة التقييم" logoSrc={null} footerLines={[]} letterheadTemplate={{ templateId: "custom-vars", outputFormat: "pdf", customTemplates: [withVariables] }}>
        <p>غلاف</p>
      </MvReportPageShell>
    </variables.TemplateVariablesProvider>,
  );
  assert.match(html, /مقدم إلى شركة العميل — 2026\/08\/02 م/);
  assert.doesNotMatch(html, /\{\{clientName\}\}/);
});
