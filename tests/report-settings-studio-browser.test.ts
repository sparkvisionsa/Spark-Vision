import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { build, type Plugin } from "esbuild";
import { chromium, expect, type Locator } from "@playwright/test";
import postcss from "postcss";
import tailwind from "tailwindcss";
import tailwindConfig from "../tailwind.config";

const browserStubPlugin: Plugin = {
  name: "report-settings-browser-stubs",
  setup(buildApi) {
    buildApi.onResolve({ filter: /mv-report-data-model-file-section-dialog$/ }, () => ({ path: "file-section-dialog", namespace: "stub" }));
    buildApi.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export function MvReportDataModelFileSectionDialog(){ return null }", loader: "js" }));
  },
};

async function relativeBox(locator: Locator, frame: Locator) {
  const box = await locator.boundingBox();
  const outer = await frame.boundingBox();
  assert.ok(box && outer);
  return { x: (box.x - outer.x) / outer.width, y: (box.y - outer.y) / outer.height, w: box.width / outer.width };
}

async function leftOf(locator: Locator) {
  return locator.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));
}

test("final report settings use the unified reference studio and expose every design tab", { timeout: 180_000 }, async () => {
  const bundle = await build({ entryPoints: ["tests/report-settings-studio-browser/fixture.tsx"], bundle: true, write: false, jsx: "automatic", platform: "browser", define: { process: JSON.stringify({ env: { NODE_ENV: "test" } }) }, plugins: [browserStubPlugin] });
  const css = await postcss([tailwind({ ...tailwindConfig, content: ["tests/report-settings-studio-browser/fixture.tsx", "src/components/company-report-data-model-dashboard.tsx", "src/components/company-report-design-tabs.tsx", "src/components/company-report-letterhead-editor.tsx", "src/components/company-system-template-library.tsx", "src/components/system-report-template-canvas.tsx", "src/components/system-template-report-preview.tsx", "src/components/workspace/workspace-sections/machine-valuation/mv-report-page-shell.tsx", "src/components/ui/*.tsx"] })])
    .process(await readFile("src/app/globals.css", "utf8"), { from: "src/app/globals.css" });
  const server = createServer((request, response) => {
    if (request.url === "/app.css") { response.setHeader("Content-Type", "text/css; charset=utf-8"); response.end(css.css); return; }
    const javascript = request.url?.startsWith("/app.js");
    response.setHeader("Content-Type", javascript ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8");
    response.end(javascript ? bundle.outputFiles[0].contents : '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.waitForTimeout(300);
    assert.deepEqual(pageErrors, []);
    await expect(page.getByText("نماذج التقارير", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /تصميم النموذج/ })).toBeVisible();
    await page.screenshot({ path: "test-results/report-settings-studio/model-design.png", fullPage: true });

    await page.getByRole("button", { name: /تصميم التقرير/ }).click();
    await expect(page.getByRole("tab", { name: "قوالب النظام", exact: true })).toBeVisible();
    await expect(page.getByText("Value Tech الرسمي", { exact: true })).toBeVisible();
    const newTemplateButton = page.getByRole("button", { name: "قالب جديد", exact: true }).first();
    await expect(newTemplateButton).toBeVisible();
    await newTemplateButton.click();
    const templateDialog = page.getByRole("dialog", { name: "استوديو إنشاء قالب النظام" });
    await expect(templateDialog).toBeVisible();
    await templateDialog.getByRole("textbox", { name: "اسم القالب", exact: true }).fill("قالب الشركة الاختباري");
    const canvas = templateDialog.getByTestId("system-template-canvas");
    await expect(canvas).toBeVisible();
    const livePreview = templateDialog.getByTestId("system-template-live-preview");
    await expect(livePreview).toBeVisible();
    const dialogBox = await templateDialog.boundingBox();
    const canvasBox = await canvas.boundingBox();
    const previewBox = await livePreview.boundingBox();
    const panelBox = await templateDialog.getByTestId("template-panel-elements").boundingBox();
    assert.ok(dialogBox && dialogBox.width >= 1400, `expected the studio to use the browser width, got ${dialogBox?.width}`);
    assert.ok(canvasBox && canvasBox.width >= 560 && canvasBox.height >= 800, `expected a large editable canvas, got ${JSON.stringify(canvasBox)}`);
    assert.ok(previewBox && previewBox.width >= 400 && previewBox.height >= 800, `expected a useful live preview, got ${JSON.stringify(previewBox)}`);
    assert.ok(panelBox && canvasBox && panelBox.x > canvasBox.x, "expected the Arabic settings panel on the right of the canvas");
    assert.equal(await templateDialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1), false);

    // Red X close button sits at the far left of the Arabic header row.
    const closeBox = await templateDialog.getByTestId("system-template-studio-close").boundingBox();
    const saveBox = await templateDialog.getByRole("button", { name: "حفظ واعتماد", exact: true }).boundingBox();
    assert.ok(closeBox && saveBox && dialogBox && closeBox.x < saveBox.x && closeBox.x - dialogBox.x < 16, `expected the close X at the far left, got ${JSON.stringify(closeBox)}`);

    // Zoom enlarges the whole page area and shows scrollbars (not a lens).
    const canvasViewport = templateDialog.getByTestId("system-template-canvas-viewport");
    await templateDialog.getByRole("button", { name: "تكبير التعديل", exact: true }).click();
    await templateDialog.getByRole("button", { name: "تكبير التعديل", exact: true }).click();
    await expect(canvasViewport).toHaveAttribute("data-zoom", "1.5");
    const zoomedCanvasBox = await canvas.boundingBox();
    assert.ok(zoomedCanvasBox && canvasBox && zoomedCanvasBox.width > canvasBox.width * 1.45, "expected the canvas itself to grow");
    const overflow = await canvasViewport.evaluate((element) => ({ x: element.scrollWidth > element.clientWidth, y: element.scrollHeight > element.clientHeight }));
    assert.deepEqual(overflow, { x: true, y: true });
    await templateDialog.getByRole("button", { name: "ملاءمة التعديل", exact: true }).click();
    await expect(canvasViewport).toHaveAttribute("data-zoom", "1");
    const previewViewport = templateDialog.getByTestId("system-template-preview-viewport");
    await templateDialog.getByRole("button", { name: "تكبير المعاينة", exact: true }).click();
    await expect(previewViewport).toHaveAttribute("data-zoom", "1.25");
    assert.equal(await previewViewport.evaluate((element) => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight), true);
    await templateDialog.getByRole("button", { name: "ملاءمة المعاينة", exact: true }).click();
    await expect(previewViewport).toHaveAttribute("data-zoom", "1");

    // The live preview is the real report sheet renderer, filled with real company data.
    const previewSheet = livePreview.locator("[data-mv-report-sheet][data-mv-custom-template=true]");
    await expect(previewSheet).toHaveCount(1);
    await expect(canvas.getByText("اسم الشركة", { exact: true })).toBeVisible();
    await expect(canvas.getByText("اسم العميل", { exact: true })).toBeVisible();
    await expect(canvas.getByText("عنوان التقرير", { exact: true })).toBeVisible();
    await expect(canvas.getByText("شركة فاليو تك للتقييم", { exact: true })).toHaveCount(0);
    await expect(livePreview.locator("[data-mv-template-element-layer]").getByText("شركة فاليو تك للتقييم", { exact: true })).toBeVisible();
    await expect(livePreview.locator("[data-mv-template-element-layer]").getByText("شركة العميل الصناعية", { exact: true })).toBeVisible();
    // Same relative geometry on the canvas and in the real report sheet (1:1 fidelity).
    // (polled: after a zoom change the preview rescales on the next frame)
    const geometryGap = async () => {
      const onCanvas = await relativeBox(templateDialog.getByTestId("system-template-canvas-element-cover-report-title"), canvas);
      const inPreview = await relativeBox(livePreview.locator('[data-mv-template-element="cover-report-title"]'), previewSheet);
      return Math.max(...(["x", "y", "w"] as const).map((key) => Math.abs(onCanvas[key] - inPreview[key])));
    };
    await expect.poll(geometryGap, { timeout: 5000 }).toBeLessThan(0.006);

    await templateDialog.getByRole("button", { name: "معاينة بالحجم الكامل", exact: true }).click();
    const fullPreview = page.getByTestId("system-template-full-preview");
    await expect(fullPreview).toBeVisible();
    await expect(fullPreview.locator("[data-mv-template-element-layer]").getByText("شركة فاليو تك للتقييم", { exact: true })).toBeVisible();
    const fullPreviewBox = await fullPreview.boundingBox();
    assert.ok(fullPreviewBox && fullPreviewBox.height >= 950, `expected a full-height preview, got ${JSON.stringify(fullPreviewBox)}`);
    await page.screenshot({ path: "test-results/report-settings-studio/system-template-full-preview.png", fullPage: true });
    await page.keyboard.press("Escape");
    await expect(fullPreview).toBeHidden();
    await expect(templateDialog).toBeVisible();
    const initialReportTitle = templateDialog.getByTestId("system-template-canvas-element-cover-report-title");
    assert.equal(await initialReportTitle.evaluate((element) => {
      const frame = element.firstElementChild as HTMLElement | null;
      const content = frame?.firstElementChild as HTMLElement | null;
      return Boolean(frame && content && content.scrollWidth <= frame.clientWidth + 1 && content.scrollHeight <= frame.clientHeight + 1);
    }), true);
    await page.screenshot({ path: "test-results/report-settings-studio/system-template-canvas-initial.png", fullPage: true });

    // Contextual panels only show settings of the current page.
    await templateDialog.getByTestId("template-panel-colors").click();
    await expect(templateDialog.getByText("لوحات جاهزة", { exact: true })).toBeVisible();
    await templateDialog.getByRole("button", { name: "عنابي" }).click();
    await expect(previewSheet).toHaveAttribute("style", /#7A1E2C/i);
    await templateDialog.getByTestId("template-page-closing").click();
    await expect(templateDialog.getByRole("heading", { name: "الخاتمة", exact: true })).toBeVisible();
    await templateDialog.getByTestId("template-panel-images").click();
    await expect(templateDialog.getByText("خلفية الخاتمة", { exact: true })).toBeVisible();
    await expect(templateDialog.getByText("خلفية الغلاف", { exact: true })).toHaveCount(0);

    // Interior: header/body/footer zones mirror the report frame, and the sheet follows the layout settings.
    await templateDialog.getByTestId("template-page-interior").click();
    await expect(templateDialog.getByTestId("system-template-interior-zones")).toBeVisible();
    await templateDialog.getByTestId("template-panel-layout").click();
    await expect(templateDialog.getByText("الهامش الجانبي", { exact: true })).toBeVisible();
    const interiorHeader = livePreview.locator("[data-mv-report-sheet] header");
    await expect(interiorHeader).toHaveAttribute("style", /height: 22mm/);
    await templateDialog.getByRole("button", { name: "ضبط الترويسة والتذييل على العناصر", exact: true }).click();
    await expect(interiorHeader).toHaveAttribute("style", /height: 21\.5mm/);
    await expect(livePreview.locator("[data-mv-report-sheet] footer")).toHaveAttribute("style", /height: 19mm/);
    await expect(templateDialog.getByTestId("system-template-overlap-warning")).toHaveCount(0);
    const interiorLogo = templateDialog.getByTestId("system-template-canvas-element-interior-logo");
    const logoBox = await interiorLogo.boundingBox();
    assert.ok(logoBox);
    await page.mouse.move(logoBox.x + logoBox.width / 2, logoBox.y + logoBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(logoBox.x + logoBox.width / 2 - 120, logoBox.y + 320, { steps: 6 });
    await page.mouse.up();
    await expect(templateDialog.getByTestId("system-template-overlap-warning")).toBeVisible();
    await page.screenshot({ path: "test-results/report-settings-studio/system-template-interior.png", fullPage: true });
    await page.keyboard.press("Control+z");
    await expect(templateDialog.getByTestId("system-template-overlap-warning")).toHaveCount(0);

    // Executive-summary table: field names (right) + automatic values (left), full body width.
    await templateDialog.getByTestId("template-page-cover").click();
    await templateDialog.getByTestId("template-panel-summary").click();
    await templateDialog.getByRole("switch", { name: "جدول في الملخص التنفيذي" }).click();
    await expect(templateDialog.getByTestId("template-page-interior")).toHaveAttribute("aria-selected", "true");
    const summaryRows = livePreview.locator("[data-mv-summary-table] tbody tr");
    await expect(summaryRows).toHaveCount(12);
    await expect(summaryRows.first().locator("th")).toHaveText("اسم العميل");
    await expect(summaryRows.first().locator("td")).toHaveText("شركة العميل الصناعية");
    const summarySheet = livePreview.locator("[data-mv-report-sheet]");
    const tableBox = await livePreview.locator("[data-mv-summary-table]").boundingBox();
    const sheetBox = await summarySheet.boundingBox();
    assert.ok(tableBox && sheetBox && tableBox.width / sheetBox.width > 0.85, `expected a near full-width table, got ${tableBox?.width} of ${sheetBox?.width}`);
    await templateDialog.getByRole("textbox", { name: "اسم الحقل 1", exact: true }).fill("اسم العميل الكامل");
    await expect(summaryRows.first().locator("th")).toHaveText("اسم العميل الكامل");
    await templateDialog.getByRole("textbox", { name: "عنوان الجدول", exact: true }).fill("ملخص التقييم");
    await expect(livePreview.locator("[data-mv-summary-table] thead th")).toHaveText("ملخص التقييم");
    const projectNumberChip = templateDialog.getByTestId("summary-table-catalog").getByRole("button", { name: "رقم المشروع" });
    await projectNumberChip.click();
    await expect(summaryRows).toHaveCount(13);
    await expect(summaryRows.last().locator("th")).toHaveText("رقم المشروع");
    await projectNumberChip.click();
    await expect(summaryRows).toHaveCount(12);
    // Custom row: own name + value with variables, resolved in the preview.
    await templateDialog.getByRole("button", { name: "صف مخصص", exact: true }).click();
    await expect(summaryRows).toHaveCount(13);
    await templateDialog.getByRole("textbox", { name: "اسم الحقل 13", exact: true }).fill("الجهة المستفيدة");
    await templateDialog.getByRole("textbox", { name: "قيمة الحقل 13", exact: true }).fill("{{clientName}} - فرع الرياض");
    await expect(summaryRows.last().locator("th")).toHaveText("الجهة المستفيدة");
    await expect(summaryRows.last().locator("td")).toHaveText("شركة العميل الصناعية - فرع الرياض");
    // Editing a field row's value (variable inserted from the picker).
    await templateDialog.getByRole("button", { name: "تعديل قيمة الغرض من التقييم", exact: true }).click();
    await templateDialog.getByRole("textbox", { name: "قيمة الحقل 3", exact: true }).fill("لأغراض");
    await templateDialog.getByTestId("summary-table-fields").getByRole("combobox", { name: "إدراج متغير" }).first().selectOption("valuationPurpose");
    await expect(templateDialog.getByRole("textbox", { name: "قيمة الحقل 3", exact: true })).toHaveValue("لأغراض {{valuationPurpose}}");
    await expect(summaryRows.nth(2).locator("td")).toHaveText("لأغراض أغراض التمويل");
    await page.screenshot({ path: "test-results/report-settings-studio/system-template-summary-table.png", fullPage: true });

    // Variables on any page: added from the data menu, resolved in the real preview.
    await templateDialog.getByRole("button", { name: "بيانات", exact: true }).click();
    await templateDialog.getByTestId("system-template-variable-picker").getByRole("button", { name: "رقم المشروع" }).click();
    await expect(templateDialog.getByRole("textbox", { name: "النص", exact: true })).toHaveValue("{{displayNumber}}");
    await expect(livePreview.locator("[data-mv-template-element-layer]").getByText("1024", { exact: true })).toBeVisible();
    await templateDialog.getByRole("textbox", { name: "النص", exact: true }).fill("مشروع رقم ");
    await templateDialog.getByTestId("system-template-element-properties").getByRole("combobox", { name: "إدراج متغير" }).selectOption("displayNumber");
    await expect(livePreview.locator("[data-mv-template-element-layer]").getByText("مشروع رقم 1024", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    // Cover: shapes, data fields, drag, undo/redo, inline text editing.
    await templateDialog.getByTestId("template-page-cover").click();
    await templateDialog.getByRole("button", { name: "شكل", exact: true }).click();
    await templateDialog.getByRole("button", { name: "دائرة", exact: true }).click();
    await templateDialog.getByRole("button", { name: "بيانات", exact: true }).click();
    await expect(templateDialog.getByPlaceholder("بحث")).toBeVisible();
    await templateDialog.getByRole("button", { name: "تاريخ التقرير", exact: true }).last().click();
    await expect(livePreview.locator("[data-mv-template-element-layer]").getByText(/^تاريخ التقرير \d{4}\/\d{2}\/\d{2} م$/).first()).toBeVisible();
    const companyNameElement = templateDialog.getByTestId("system-template-canvas-element-cover-company-name");
    const initialLeft = await leftOf(companyNameElement);
    const elementBox = await companyNameElement.boundingBox();
    assert.ok(elementBox);
    await page.mouse.move(elementBox.x + elementBox.width / 2, elementBox.y + elementBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(elementBox.x + elementBox.width / 2 + 45, elementBox.y + elementBox.height / 2 + 30, { steps: 5 });
    await page.mouse.up();
    const movedLeft = await leftOf(companyNameElement);
    assert.ok(movedLeft > initialLeft, `expected element to move from ${initialLeft}, got ${movedLeft}`);
    await templateDialog.getByRole("button", { name: "تراجع", exact: true }).click();
    assert.equal(await leftOf(companyNameElement), initialLeft);
    await templateDialog.getByRole("button", { name: "إعادة", exact: true }).click();
    assert.equal(await leftOf(companyNameElement), movedLeft);
    await templateDialog.getByRole("button", { name: "نص", exact: true }).click();
    await templateDialog.getByRole("textbox", { name: "اسم العنصر", exact: true }).fill("عنوان حر");
    await canvas.getByText("اكتب النص هنا", { exact: true }).dblclick();
    const inlineTextEditor = canvas.locator("[data-canvas-text-editor]");
    await expect(inlineTextEditor).toBeFocused();
    await inlineTextEditor.fill("نص حر قابل للتحرير");
    await inlineTextEditor.press("Tab");
    await expect(canvas.getByText("نص حر قابل للتحرير", { exact: true })).toBeVisible();

    // Selected element: hatched background + delete icon on the element itself.
    await templateDialog.getByRole("button", { name: "نص", exact: true }).click();
    await expect(canvas.getByTestId("system-template-element-hatch")).toHaveCount(1);
    const hatch = await canvas.getByTestId("system-template-element-hatch").evaluate((element) => getComputedStyle(element).backgroundImage);
    assert.match(hatch, /repeating-linear-gradient\(45deg[\s\S]*repeating-linear-gradient\(-45deg/);
    const textCount = await canvas.getByText("اكتب النص هنا", { exact: true }).count();
    await canvas.getByTestId("system-template-element-delete").click();
    await expect(canvas.getByText("اكتب النص هنا", { exact: true })).toHaveCount(textCount - 1);
    await expect(canvas.getByTestId("system-template-element-delete")).toHaveCount(0);
    await expect(livePreview.locator("[data-mv-template-element-layer]").getByText("نص حر قابل للتحرير", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/report-settings-studio/system-template-canvas-editor.png", fullPage: true });
    // A failed server save keeps the studio open with an error (nothing is lost).
    await page.evaluate(() => { (window as unknown as { __failNextTemplateSave?: boolean }).__failNextTemplateSave = true; });
    await templateDialog.getByRole("button", { name: "حفظ واعتماد", exact: true }).click();
    await expect(templateDialog.getByRole("alert")).toContainText("تعذر حفظ القالب على الخادم");
    await expect(templateDialog).toBeVisible();
    await templateDialog.getByRole("button", { name: "حفظ واعتماد", exact: true }).click();
    await expect(templateDialog).toBeHidden();
    const persisted = await page.evaluate(() => (window as unknown as { __savedTemplates?: { templates: Array<{ id: string; name: string }>; templateId: string } }).__savedTemplates);
    assert.ok(persisted, "expected save to reach the server");
    assert.equal(persisted.templates.length, 1);
    assert.equal(persisted.templates[0]!.name, "قالب الشركة الاختباري");
    assert.equal(persisted.templateId, persisted.templates[0]!.id);
    const persistedSummary = (persisted.templates[0] as unknown as { summaryTable?: { enabled: boolean; title?: string; fields: Array<{ label: string; sourceKey: string }> } }).summaryTable;
    assert.ok(persistedSummary?.enabled, "expected the summary table to be saved");
    assert.equal(persistedSummary.title, "ملخص التقييم");
    assert.equal(persistedSummary.fields.length, 13);
    assert.deepEqual(
      persistedSummary.fields.map((field) => (field as { valueTemplate?: string }).valueTemplate).filter(Boolean),
      ["لأغراض {{valuationPurpose}}", "{{clientName}} - فرع الرياض"],
    );
    assert.deepEqual(persistedSummary.fields[0], { ...persistedSummary.fields[0], sourceKey: "clientName", label: "اسم العميل الكامل" });
    await expect(page.getByText("قالب الشركة الاختباري", { exact: true })).toBeVisible();
    await expect(page.getByText("المعتمد: قالب الشركة الاختباري", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "تحرير قالب الشركة الاختباري", exact: true }).click();
    await expect(templateDialog.getByRole("button", { name: "عنوان حر", exact: true })).toBeVisible();
    assert.equal(await leftOf(templateDialog.getByTestId("system-template-canvas-element-cover-company-name")), movedLeft);

    // Unsaved changes are never discarded silently.
    await templateDialog.getByRole("textbox", { name: "اسم القالب", exact: true }).fill("قالب الشركة الاختباري 2");
    await templateDialog.getByRole("button", { name: "إغلاق", exact: true }).click();
    await expect(templateDialog.getByText("تجاهل التعديلات غير المحفوظة؟", { exact: true })).toBeVisible();
    await templateDialog.getByRole("button", { name: "متابعة التحرير", exact: true }).click();

    await page.setViewportSize({ width: 1024, height: 760 });
    await expect(templateDialog.getByRole("button", { name: "نص", exact: true })).toBeVisible();
    await expect(templateDialog.getByRole("button", { name: "حفظ واعتماد", exact: true })).toBeVisible();
    const compactDialogBox = await templateDialog.boundingBox();
    await page.screenshot({ path: "test-results/report-settings-studio/system-template-canvas-responsive.png", fullPage: true });
    assert.ok(compactDialogBox && compactDialogBox.width <= 1024 && compactDialogBox.height <= 760, `expected the compact studio to stay inside 1024x760, got ${JSON.stringify(compactDialogBox)}`);
    assert.equal(await templateDialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1), false);
    await templateDialog.getByRole("button", { name: "حفظ واعتماد", exact: true }).click();
    await expect(templateDialog).toBeHidden();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: "test-results/report-settings-studio/system-template-library.png", fullPage: true });
    await page.getByRole("tab", { name: "أقسام وتعريفات التقرير" }).click();
    await expect(page.getByTestId("أقسام وتعريفات التقرير")).toBeVisible();
    await page.getByRole("tab", { name: "قالب كليشة الشركة" }).click();
    await expect(page.getByText("إظهار الكليشة في كل الصفحات")).toBeVisible();
    await page.screenshot({ path: "test-results/report-settings-studio/report-design.png", fullPage: true });

    await page.getByRole("tab", { name: "قالب Word" }).click();
    await expect(page.getByTestId("قالب Word")).toBeVisible();
    await page.getByRole("tab", { name: "قالب PowerPoint" }).click();
    await expect(page.getByTestId("قالب PowerPoint")).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
