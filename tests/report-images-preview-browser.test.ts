import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwind from "tailwindcss";
import tailwindConfig from "../tailwind.config";

test("report image overview, scroll sync, selection and preview", { timeout: 120_000 }, async () => {
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
  await mkdir("test-results/report-images-preview", { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    const selection = page.getByRole("dialog", { name: "تحديد صور التقرير" });
    await expect(selection).toContainText("المحدد 0 من 15");

    await selection.getByRole("button", { name: "عرض جميع الصور", exact: true }).click();
    const allImages = page.getByRole("dialog", { name: "عرض جميع صور الأصول" });
    await expect(allImages).toBeVisible();
    await expect(allImages.getByRole("heading", { name: "فرن حراري", exact: true })).toBeVisible();
    await expect(allImages.getByRole("heading", { name: "رافعة شوكية", exact: true })).toBeVisible();
    await allImages.getByRole("button", { name: "معاينة الصورة: فرن حراري 1" }).click();
    const overviewPreview = page.getByRole("dialog", { name: "فرن حراري 1" });
    await expect(overviewPreview).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overviewPreview).not.toBeVisible();
    await expect(allImages).toBeVisible();
    await page.screenshot({ path: "test-results/report-images-preview/all-images.png" });
    const overviewCheckbox = allImages.getByRole("checkbox", { name: "تحديد الصورة للتقرير: رافعة شوكية 1" });
    await overviewCheckbox.click();
    await expect(overviewCheckbox).toHaveAttribute("aria-checked", "true");
    await allImages.getByRole("button", { name: "إغلاق", exact: true }).click();
    await expect(allImages).not.toBeVisible();
    await expect(selection).toContainText("المحدد 1 من 15");

    const mainScroll = selection.locator("[data-report-images-scroll]");
    await mainScroll.hover();
    await page.mouse.wheel(0, 1000);
    await expect.poll(() => mainScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect.poll(() => selection.locator('[data-report-section-nav][aria-current="true"]').getAttribute("data-report-section-nav")).not.toBe("asset-1");
    await mainScroll.evaluate((element) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event("scroll")); });
    await expect(selection.locator('[data-report-section-nav="asset-3"]')).toHaveAttribute("aria-current", "true");
    await expect(selection.locator('[data-report-section-nav="asset-3"]')).toHaveClass(/bg-emerald-100/);
    await expect(selection.locator('[data-report-section-nav="asset-3"]')).toContainText("مولد احتياطي");
    await expect(selection.locator('[data-report-section-nav="asset-1"]')).not.toHaveAttribute("aria-current", "true");
    await page.waitForTimeout(500);
    await expect(selection.locator('[data-report-section-nav="asset-3"]')).toHaveAttribute("aria-current", "true");
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.screenshot({ path: "test-results/report-images-preview/selection-scroll-current.png" });

    await mainScroll.hover();
    await page.mouse.wheel(0, -3000);
    await expect.poll(() => mainScroll.evaluate((element) => element.scrollTop)).toBe(0);
    await expect(selection.locator('[data-report-section-nav="asset-1"]')).toHaveAttribute("aria-current", "true");

    await page.setViewportSize({ width: 900, height: 800 });
    await mainScroll.hover();
    await page.mouse.wheel(0, 1000);
    await expect.poll(() => mainScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect.poll(() => selection.locator('[data-report-section-nav][aria-current="true"]').getAttribute("data-report-section-nav")).not.toBe("asset-1");
    await page.mouse.wheel(0, -3000);
    await expect.poll(() => mainScroll.evaluate((element) => element.scrollTop)).toBe(0);
    await page.setViewportSize({ width: 1200, height: 800 });

    await selection.getByRole("button", { name: "معاينة الصورة: فرن حراري 1" }).click();
    const preview = page.getByRole("dialog", { name: "فرن حراري 1" });
    await expect(preview).toBeVisible();
    const image = preview.locator('img[alt="فرن حراري 1"]');
    await expect(image).toBeVisible();
    await expect.poll(async () => image.evaluate((element) => getComputedStyle(element).visibility)).toBe("visible");
    const previewViewport = preview.locator("[data-report-image-preview-viewport]");
    await expect.poll(async () => {
      const viewportBounds = await previewViewport.boundingBox();
      const imageBounds = await image.boundingBox();
      if (!viewportBounds || !imageBounds) return false;
      return imageBounds.width <= viewportBounds.width * 0.9 + 1
        && imageBounds.height <= viewportBounds.height * 0.9 + 1
        && imageBounds.x >= viewportBounds.x
        && imageBounds.y >= viewportBounds.y
        && imageBounds.x + imageBounds.width <= viewportBounds.x + viewportBounds.width
        && imageBounds.y + imageBounds.height <= viewportBounds.y + viewportBounds.height;
    }).toBe(true);
    const viewport = await previewViewport.boundingBox();
    const beforeZoom = await image.boundingBox();
    assert.ok(viewport);
    assert.ok(beforeZoom);
    await preview.getByRole("button", { name: "تكبير الصورة" }).click();
    await expect(preview.getByRole("button", { name: "إعادة حجم الصورة" })).toContainText("125%");
    await expect.poll(async () => (await image.boundingBox())?.width ?? 0).toBeGreaterThan(beforeZoom.width);
    assert.deepEqual(
      await previewViewport.evaluate((element) => ({
        overflowX: getComputedStyle(element).overflowX,
        overflowY: getComputedStyle(element).overflowY,
      })),
      { overflowX: "hidden", overflowY: "hidden" },
    );
    await previewViewport.hover();
    await page.mouse.wheel(0, -160);
    await expect.poll(async () => Number((await preview.getByRole("button", { name: "إعادة حجم الصورة" }).textContent())?.replace("%", ""))).toBeGreaterThan(125);
    await preview.getByRole("button", { name: "إعادة حجم الصورة" }).click();
    await expect(preview.getByRole("button", { name: "إعادة حجم الصورة" })).toContainText("100%");
    await preview.getByRole("button", { name: "تكبير الصورة" }).click();
    await preview.getByRole("button", { name: "تصغير الصورة" }).click();
    await expect(preview.getByRole("button", { name: "إعادة حجم الصورة" })).toContainText("100%");
    await page.keyboard.press("Escape");
    await expect(preview).not.toBeVisible();
    await expect(selection).toContainText("المحدد 1 من 15");

    await page.setViewportSize({ width: 390, height: 844 });
    await selection.getByRole("button", { name: "عرض جميع الصور", exact: true }).click();
    await expect(allImages).toBeVisible();
    const mobileBounds = await allImages.boundingBox();
    assert.ok(mobileBounds && mobileBounds.x >= 0 && mobileBounds.y >= 0);
    assert.ok(mobileBounds.x + mobileBounds.width <= 390 && mobileBounds.y + mobileBounds.height <= 844);
    assert.equal(await allImages.locator("[data-report-all-images-scroll]").evaluate((element) => element.scrollHeight > element.clientHeight), true);
    await allImages.getByRole("button", { name: "إغلاق", exact: true }).click();

    await selection.locator("[data-report-image-card='true'] > button").first().click();
    await expect(selection).toContainText("المحدد 2 من 15");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
