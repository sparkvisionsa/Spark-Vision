import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, type Page } from "@playwright/test";
import postcss from "postcss";
import tailwind from "tailwindcss";
import tailwindConfig from "../tailwind.config";

const PHOTO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#7aa6c2"/><circle cx="400" cy="300" r="180" fill="#f2c14e"/></svg>';

type GalleryPage = {
  columns: number;
  rows: number;
  photos: number;
  /** Free space between the gallery and the bottom of the page body (px). */
  bottomGap: number;
  bodyHeight: number;
  overflow: number;
  photoHeights: number[];
  numbers: string[];
  fits: string[];
};

async function readGalleries(page: Page): Promise<GalleryPage[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-mv-report-sheet]"))
      .filter((sheet) => sheet.querySelector("[data-mv-asset-photo-grid]"))
      .map((sheet) => {
        const body = sheet.querySelector<HTMLElement>("[data-mv-report-page-content]")!;
        const grid = sheet.querySelector<HTMLElement>("[data-mv-asset-photo-grid]")!;
        const style = getComputedStyle(body);
        const bodyRect = body.getBoundingClientRect();
        const innerBottom = bodyRect.bottom - (parseFloat(style.paddingBottom) || 0);
        const photos = Array.from(grid.querySelectorAll<HTMLElement>("[data-mv-asset-photo]"));
        return {
          columns: Number(grid.dataset.columns),
          rows: Number(grid.dataset.rows),
          photos: photos.length,
          bottomGap: innerBottom - grid.getBoundingClientRect().bottom,
          bodyHeight: body.clientHeight,
          overflow: body.scrollHeight - body.clientHeight,
          photoHeights: photos.map((photo) => Math.round(photo.getBoundingClientRect().height)),
          numbers: Array.from(grid.querySelectorAll<HTMLElement>("[data-mv-asset-photo-number]")).map((n) => n.textContent ?? ""),
          fits: Array.from(grid.querySelectorAll<HTMLElement>("[data-mv-asset-photo-fit]")).map((n) => n.dataset.mvAssetPhotoFit ?? ""),
        };
      }),
  );
}

async function settle(page: Page, predicate: (pages: GalleryPage[]) => boolean, label: string) {
  let last: GalleryPage[] = [];
  for (let i = 0; i < 60; i += 1) {
    last = await readGalleries(page);
    if (last.length > 0 && predicate(last)) return last;
    await page.waitForTimeout(100);
  }
  assert.fail(`${label}: ${JSON.stringify(last.map(({ photoHeights, ...rest }) => ({ ...rest, h: photoHeights[0] })))}`);
}

test("asset-photo annex fills the page smartly, and PDF capture survives modern CSS colours", { timeout: 240_000 }, async () => {
  const bundle = await build({
    entryPoints: ["./tests/report-asset-photos-browser/fixture.tsx"],
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
        "tests/report-asset-photos-browser/fixture.tsx",
        "src/components/workspace/workspace-sections/machine-valuation/*.tsx",
        "src/components/system-template-summary-table.tsx",
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
    if (request.url?.startsWith("/photo.svg")) {
      response.setHeader("Content-Type", "image/svg+xml");
      response.end(PHOTO_SVG);
      return;
    }
    if (request.url?.startsWith("/app.js")) {
      response.setHeader("Content-Type", "text/javascript; charset=utf-8");
      response.end(bundle.outputFiles[0].contents);
      return;
    }
    const publicPath = request.url ? decodeURIComponent(request.url.split("?")[0]!) : "";
    if (/^\/[\w./-]+\.(png|jpe?g|svg|webp)$/.test(publicPath) && !publicPath.includes("..") && existsSync(`public${publicPath}`)) {
      response.setHeader("Content-Type", publicPath.endsWith(".svg") ? "image/svg+xml" : `image/${publicPath.split(".").pop()!.replace("jpg", "jpeg")}`);
      createReadStream(`public${publicPath}`).pipe(response);
      return;
    }
    if (request.url?.startsWith("/api/")) {
      response.statusCode = 404;
      response.setHeader("Content-Type", "application/json");
      response.end("{}");
      return;
    }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(
      '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>',
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
    await page.waitForSelector("[data-mv-asset-photo-grid]", { timeout: 30_000 });

    // --- PDF colour bug: html2canvas aborts on color()/color-mix() without the sanitizer.
    const raw = await page.evaluate(() => window.__captureColorProbe(false));
    assert.match(raw, /^error:.*unsupported color function/i, `unsanitized capture should reproduce the bug, got ${raw}`);
    const safe = await page.evaluate(() => window.__captureColorProbe(true));
    assert.match(safe, /^ok:/, safe);
    const [r, g, b] = safe.slice(3).split(",").map(Number);
    // 20% #0C447C mixed with white ≈ rgb(206, 218, 229): the colour is kept, not dropped.
    assert.ok(Math.abs(r - 206) <= 6 && Math.abs(g - 218) <= 6 && Math.abs(b - 229) <= 6, `probe colour ${safe}`);

    const mm = 96 / 25.4;

    // 12 photos, 9 per page (smart) → 2 pages, 3×3 grid filling the page body.
    let pages = await settle(page, (p) => p.length === 2 && p[0].photos === 9 && p[1].photos === 3, "9 per page");
    assert.deepEqual([pages[0].columns, pages[0].rows], [3, 3]);
    assert.ok(pages[0].bottomGap >= -1 && pages[0].bottomGap <= 10 * mm, `page fill gap ${pages[0].bottomGap}px`);
    assert.ok(pages.every((p) => p.overflow <= 2), "no gallery overflows its page");
    assert.equal(new Set(pages[0].photoHeights).size, 1, "every photo frame on a page has the same size");
    // The partly filled last page (3 photos) is re-planned to fill its page too.
    assert.ok(pages[1].bottomGap <= 10 * mm, `last page fill gap ${pages[1].bottomGap}px`);

    // 4 per page → 2×2 large photos filling the page, 3 pages.
    await page.evaluate(() => window.__setAssetOptions({ perPage: 4 }));
    pages = await settle(page, (p) => p.length === 3 && p[0].photos === 4, "4 per page");
    assert.deepEqual([pages[0].columns, pages[0].rows], [2, 2]);
    assert.ok(pages[0].bottomGap <= 10 * mm && pages[0].photoHeights[0] > 95 * mm, `2x2 frames ${pages[0].photoHeights[0]}px gap ${pages[0].bottomGap}`);

    // 2 per page → stacked full-width photos.
    await page.evaluate(() => window.__setAssetOptions({ perPage: 2 }));
    pages = await settle(page, (p) => p.length === 6 && p[0].photos === 2, "2 per page");
    assert.deepEqual([pages[0].columns, pages[0].rows], [1, 2]);
    assert.ok(pages[0].bottomGap <= 10 * mm);

    // 12 per page → all photos on one page (previously silently capped at 9).
    await page.evaluate(() => window.__setAssetOptions({ perPage: 12 }));
    pages = await settle(page, (p) => p.length === 1 && p[0].photos === 12, "12 per page");
    assert.equal(pages[0].columns * pages[0].rows >= 12, true);
    assert.ok(pages[0].bottomGap <= 10 * mm && pages[0].overflow <= 2);

    // 20 photos, 20 per page → one dense page, still inside A4.
    await page.evaluate(() => window.__setAssetOptions({ count: 20, perPage: 20 }));
    pages = await settle(page, (p) => p.length === 1 && p[0].photos === 20, "20 per page");
    assert.ok(pages[0].overflow <= 2 && pages[0].bottomGap <= 10 * mm, JSON.stringify(pages[0]));

    // Manual columns: 3 per row, 12 per page → 3×4 grid (no silent cap).
    await page.evaluate(() => window.__setAssetOptions({ count: 12, perPage: 12, auto: false, perRow: 3 }));
    pages = await settle(page, (p) => p.length === 1 && p[0].columns === 3 && p[0].photos === 12, "manual 3 per row");
    assert.equal(pages[0].rows, 4);
    assert.ok(pages[0].bottomGap <= 10 * mm);

    // Fit mode + numbering.
    await page.evaluate(() => window.__setAssetOptions({ auto: true, perPage: 6, fit: "contain", numbered: true }));
    pages = await settle(page, (p) => p.length === 2 && p[0].numbers.length === 6 && p[0].fits[0] === "contain", "contain + numbers");
    assert.deepEqual(pages[0].numbers, ["1", "2", "3", "4", "5", "6"]);
    assert.deepEqual(pages[1].numbers, ["7", "8", "9", "10", "11", "12"]);

    // Landscape page: grid is re-planned for the wide body and still fits.
    await page.locator("[data-mv-asset-photo]").first().hover();
    await page.getByRole("button", { name: "تدوير الصفحة" }).first().click();
    pages = await settle(
      page,
      (p) => p.length === 2 && p[0].columns >= 3 && p[0].photos === 6,
      "landscape",
    );
    assert.ok(pages[0].overflow <= 2 && pages[0].bottomGap <= 10 * mm, JSON.stringify(pages[0]));

    await mkdir("test-results/report-asset-photos", { recursive: true });
    await page.locator("[data-mv-report-sheet]:has([data-mv-asset-photo-grid])").first().screenshot({
      path: "test-results/report-asset-photos/landscape-6.png",
    });
    await page.evaluate(() => window.__setAssetOptions({ perPage: 9, fit: "cover", numbered: true }));
    await settle(page, (p) => p[0]?.photos === 9, "back to 9");
    await page.locator("[data-mv-report-sheet]:has([data-mv-asset-photo-grid])").nth(1).screenshot({
      path: "test-results/report-asset-photos/portrait-9.png",
    });

    // --- Export speed: each page clone is limited to that page, with identical pixels.
    await page.evaluate(() => window.__setAssetOptions({ count: 12, perPage: 2, fit: "cover", numbered: true }));
    await settle(page, (p) => p.length === 6, "6 photo pages");
    await page.evaluate(() => window.__setAppChrome(300));
    await page.waitForSelector("[data-testid=app-chrome] > div:nth-child(300)");
    const sample = 4;
    const full = await page.evaluate((n) => window.__benchmarkCapture(false, 1, n), sample);
    const scoped = await page.evaluate((n) => window.__benchmarkCapture(true, 1, n), sample);
    assert.equal(scoped.sheets, sample);
    // Same page content: at most sub-pixel anti-aliasing of a hairline differs
    // (the page sits at a whole-pixel offset in the scoped clone).
    const diffs = await page.evaluate(() => window.__compareCaptures());
    for (const diff of diffs) {
      assert.ok(diff.differing / diff.total < 0.0005, `page capture differs: ${JSON.stringify(diff)}`);
    }
    const all = await page.evaluate(() => window.__benchmarkCapture(true, 1));
    console.log(
      `capture of ${sample} pages: full-document clone ${full.ms}ms, page-scoped clone ${scoped.ms}ms; whole report (${all.sheets} pages) scoped ${all.ms}ms`,
    );
    assert.ok(scoped.ms * 2 < full.ms, `scoped ${scoped.ms}ms should be far faster than full ${full.ms}ms`);

    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
