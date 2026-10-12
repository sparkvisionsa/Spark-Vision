import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwind from "tailwindcss";
import tailwindConfig from "../tailwind.config";

test("preview zoom does not change image selection", { timeout: 120_000 }, async () => {
  const bundle = await build({
    entryPoints: ["tests/report-images-preview-browser/fixture.tsx"],
    bundle: true,
    write: false,
    jsx: "automatic",
    platform: "browser",
  });
  const css = await postcss([tailwind({ ...tailwindConfig, content: [
    "src/components/ui/{button,dialog,input}.tsx",
    "src/components/workspace/workspace-sections/machine-valuation/{mv-dialog,mv-report-images-select-modal}.tsx",
    "tests/report-images-preview-browser/fixture.tsx",
  ] })])
    .process(await readFile("src/app/globals.css", "utf8"), { from: "src/app/globals.css" });
  const script = bundle.outputFiles[0]!.contents;
  const server = createServer((request, response) => {
    if (request.url === "/app.js") { response.setHeader("Content-Type", "text/javascript"); response.end(script); return; }
    if (request.url === "/app.css") { response.setHeader("Content-Type", "text/css; charset=utf-8"); response.end(css.css); return; }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    const selection = page.getByRole("dialog", { name: "تحديد صور التقرير" });
    await expect(selection).toContainText("المحدد 0 من 1");
    await selection.getByRole("button", { name: "معاينة الصورة: فرن حراري" }).click();
    const preview = page.getByRole("dialog", { name: "فرن حراري" });
    await expect(preview).toBeVisible();
    const image = preview.locator('img[alt="فرن حراري"]');
    await expect(image).toBeVisible();
    await expect.poll(async () => image.evaluate((element) => getComputedStyle(element).visibility)).toBe("visible");
    const viewport = await preview.locator("[data-report-image-preview-viewport]").boundingBox();
    const beforeZoom = await image.boundingBox();
    assert.ok(viewport);
    assert.ok(beforeZoom);
    assert.ok(beforeZoom.width <= viewport.width * 0.9 + 1);
    assert.ok(beforeZoom.height <= viewport.height * 0.9 + 1);
    assert.ok(beforeZoom.x >= viewport.x && beforeZoom.y >= viewport.y);
    assert.ok(beforeZoom.x + beforeZoom.width <= viewport.x + viewport.width);
    assert.ok(beforeZoom.y + beforeZoom.height <= viewport.y + viewport.height);
    await preview.getByRole("button", { name: "تكبير الصورة" }).click();
    await expect(preview.getByRole("button", { name: "إعادة حجم الصورة" })).toContainText("125%");
    await expect.poll(async () => (await image.boundingBox())?.width ?? 0).toBeGreaterThan(beforeZoom.width);
    await preview.getByRole("button", { name: "تصغير الصورة" }).click();
    await expect(preview.getByRole("button", { name: "إعادة حجم الصورة" })).toContainText("100%");
    await page.keyboard.press("Escape");
    await expect(preview).not.toBeVisible();
    await expect(selection).toContainText("المحدد 0 من 1");
    await selection.locator("[data-report-image-card='true'] > button").first().click();
    await expect(selection).toContainText("المحدد 1 من 1");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
