import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import ts from "typescript";

function twoPagePdf() {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 120] /Resources << >> /Contents 5 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 120] /Resources << >> /Contents 5 0 R >>",
    "<< /Length 24 >>\nstream\n0 0 1 rg 10 10 90 90 re f\nendstream"];
  let text = "%PDF-1.4\n";
  const offsets = objects.map((body, index) => { const offset = text.length; text += `${index + 1} 0 obj\n${body}\nendobj\n`; return offset; });
  const xref = text.length;
  text += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return text;
}

test("real PDF conversion resumes its durable pages and final report acknowledgement after reload", { timeout: 180_000 }, async () => {
  const transpile = (path: string) => ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const base = "src/components/workspace/workspace-sections/machine-valuation/";
  const queue = transpile("src/lib/mv-background-uploads.ts");
  const worker = transpile("src/lib/mv-attachment-upload-worker.ts")
    .replaceAll("@/components/workspace/workspace-sections/machine-valuation/mv-pdf-page-images", "/pdf-utils.js")
    .replaceAll("@/components/workspace/workspace-sections/machine-valuation/mv-project-gridfs-upload", "/upload-utils.js")
    .replaceAll("pdfjs-dist/legacy/build/pdf.mjs", "/pdf.mjs")
    .replaceAll("pdfjs-dist/legacy/build/pdf.worker.min.mjs", "/pdf.worker.mjs");
  const modules: Record<string, string> = { "/queue.js": queue, "/worker.js": worker,
    "/pdf-utils.js": transpile(base + "mv-pdf-page-images.ts"),
    "/upload-utils.js": transpile(base + "mv-project-gridfs-upload.ts").replaceAll("./mv-i18n", "/i18n.js"),
    "/i18n.js": 'export const readMvLanguage=()=>"en"; export const getMvT=()=>key=>key;',
    "/pdf.mjs": readFileSync("node_modules/pdfjs-dist/legacy/build/pdf.mjs", "utf8"),
    "/pdf.worker.mjs": readFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", "utf8"),
  };
  const calls = new Map<string, number>();
  let originalCalls = 0, losePageReply = true, loseCompletionReply = true, completed = 0;
  const server = createServer(async (req, res) => {
    if (modules[req.url!]) { res.setHeader("Content-Type", "text/javascript"); res.end(modules[req.url!]); return; }
    if (req.url?.includes("/attachment-jobs/")) {
      let data = ""; for await (const chunk of req) data += chunk.toString();
      res.setHeader("Content-Type", "application/json");
      if (req.url.includes("/original/")) { originalCalls++; res.end('{"fileId":"original"}'); return; }
      if (req.url.endsWith("/pages")) {
        const metadata = JSON.parse(/name="metadata"\r\n\r\n([^\r]+)/.exec(data)![1]);
        const imageId = `${metadata.source.id}-page-${metadata.image.autoPageIndex}`;
        calls.set(imageId, (calls.get(imageId) ?? 0) + 1);
        if (metadata.image.autoPageIndex === 2 && losePageReply) {
          losePageReply = false; res.statusCode = 503; res.end('{"message":"Lost page acknowledgement"}'); return;
        }
        res.end(JSON.stringify({ imageId, fileId: imageId })); return;
      }
      if (req.url.endsWith("/complete")) {
        if (loseCompletionReply) { loseCompletionReply = false; res.statusCode = 503; res.end('{"message":"Lost completion acknowledgement"}'); return; }
        completed++;
      }
      res.end('{"ok":true}'); return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end('<script type="module">import * as queue from "/queue.js"; import {processAttachment} from "/worker.js"; queue.registerAttachmentProcessor(processAttachment); window.queue=queue;</script>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${(server.address() as any).port}`);
    await page.waitForFunction(() => !!(window as any).queue);
    await page.evaluate(async pdf => {
      const q = (window as any).queue; q.setUploadAccount("owner:company");
      await q.enqueueUpload({ owner: "owner:company", projectId: "project", label: "Two page PDF", parentId: "", folders: [],
        attachment: { field: "clientDocumentsWorkspace" }, items: [{ file: new File([pdf], "nested.pdf", { type: "application/pdf" }), name: "nested.pdf", path: "folder/nested.pdf" }] });
    }, twoPagePdf());
    const waitForState = async (state: string) => {
      try { await page.waitForFunction(state => (window as any).queue.getUploads()[0]?.state === state, state, { timeout: 60_000 }); }
      catch (error) { console.error(errors, await page.evaluate(() => (window as any).queue.getUploads())); throw error; }
    };
    const blobCount = () => page.evaluate(() => new Promise<number>(resolve => {
      const open = indexedDB.open("sv-mv-upload-outbox");
      open.onsuccess = () => { const count = open.result.transaction("files").objectStore("files").count(); count.onsuccess = () => resolve(count.result); };
    }));
    await waitForState("waiting");
    assert.equal(calls.size, 2);
    assert.equal(await blobCount(), 3, "original and both converted pages remain until final acknowledgement");
    await page.reload(); await page.waitForFunction(() => !!(window as any).queue);
    await page.evaluate(async () => { const q = (window as any).queue; q.setUploadAccount("owner:company"); });
    await page.waitForFunction(() => (window as any).queue.getUploads().length === 1);
    await page.evaluate(async () => { const q = (window as any).queue; await q.retryUpload(q.getUploads()[0].id); });
    await page.waitForFunction(() => (window as any).queue.getUploads()[0]?.error === "Lost completion acknowledgement");
    assert.deepEqual([...calls.values()].sort(), [1, 2]);
    assert.equal(originalCalls, 1);
    assert.equal(await blobCount(), 3);
    await page.reload(); await page.waitForFunction(() => !!(window as any).queue);
    await page.evaluate(() => (window as any).queue.setUploadAccount("owner:company"));
    await page.waitForFunction(() => (window as any).queue.getUploads().length === 1);
    await page.evaluate(async () => { const q = (window as any).queue; await q.retryUpload(q.getUploads()[0].id); });
    await waitForState("done");
    assert.equal(completed, 1); assert.equal(originalCalls, 1);
    assert.deepEqual([...calls.values()].sort(), [1, 2], "completed pages are not uploaded again during final verification");
    assert.equal(await blobCount(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
