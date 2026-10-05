import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwind from "tailwindcss";
import tailwindConfig from "../tailwind.config";

test("PDF settings are usable above the helper-tools modal", { timeout: 120_000 }, async () => {
  const bundle = await build({
    entryPoints: ["tests/helper-images-to-pdf-browser/fixture.tsx"],
    bundle: true,
    write: false,
    jsx: "automatic",
    platform: "browser",
  });
  const css = await postcss([tailwind({ ...tailwindConfig, content: ["src/components/**/*.tsx", "tests/helper-images-to-pdf-browser/fixture.tsx"] })])
    .process(await readFile("src/app/globals.css", "utf8"), { from: "src/app/globals.css" });
  const script = bundle.outputFiles[0]!.contents;
  const server = createServer((request, response) => {
    if (request.url === "/app.js") { response.setHeader("Content-Type", "text/javascript"); response.end(script); return; }
    if (request.url === "/app.css") { response.setHeader("Content-Type", "text/css; charset=utf-8"); response.end(css.css); return; }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.waitForTimeout(100);
    assert.deepEqual(errors, []);
    const modal = page.getByRole("dialog", { name: "الأدوات المساعدة", exact: true });
    const settings = modal.getByRole("button", { name: "إعدادات PDF", exact: true });
    await page.screenshot({ path: "test-results/helper-pdf-settings-before.png" });
    await expect(settings).toBeVisible();
    await settings.click();
    const popover = page.locator("[data-helper-tools-overlay]").filter({ hasText: "الصور في الصف" });
    await expect(popover).toBeVisible();
    await expect(popover).toHaveCSS("z-index", "920");
    await expect(modal).toBeVisible();
    await popover.getByRole("combobox").first().click();
    const select = page.getByRole("listbox");
    await expect(select).toBeVisible();
    await expect(select).toHaveCSS("z-index", "950");
    await page.getByRole("option", { name: "4", exact: true }).click();
    await expect(settings).toContainText("4×15");
    await expect(modal).toBeVisible();
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
