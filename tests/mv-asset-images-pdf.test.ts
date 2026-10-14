import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import type { MvAssetImagesPdfProgress } from "../src/lib/mv-asset-images-pdf";

test("selected-image PDF reports real progress, downloads and handles failed images", { timeout: 120_000 }, async () => {
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), contents: `
      import { buildAssetImagesPdf } from "./src/lib/mv-asset-images-pdf";
      window.buildPdf = buildAssetImagesPdf;
    ` },
    bundle: true, write: false, platform: "browser", format: "iife",
  });
  const server = createServer((req, res) => {
    if (req.url === "/app.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(bundle.outputFiles[0].text);
    } else if (req.url === "/missing.jpg") {
      res.statusCode = 404;
      res.end();
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end('<script src="/app.js"></script>');
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    // tsx preserves function names in serialized page.evaluate callbacks.
    await page.addInitScript("window.__name = (fn) => fn;");
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
    const downloadPromise = page.waitForEvent("download");
    // Keep cleanup from masking the original evaluate error with a rejected waiter.
    void downloadPromise.catch(() => undefined);
    const result = await page.evaluate(async () => {
      const buildPdf = (window as unknown as { buildPdf: typeof import("../src/lib/mv-asset-images-pdf").buildAssetImagesPdf }).buildPdf;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 40;
      canvas.getContext("2d")!.fillRect(0, 0, 40, 40);
      const url = canvas.toDataURL("image/png");
      const progress: MvAssetImagesPdfProgress[] = [];
      const pdf = await buildPdf({ filenameBase: "selected", sources: [
        { url, name: "first.png" }, { url: "/missing.jpg", name: "missing.jpg" }, { url, name: "second.png" },
      ], onProgress: value => progress.push(value) });
      const failedProgress: MvAssetImagesPdfProgress[] = [];
      let failure = "";
      try {
        await buildPdf({ filenameBase: "failed", sources: [{ url: "/missing.jpg", name: "missing.jpg" }], onProgress: value => failedProgress.push(value) });
      } catch (error) { failure = (error as Error).message; }
      return { progress, failedProgress, failure, count: pdf.imageCount, failures: pdf.failedNames, header: await pdf.blob.slice(0, 5).text() };
    });
    assert.equal((await downloadPromise).suggestedFilename(), "selected-report-images.pdf");
    assert.equal(result.header, "%PDF-");
    assert.equal(result.count, 2);
    assert.deepEqual(result.failures, ["missing.jpg"]);
    assert.equal(result.progress[0].percent, 0);
    assert.deepEqual([...new Set(result.progress.map(row => row.stage))], ["loading", "converting", "saving", "complete"]);
    assert.ok(result.progress.every((row, i, rows) => row.percent >= (rows[i - 1]?.percent ?? 0)));
    assert.deepEqual(result.progress.at(-1), { stage: "complete", percent: 100, completed: 2, total: 2, failed: 1 });
    assert.equal(result.failure, "report_images_could_not_be_loaded");
    assert.ok(result.failedProgress.every(row => row.percent < 100));
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
