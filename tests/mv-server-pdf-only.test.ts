import assert from "node:assert/strict";
import test from "node:test";
import { mergePptxReportTemplateViaServer } from "../src/lib/mv-pptx-template/server-merge";
import { mergeWordReportTemplateViaServer } from "../src/lib/mv-word-template/server-merge";

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

test("Word PDF preview requests and consumes only the PDF stream", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    });
    return new Response(PDF_BYTES, {
      status: 201,
      headers: { "Content-Type": "application/pdf" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await mergeWordReportTemplateViaServer({
    projectId: "project-1",
    mergeInput: {
      projectName: "Report",
      reportData: {},
      assetImages: [],
      valuationImages: [],
      clientImages: [],
    },
    assetImageUrls: [],
    valuationImageUrls: [],
    clientImageUrls: [],
    alsoPdf: true,
    pdfOnly: true,
    useStoredProjectState: true,
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "/api/mv/projects/project-1/word-template/merge");
  assert.equal(requests[0]?.body.pdfOnly, true);
  assert.equal(result.blob.size, 0);
  assert.equal(result.pdfSource, "server");
  assert.ok(result.pdfBlob);
  assert.deepEqual(new Uint8Array(await result.pdfBlob.arrayBuffer()), PDF_BYTES);
});

test("PowerPoint PDF preview requests and consumes only the PDF stream", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    });
    return new Response(PDF_BYTES, {
      status: 201,
      headers: { "Content-Type": "application/pdf" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await mergePptxReportTemplateViaServer({
    projectId: "project-1",
    alsoPdf: true,
    pdfOnly: true,
    useStoredProjectState: true,
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "/api/mv/projects/project-1/pptx-template/merge");
  assert.equal(requests[0]?.body.pdfOnly, true);
  assert.equal(result.blob.size, 0);
  assert.equal(result.pdfSource, "server");
  assert.ok(result.pdfBlob);
  assert.deepEqual(new Uint8Array(await result.pdfBlob.arrayBuffer()), PDF_BYTES);
});
