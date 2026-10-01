import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import ts from "typescript";

test("durable outbox resumes a lost acknowledgement, preserves folders, isolates accounts and coordinates tabs", { timeout: 120_000 }, async () => {
  const script = ts.transpileModule(readFileSync("src/lib/mv-background-uploads.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const received = new Map<string, number>();
  let loseReply = true;
  let folderCalls = 0;
  let failureStatus = 0;
  const server = createServer(async (req, res) => {
    if (req.url === "/queue.js") { res.setHeader("Content-Type", "text/javascript"); res.end(script); return; }
    if (req.url?.includes("/subprojects")) {
      folderCalls++;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ _id: `folder-${folderCalls}`, picAsset: { _id: `asset-${folderCalls}` } })); return;
    }
    if (req.url?.includes("/asset-image-files")) {
      let data = "";
      for await (const chunk of req) data += chunk.toString();
      const key = /name="uploadKeys"\r\n\r\n([^\r]+)/.exec(data)?.[1];
      assert.ok(key);
      if (failureStatus) { res.writeHead(failureStatus, { "Content-Type": "application/json" }); res.end('{"message":"Access denied"}'); return; }
      received.set(key, (received.get(key) ?? 0) + 1);
      if (loseReply) { loseReply = false; res.writeHead(503, { "Content-Type": "application/json" }); res.end('{"message":"Response lost after save"}'); return; }
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify([{ _id: key }])); return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end('<script type="module">import * as queue from "/queue.js"; window.queue = queue;</script>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const url = `http://127.0.0.1:${address.port}`;
    await page.goto(url);
    await page.waitForFunction(() => Boolean((window as any).queue));
    await page.evaluate(async () => {
      const q = (window as any).queue;
      q.setUploadAccount("owner:company");
      await q.enqueueUpload({ owner: "owner:company", projectId: "project", label: "Nested folders", parentId: "root",
        folders: [{ key: "parent", name: "parent", kind: "folder" }, { key: "asset", parentKey: "parent", name: "asset", kind: "asset" }],
        items: Array.from({ length: 3 }, (_, index) => ({ file: new File(["image-data"], `${index}.png`, { type: "image/png" }), name: `${index}.png`, path: `asset/${index}.png`, folderKey: "asset" })),
      });
    });
    await page.waitForFunction(() => (window as any).queue.getUploads()[0]?.state === "waiting").catch(async error => {
      console.error(await page.evaluate(() => (window as any).queue.getUploads()));
      throw error;
    });
    assert.equal(received.size, 3);
    assert.equal(folderCalls, 2);
    // A real reload discards every JS closure, including the selected File objects.
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).queue));
    await page.evaluate(() => (window as any).queue.setUploadAccount("different:company"));
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => (window as any).queue.getUploads().length), 0);
    assert.deepEqual([...received.values()], [1, 1, 1]);
    const second = await context.newPage();
    await second.goto(url);
    await second.waitForFunction(() => Boolean((window as any).queue));
    await Promise.all([page, second].map(tab => tab.evaluate(() => (window as any).queue.setUploadAccount("owner:company"))));
    await page.waitForFunction(() => (window as any).queue.getUploads()[0]?.state === "done", { timeout: 20_000 });
    assert.equal(folderCalls, 2, "persisted folder receipts prevent recreation");
    assert.equal(received.size, 3, "retry uses the original image key");
    assert.deepEqual([...received.values()].sort(), [1, 1, 2], "completed files are not repeated; only one tab retries the lost acknowledgement");
    const remainingBlobs = await page.evaluate(() => new Promise<number>((resolve, reject) => {
      const open = indexedDB.open("sv-mv-upload-outbox");
      open.onsuccess = () => { const count = open.result.transaction("files").objectStore("files").count(); count.onsuccess = () => resolve(count.result); count.onerror = reject; };
    }));
    assert.equal(remainingBlobs, 0);
    failureStatus = 403;
    await page.evaluate(async () => {
      const q = (window as any).queue;
      await q.enqueueUpload({ owner: "owner:company", projectId: "project", label: "Denied", parentId: "root", folders: [],
        items: [{ file: new File(["two"], "two.png"), name: "two.png", path: "two.png", assetId: "asset" }] });
    });
    await page.waitForFunction(() => (window as any).queue.getUploads().some((job: any) => job.state === "error"));
    failureStatus = 0;
    await page.evaluate(async () => {
      const q = (window as any).queue;
      await q.retryUpload(q.getUploads().find((job: any) => job.state === "error").id);
    });
    await page.waitForFunction(() => (window as any).queue.getUploads().every((job: any) => job.state === "done"));
    assert.equal(received.size, 4);
    await context.close();
  } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
