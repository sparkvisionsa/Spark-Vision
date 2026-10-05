import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { HANDBOOK_PAGES } from "../src/components/workspace/workspace-sections/machine-valuation/mv-handbook-content";

test("handbook onboarding, persistence, accessibility and responsive reading", { timeout: 300_000 }, async () => {
  const bundle = await build({ entryPoints: ["tests/mv-handbook-browser/fixture.tsx"], bundle: true, write: false, outdir: "fixture", jsx: "automatic", platform: "browser", plugins: [{
    name: "fixture-context",
    setup(build) {
      build.onResolve({ filter: /auth-tracking-provider$/ }, () => ({ path: path.resolve("tests/mv-handbook-browser/fixture.tsx") }));
      build.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: "dynamic", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'import {lazy} from "react"; export default function dynamic(load) { return lazy(load); }', resolveDir: process.cwd() }));
    },
  }] });
  const js = bundle.outputFiles.find(file => file.path.endsWith(".js"))!.contents;
  const css = bundle.outputFiles.find(file => file.path.endsWith(".css"))!.text;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, "http://localhost");
    if (/^\/mv-handbook\/[a-z-]+\.jpg$/.test(url.pathname)) {
      try { response.setHeader("Content-Type", "image/jpeg"); response.end(await readFile(path.join("public", url.pathname))); }
      catch { response.statusCode = 404; response.end(); }
      return;
    }
    if (url.pathname === "/app.js") { response.setHeader("Content-Type", "text/javascript"); response.end(js); return; }
    if (url.pathname === "/app.css") { response.setHeader("Content-Type", "text/css"); response.end('*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif}button{font-family:inherit}h1,h2,h3,p{margin:0}' + css); return; }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  await mkdir("test-results/mv-handbook", { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    await page.waitForTimeout(900);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("mv:handbook:seen:reader-one")), "1");
    const book = page.locator("[data-mv-handbook-dialog]");
    const launcher = page.getByRole("button", { name: "فتح كتيب استخدام نظام تقييم الآلات" });
    await expect(book).toBeVisible({ timeout: 15_000 });
    await expect(book.getByRole("button", { name: "السابق", exact: true })).toBeDisabled();
    await page.screenshot({ path: "test-results/mv-handbook/desktop-cover.png" });
    await book.getByRole("button", { name: "ابدأ الاطلاع", exact: true }).click();
    await expect(book.getByRole("heading", { name: "الصورة العامة لمسار العمل", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(book.getByRole("heading", { name: "نموذج البيانات: أساس التقرير", exact: true })).toBeVisible();
    await book.getByRole("button", { name: /^تكبير لقطة/ }).click();
    await expect(page.getByRole("button", { name: "إغلاق تكبير اللقطة" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(book).toBeVisible();
    await expect(book.getByRole("button", { name: /^تكبير لقطة/ })).toBeFocused();
    await book.getByRole("button", { name: "إغلاق الكتيب", exact: true }).click();
    await expect(launcher).toBeFocused();
    await page.reload();
    await expect(launcher).toBeVisible();
    await page.waitForTimeout(800);
    await expect(book).toHaveCount(0);
    await launcher.click();
    await expect(book.getByRole("heading", { name: "نموذج البيانات: أساس التقرير", exact: true })).toBeVisible();
    await book.getByRole("checkbox", { name: "عدم الظهور مرة أخرى" }).check();
    await book.getByRole("button", { name: "إغلاق الكتيب", exact: true }).click();
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(launcher).toBeVisible();
    await page.waitForTimeout(800);
    await expect(book).toHaveCount(0);
    await launcher.click();
    await expect(book.getByRole("checkbox", { name: "عدم الظهور مرة أخرى" })).toBeChecked();
    await book.getByRole("button", { name: "الفهرس", exact: true }).click();
    await expect(book.getByRole("heading", { name: "الانتقال إلى موضوع محدد" })).toBeVisible();
    const search = book.getByRole("searchbox", { name: "البحث في الكتيب" });
    await expect(search).toBeFocused();
    await search.fill("بَاوَر بوينت");
    await expect(book.getByRole("button", { name: /قوالب PowerPoint للعروض التنفيذية/ })).toBeVisible();
    await search.fill("عبارةغيرموجودة");
    await expect(book.getByText(/لا توجد نتائج/)).toBeVisible();
    await book.getByRole("button", { name: "مسح البحث" }).click();
    await expect(search).toBeFocused();
    await book.getByRole("button", { name: /ربط الحقول بالمتغيرات/ }).click();
    await expect(book.getByRole("region", { name: "ألبوم لقطات الصفحة" })).toBeVisible();
    await book.getByRole("button", { name: "إضاءة «نموذج بيانات التقرير» في اللقطة" }).click();
    await expect(book.locator('[data-handbook-spot="choose-model"][data-active="true"]').first()).toHaveAttribute("aria-pressed", "true");
    await book.getByRole("button", { name: "كتم صوت تقليب الصفحات" }).click();
    await expect(book.getByRole("button", { name: "تشغيل صوت تقليب الصفحات" })).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: "test-results/mv-handbook/desktop-variables.png" });
    await book.getByRole("button", { name: "الفهرس", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(book.getByRole("heading", { name: "ربط الحقول بالمتغيرات" })).toBeFocused();
    // The dialog keeps keyboard focus inside itself, including Shift+Tab wraparound.
    for (let tab = 0; tab < 16; tab++) {
      await page.keyboard.press(tab % 2 ? "Shift+Tab" : "Tab");
      assert.ok(await book.evaluate(node => node.contains(document.activeElement)));
    }
    // Every page is reachable, has an intact screenshot, and can be read at mobile width.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const quickScreenshot = book.getByRole("button", { name: "شاهد هذه الخطوة في النظام" });
    await quickScreenshot.click();
    await expect(page.getByRole("button", { name: "إغلاق تكبير اللقطة" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(quickScreenshot).toBeFocused();
    for (let index = 0; index < HANDBOOK_PAGES.length; index++) {
      const item = HANDBOOK_PAGES[index];
      await book.getByRole("button", { name: "الفهرس", exact: true }).click();
      await book.getByRole("button", { name: new RegExp(item.title.replace("\n", " ").replace(/[.?]/g, "\\$&")) }).click();
      await expect(book.getByRole("heading", { name: item.title.replace("\n", " "), exact: true })).toBeVisible();
      if (item.image) {
        const img = book.locator(`img[src="/mv-handbook/${item.image}.jpg"]`).first();
        await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
      }
      assert.ok(await book.evaluate(node => node.scrollWidth <= node.clientWidth + 1), `overflow on ${item.id}`);
      if (index === 0 || item.id === "variables") await page.screenshot({ path: `test-results/mv-handbook/mobile-${item.id}.png` });
    }
    await book.getByRole("button", { name: "المباشرة بالعمل", exact: true }).click();
    await expect(book).toHaveCount(0);
    await page.getByRole("button", { name: "تبديل الحساب", exact: true }).click();
    await expect(book).toBeVisible();
    await expect(book.getByRole("checkbox", { name: "عدم الظهور مرة أخرى" })).not.toBeChecked();
    await expect(book.getByRole("button", { name: "ابدأ الاطلاع" })).toBeVisible();
    for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(viewport);
      const bounds = await book.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height);
      assert.ok(await book.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      for (const name of ["إغلاق الكتيب", "الفهرس", "ابدأ الاطلاع"]) {
        const button = await book.getByRole("button", { name, exact: true }).boundingBox();
        assert.ok(button && button.y >= 0 && button.y + button.height <= viewport.height, `${name} clipped at ${viewport.width}`);
      }
      await page.screenshot({ path: `test-results/mv-handbook/viewport-${viewport.width}.png` });
    }
    // Preferences from another tab stay synchronized without closing the reader.
    await page.setViewportSize({ width: 1440, height: 1000 });
    const sibling = await context.newPage();
    await sibling.goto(origin);
    await sibling.evaluate(() => localStorage.setItem("mv:handbook:hidden:reader-two", "1"));
    await expect(book.getByRole("checkbox", { name: "عدم الظهور مرة أخرى" })).toBeChecked();
    await sibling.evaluate(() => localStorage.removeItem("mv:handbook:hidden:reader-two"));
    await expect(book.getByRole("checkbox", { name: "عدم الظهور مرة أخرى" })).not.toBeChecked();
    await sibling.close();
    assert.deepEqual(errors, []);
    await context.close();

    const blocked = await browser.newContext();
    await blocked.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
      Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    });
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(origin);
    await blockedPage.getByRole("checkbox", { name: "عدم الظهور مرة أخرى" }).check();
    await expect(blockedPage.getByText("تعذر حفظ التفضيل؛ تحقق من السماح بتخزين بيانات الموقع.")).toBeVisible();
    await blockedPage.getByRole("button", { name: "إغلاق الكتيب", exact: true }).click();
    await blockedPage.getByRole("button", { name: "تبديل التحميل" }).click();
    await blockedPage.getByRole("button", { name: "تبديل التحميل" }).click();
    await blockedPage.waitForTimeout(800);
    await expect(blockedPage.getByRole("dialog")).toHaveCount(0);
    await blockedPage.getByRole("button", { name: "فتح كتيب استخدام نظام تقييم الآلات" }).click();
    await expect(blockedPage.getByRole("dialog")).toBeVisible();
    await blocked.close();

    // Onboarding waits for authentication and never interrupts another modal.
    for (const [param, release] of [["loading", "تبديل التحميل"], ["guest", "تبديل الحساب"], ["creating", "إغلاق إنشاء المشروع"], ["other-dialog", "إغلاق الإجراء الآخر"]]) {
      const isolated = await browser.newContext();
      const deferred = await isolated.newPage();
      await deferred.goto(`${origin}/?${param}=1`);
      await deferred.getByRole("heading", { name: "مشاريع تقييم الآلات" }).waitFor();
      await deferred.waitForTimeout(800);
      await expect(deferred.getByRole("dialog", { name: "كتيب استخدام نظام تقييم الآلات", exact: true })).toHaveCount(0);
      await deferred.getByRole("button", { name: release, exact: true }).click();
      await expect(deferred.getByRole("dialog", { name: "كتيب استخدام نظام تقييم الآلات", exact: true })).toBeVisible();
      await isolated.close();
    }

    // A failed screenshot must be recoverable without reloading the whole app.
    const offlineImage = await browser.newContext();
    const recovery = await offlineImage.newPage();
    await recovery.route("**/mv-handbook/projects.jpg", route => route.abort());
    await recovery.goto(origin);
    await recovery.getByRole("button", { name: "ابدأ الاطلاع", exact: true }).click();
    await expect(recovery.getByText("تعذر تحميل اللقطة. يمكنكم متابعة الخطوات المكتوبة.")).toBeVisible();
    await recovery.unroute("**/mv-handbook/projects.jpg");
    await recovery.getByRole("button", { name: "إعادة تحميل اللقطة" }).click();
    await expect.poll(() => recovery.locator('img[src="/mv-handbook/projects.jpg"]').first().evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    await offlineImage.close();
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
