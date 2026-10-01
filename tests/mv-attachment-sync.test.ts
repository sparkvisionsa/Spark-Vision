import assert from "node:assert/strict";
import test from "node:test";
import { attachmentImageCount, fetchAttachmentSnapshot, watchAttachmentSnapshot } from "../src/lib/mv-attachment-sync";

test("attachment counts accept legacy JSON, ignore unusable rows and honor deletion to zero", () => {
  const images = [{ id: "a", fileId: "file-a", includeInReport: false }, { id: "b", dataUrl: "data:image/png;base64,a" }, { id: "a", fileId: "file-a" }, { id: "broken" }, { id: "empty", fileId: "  " }, { id: "invalid", fileId: true }, null];
  assert.equal(attachmentImageCount({ images }), 2);
  assert.equal(attachmentImageCount(JSON.stringify({ images })), 2);
  assert.equal(attachmentImageCount({ images: [] }), 0);
  assert.equal(attachmentImageCount(null), 0);
});

test("refreshes coalesce events without losing updates during in-flight requests or local edits", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  const requests: Array<(count: number) => void> = [];
  globalThis.fetch = (async () => new Promise<Response>(resolve => {
    requests.push(count => resolve(Response.json({ project: { _id: "project", clientDocumentsWorkspace: {
      images: Array.from({ length: count }, (_, i) => ({ id: String(i), fileId: String(i) })),
    } } })));
  })) as typeof fetch;
  const received: number[] = [];
  let editing = false;
  const stop = watchAttachmentSnapshot("project", snapshot => {
    if (editing) return false;
    received.push(attachmentImageCount(snapshot.clientDocumentsWorkspace));
  });
  const delay = () => new Promise(resolve => setTimeout(resolve, 380));
  const changed = () => win.dispatchEvent(new CustomEvent("sv:resource-changed", { detail: { resource: "mv", projectId: "project" } }));
  try {
    const shared = fetchAttachmentSnapshot("project");
    assert.equal(requests.length, 1);
    changed(); changed();
    await delay(); // The event arrived while the initial fetch was still running.
    requests[0](1); await shared;
    await delay();
    assert.equal(requests.length, 2);
    requests[1](2); await delay();
    assert.deepEqual(received, [1, 2]);
    editing = true; changed(); await delay(); requests[2](3); await delay();
    assert.deepEqual(received, [1, 2]);
    editing = false; win.dispatchEvent(new Event("online")); await delay(); requests[3](3); await delay();
    assert.deepEqual(received, [1, 2, 3]);
    changed(); await delay(); requests[4](0); await delay();
    assert.deepEqual(received, [1, 2, 3, 0]);
    stop(); changed(); await delay(); assert.equal(requests.length, 5);
  } finally {
    stop(); globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else delete (globalThis as any).window;
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else delete (globalThis as any).document;
  }
});
