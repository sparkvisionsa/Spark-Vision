import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import PizZip from "pizzip";
import postcss from "postcss";
import tailwind from "tailwindcss";
import tailwindConfig from "../tailwind.config";

test("template preparation, copying, model selection, upload and manual binding in both tabs", { timeout: 180_000 }, async () => {
  const bundle = await build({ entryPoints: ["tests/report-template-browser/fixture.tsx"], bundle: true, write: false, jsx: "automatic", platform: "browser" });
  const css = await postcss([tailwind({ ...tailwindConfig, content: ["src/components/company-report-document-template-dashboard.tsx", "src/components/ui/*.tsx"] })])
    .process(await readFile("src/app/globals.css", "utf8"), { from: "src/app/globals.css" });
  const server = createServer((request, response) => {
    if (request.url === "/app.css") {
      response.setHeader("Content-Type", "text/css; charset=utf-8");
      response.end(css.css);
      return;
    }
    response.setHeader("Content-Type", request.url?.startsWith("/app.js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8");
    response.end(request.url?.startsWith("/app.js") ? bundle.outputFiles[0].contents : '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const format of ["word", "pptx"] as const) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${origin}/?format=${format}`);
        await expect(page.getByRole("combobox", { name: "نموذج بيانات التقرير" })).toHaveText("نموذج فرد");
        await expect(page.locator('input[type="file"]')).toHaveCount(0);
        const basis = page.locator("code").filter({ hasText: "<<اساس_القيمة>>" });
        await expect(basis).toHaveClass(/text-orange-700/);
        await page.getByRole("button", { name: "نسخ <<اساس_القيمة>>", exact: true }).click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "<<اساس_القيمة>>");
        await page.getByRole("button", { name: "أضف قالب جديد", exact: true }).click();
        await expect(page.locator('input[type="file"]')).toHaveCount(1);
        await page.screenshot({ path: `test-results/report-templates/${format}-prepare.png`, fullPage: true });
        await page.getByRole("combobox", { name: "نموذج بيانات التقرير" }).click();
        await page.getByRole("option", { name: "نموذج المعدات", exact: true }).click();
        await expect(page.locator("tbody tr")).toHaveCount(2);
        const extension = format === "word" ? "docx" : "pptx";
        await page.locator('input[type="file"]').setInputFiles({ name: `empty.${extension}`, mimeType: "application/octet-stream", buffer: Buffer.alloc(0) });
        await expect(page.getByRole("alert")).toContainText("فارغ");
        await expect(page.getByRole("combobox", { name: "نموذج بيانات التقرير" })).toHaveText("نموذج المعدات");
        const zip = new PizZip();
        const text = "&lt;&lt;الرقم_التسلسلي&gt;&gt; &lt;&lt;خاص_بالقالب&gt;&gt;";
        if (format === "word") zip.file("word/document.xml", `<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
        else {
          zip.file("ppt/presentation.xml", "<p:presentation/>");
          zip.file("ppt/slides/slide1.xml", `<p:sld><p:sp><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sp></p:sld>`);
        }
        await page.locator('input[type="file"]').setInputFiles({ name: `report.${extension}`, mimeType: "application/octet-stream", buffer: zip.generate({ type: "nodebuffer" }) });
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(page.locator("tbody tr")).toHaveCount(2);
        await expect(page.locator("code").filter({ hasText: "<<الرقم_التسلسلي>>" })).toHaveClass(/text-emerald-700/);
        const unknownRow = page.getByRole("row").filter({ hasText: "<<خاص_بالقالب>>" });
        await expect(unknownRow.locator("code")).toHaveClass(/text-orange-700/);
        await unknownRow.getByRole("button", { name: "اختر مصدر البيانات" }).click();
        await page.getByRole("button", { name: /^أساس القيمة/ }).click();
        await expect(unknownRow.locator("code")).toHaveClass(/text-emerald-700/);
        await page.screenshot({ path: `test-results/report-templates/${format}-linked.png`, fullPage: true });
        await page.reload();
        await expect(page.getByRole("combobox", { name: "نموذج بيانات التقرير" })).toHaveText("نموذج المعدات");
        await expect(page.locator("code").filter({ hasText: "<<خاص_بالقالب>>" })).toHaveClass(/text-emerald-700/);
        await page.getByRole("button", { name: "أضف قالب آخر", exact: true }).click();
        await expect(page.getByRole("combobox", { name: "نموذج بيانات التقرير" })).toHaveText("نموذج فرد");
        await expect(basis).toHaveClass(/text-orange-700/);
        await expect(page.locator("code.text-emerald-700")).toHaveCount(0);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.getByRole("button", { name: "أضف قالب آخر", exact: true })).toBeVisible();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: `test-results/report-templates/${format}-mobile.png`, fullPage: true });
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
