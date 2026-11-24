import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwind from "tailwindcss";
import tailwindConfig from "../tailwind.config";
import type { MvCompanyReportSectionModel } from "../src/components/workspace/workspace-sections/machine-valuation/types";

test("report model editor selects new sections and adds items beneath the active sidebar section", { timeout: 120_000 }, async () => {
  const bundle = await build({
    entryPoints: ["./tests/report-section-model-browser/fixture.tsx"],
    bundle: true,
    write: false,
    jsx: "automatic",
    platform: "browser",
  });
  const css = await postcss([
    tailwind({
      ...tailwindConfig,
      content: [
        "tests/report-section-model-browser/fixture.tsx",
        "src/components/company-report-section-model-dashboard.tsx",
        "src/components/ui/*.tsx",
      ],
    }),
  ]).process(await readFile("src/app/globals.css", "utf8"), { from: "src/app/globals.css" });
  const server = createServer((request, response) => {
    if (request.url === "/app.css") {
      response.setHeader("Content-Type", "text/css; charset=utf-8");
      response.end(css.css);
      return;
    }
    const javascript = request.url?.startsWith("/app.js");
    response.setHeader(
      "Content-Type",
      javascript ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8",
    );
    response.end(
      javascript
        ? bundle.outputFiles[0].contents
        : '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>',
    );
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
    await page.getByRole("button", { name: "تعديل النموذج" }).click();

    const dialog = page.getByRole("dialog");
    const sectionNavigation = dialog.getByRole("navigation", { name: "أقسام النموذج" });
    await expect(sectionNavigation.getByRole("textbox", { name: "اسم القسم" })).toHaveCount(2);
    await expect(dialog.getByPlaceholder("نص البند")).toHaveCount(1);
    await expect(dialog.getByPlaceholder("نص البند")).toHaveValue("نص البند الأول");

    await sectionNavigation.locator(".vtd-it").nth(1).locator("small").click();
    await expect(sectionNavigation.getByRole("textbox", { name: "اكتب بنداً جديداً أسفل قسم القسم الثاني" })).toBeFocused();

    await dialog.getByRole("button", { name: "إضافة قسم", exact: true }).click();
    await expect(sectionNavigation.getByRole("textbox", { name: "اسم القسم" })).toHaveCount(3);
    await expect(sectionNavigation.locator('input[aria-label="اسم القسم"]').nth(2)).toHaveValue("قسم جديد");
    await expect(dialog.getByPlaceholder("عنوان البند أو التعريف")).toHaveValue("بند جديد");

    const sidebarAddItem = sectionNavigation.getByRole("textbox", { name: "اكتب بنداً جديداً أسفل قسم قسم جديد" });
    await expect(sidebarAddItem).toBeVisible();
    await expect(sidebarAddItem).toBeFocused();
    await sidebarAddItem.fill("بند من السايدبار");
    await sidebarAddItem.press("Enter");
    await expect(dialog.getByPlaceholder("عنوان البند أو التعريف")).toHaveCount(2);
    await expect(dialog.getByPlaceholder("عنوان البند أو التعريف").last()).toHaveValue("بند من السايدبار");
    await expect(sectionNavigation.getByRole("button", { name: "بند من السايدبار" })).toBeVisible();
    await expect(sidebarAddItem).toBeEmpty();
    await expect(sidebarAddItem).toBeFocused();
    await expect(dialog.getByRole("button", { name: /إضافة بند جديد أسفل آخر بند/ })).toBeVisible();
    await page.screenshot({ path: "test-results/report-sections/editor.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(sectionNavigation).toBeVisible();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
      false,
    );
    await page.screenshot({ path: "test-results/report-sections/editor-mobile.png", fullPage: true });
    await dialog.getByRole("button", { name: "تحريك القسم قسم جديد", exact: true }).press("ArrowUp");
    await dialog.getByRole("button", { name: "حفظ", exact: true }).click();

    const saved = JSON.parse(await page.getByTestId("saved-models").textContent() || "[]") as MvCompanyReportSectionModel[];
    assert.deepEqual(saved[0].sections.map((section) => section.title), ["القسم الأول", "قسم جديد", "القسم الثاني"]);
    assert.equal(saved[0].sections[1].items.length, 2);
    assert.equal(saved[0].sections[1].items[1]?.title, "بند من السايدبار");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "إضافة نموذج الأقسام", exact: true }).click();
    const createDialog = page.getByRole("dialog");
    const createSidebar = createDialog.getByRole("navigation", { name: "أقسام النموذج" });
    const createSidebarAddItem = createSidebar.getByRole("textbox", { name: /اكتب بنداً جديداً أسفل قسم/ });
    const itemCountBeforeAdd = await createDialog.getByPlaceholder("عنوان البند أو التعريف").count();
    await expect(createSidebarAddItem).toBeVisible();
    await createSidebarAddItem.fill("بند متتابع أول");
    await createSidebarAddItem.press("Enter");
    await expect(createDialog.getByPlaceholder("عنوان البند أو التعريف")).toHaveCount(itemCountBeforeAdd + 1);
    await expect(createSidebarAddItem).toBeFocused();
    await createSidebarAddItem.fill("بند متتابع ثانٍ");
    await createSidebarAddItem.press("Enter");
    await expect(createDialog.getByPlaceholder("عنوان البند أو التعريف")).toHaveCount(itemCountBeforeAdd + 2);
    await expect(createSidebarAddItem).toBeFocused();
    const pageAddItem = createDialog.getByRole("button", { name: /إضافة بند جديد أسفل آخر بند/ });
    await pageAddItem.click();
    await expect(createDialog.getByPlaceholder("عنوان البند أو التعريف")).toHaveCount(itemCountBeforeAdd + 3);
    await expect(createDialog.getByPlaceholder("عنوان البند أو التعريف").last()).toBeFocused();
    await expect(createDialog.getByRole("button", { name: "إغلاق" })).toBeVisible();
    await createDialog.getByPlaceholder("اسم النموذج").fill("تعديل غير محفوظ");
    await createDialog.getByRole("button", { name: "إلغاء", exact: true }).click();
    const confirmDialog = page.getByRole("dialog").filter({ hasText: "تغييرات غير محفوظة" });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByRole("button", { name: "إغلاق بدون حفظ" })).toBeVisible();
    await expect(confirmDialog.getByRole("button", { name: "حفظ وإغلاق" })).toBeVisible();
    await confirmDialog.getByRole("button", { name: "إغلاق بدون حفظ" }).click();
    await expect(createDialog).toBeHidden();
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
