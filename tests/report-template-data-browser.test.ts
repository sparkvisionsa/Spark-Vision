import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, type Page } from "@playwright/test";
import postcss from "postcss";
import tailwind from "tailwindcss";
import tailwindConfig from "../tailwind.config";

type SheetFields = { page: number; layerText: string };

/** Text printed by the template element layer of every interior sheet. */
async function interiorTemplateText(page: Page): Promise<SheetFields[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-mv-report-sheet]"))
      .map((sheet, index) => ({ sheet, page: index + 1 }))
      .filter(({ sheet }) => sheet.querySelector("[data-mv-template-element='client']"))
      .map(({ sheet, page }) => ({
        page,
        layerText: Array.from(sheet.querySelectorAll<HTMLElement>("[data-mv-template-element]"))
          .map((el) => el.textContent ?? "")
          .join(" | "),
      })),
  );
}

test("system-template fields show the report data on every page, and gaps are caught before export", { timeout: 120_000 }, async () => {
  const bundle = await build({
    entryPoints: ["./tests/report-template-data-browser/fixture.tsx"],
    bundle: true,
    write: false,
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "@": "./src" },
    loader: { ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl" },
    logLevel: "error",
  });
  const css = await postcss([
    tailwind({
      ...tailwindConfig,
      content: [
        "tests/report-template-data-browser/fixture.tsx",
        "src/components/workspace/workspace-sections/machine-valuation/*.tsx",
        "src/components/system-report-template-canvas.tsx",
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
    if (request.url?.startsWith("/app.js")) {
      response.setHeader("Content-Type", "text/javascript; charset=utf-8");
      response.end(bundle.outputFiles[0].contents);
      return;
    }
    if (request.url && request.url !== "/") {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(
      '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.waitForSelector("[data-mv-template-element='client']", { timeout: 30_000 });
    await page.waitForTimeout(800);

    // Every interior page (TOC, body, annexes …) carries the template fields with real data.
    const sheets = await interiorTemplateText(page);
    const total = await page.locator("[data-mv-report-sheet]").count();
    assert.ok(sheets.length >= 5, `interior sheets with template fields: ${sheets.length} of ${total}`);
    for (const sheet of sheets) {
      for (const expected of [
        "شركة الاختبار المحدودة", // clientName binding
        "تقرير تقييم خط إنتاج", // reportTitle binding
        "REF-2026-77", // reportReference binding
        "2026", // reportDate binding
        "التمويل البنكي", // {{intendedUse}}
        "شركة التقييم المعتمدة", // {{valuationFirmName}} → company name the report prints
      ]) {
        assert.ok(sheet.layerText.includes(expected), `page ${sheet.page} is missing "${expected}": ${sheet.layerText}`);
      }
      assert.ok(!sheet.layerText.includes("{{"), `page ${sheet.page} shows a raw variable: ${sheet.layerText}`);
      // {{project.clientName}} (report-model key style) resolves too: binding + variable.
      assert.equal(sheet.layerText.split("شركة الاختبار المحدودة").length - 1, 2, `page ${sheet.page}: ${sheet.layerText}`);
    }

    // Complete data → nothing to warn about before export.
    assert.deepEqual(await page.evaluate(() => window.__templateGaps()), []);

    // Missing client name + a variable with no data → listed with their pages.
    await page.evaluate(() => {
      window.__patchReportData({ clientName: "" });
      window.__addInteriorText("{{clientPhone}}");
    });
    await page.waitForTimeout(500);
    const gaps = await page.evaluate(() => window.__templateGaps());
    const labels = gaps.map((gap) => gap.label);
    assert.ok(labels.includes("اسم العميل"), JSON.stringify(gaps));
    assert.ok(labels.includes("{{clientPhone}}"), JSON.stringify(gaps));
    for (const gap of gaps) assert.ok(gap.pages.length >= sheets.length, JSON.stringify(gap));
    console.log(`template data: ${sheets.length} of ${total} pages carry interior fields; gaps detected: ${labels.join(", ")}`);

    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
