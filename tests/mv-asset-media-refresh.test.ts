import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import ts from "typescript";

test("visible asset cards refresh without reload when socket events are missed, including removal and reconnect", { timeout: 90_000 }, async () => {
  const script = ts.transpileModule(readFileSync("src/lib/mv-asset-media-refresh.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  let revision = "empty", image = "", reads = 0, failRefresh = false;
  const server = createServer((req, res) => {
    if (req.url === "/watch.js") { res.setHeader("Content-Type", "text/javascript"); res.end(script); return; }
    if (req.url?.endsWith("/asset-media-revision")) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ revision })); return; }
    if (req.url === "/cards") { reads++; res.setHeader("Content-Type", "application/json"); if (failRefresh) { failRefresh = false; res.statusCode = 503; } res.end(JSON.stringify({ image })); return; }
    res.setHeader("Content-Type", "text/html");
    res.end(`<div id="card"></div><script type="module">import {watchAssetMediaRevision} from '/watch.js';
      window.stop = watchAssetMediaRevision('project', async () => { const response=await fetch('/cards'); if (!response.ok) return false; const row=await response.json(); document.querySelector('#card').textContent=row.image || 'no images'; }, 100);</script>`);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext(), page = await context.newPage();
    let navigations = 0; page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations++; });
    await page.goto(`http://127.0.0.1:${(server.address() as any).port}`);
    const shows = (text: string) => page.waitForFunction(text => document.querySelector("#card")?.textContent === text, text);
    await shows("no images");
    const before = reads; await page.waitForTimeout(350); assert.equal(reads, before, "unchanged media does not reload the folder tree");
    image = "main.png"; revision = "main"; await shows("main.png");
    image = "brand.png"; revision = "same-count-replacement"; await shows("brand.png");
    image = ""; revision = "removed"; await shows("no images");
    const beforeRetry = reads; failRefresh = true; image = "details.png"; revision = "retry-refresh";
    await shows("details.png"); assert.equal(reads, beforeRetry + 2, "a failed card refresh does not acknowledge the new revision");
    await context.setOffline(true); image = "other.png"; revision = "offline-change";
    await page.waitForTimeout(250); await context.setOffline(false); await shows("other.png");
    assert.equal(navigations, 1, "all updates occurred without a page reload");
    await page.evaluate(() => (window as any).stop());
    const stoppedReads = reads; image = "later.png"; revision = "unmounted";
    await page.waitForTimeout(350); assert.equal(reads, stoppedReads);
  } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
