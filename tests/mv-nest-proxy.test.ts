import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxyMvPathToNest } from "../src/lib/mv-nest-proxy";

test("MV proxy streams a generated report larger than a serverless payload limit", async (t) => {
  const firstChunk = Buffer.alloc(64 * 1024, 0x61);
  const remainder = Buffer.alloc(13 * 1024 * 1024 - firstChunk.length, 0x62);
  const report = Buffer.concat([firstChunk, remainder]);
  let markFirstChunkSent!: () => void;
  const firstChunkSent = new Promise<void>((resolve) => {
    markFirstChunkSent = resolve;
  });
  let releaseRemainder!: () => void;
  const remainderReleased = new Promise<void>((resolve) => {
    releaseRemainder = resolve;
  });
  let hasReleasedRemainder = false;
  const finishReport = () => {
    if (hasReleasedRemainder) return;
    hasReleasedRemainder = true;
    releaseRemainder();
  };
  const upstream = createServer((request, response) => {
    assert.equal(request.url, "/api/mv/projects/project-1/pptx-template/merge");
    response.writeHead(201, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Length": String(report.length),
      "Content-Disposition": 'attachment; filename="report.pptx"',
    });
    response.write(firstChunk);
    markFirstChunkSent();
    void remainderReleased.then(() => response.end(remainder));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  assert.ok(address && typeof address !== "string");
  const previousOrigin = process.env.MV_INTERNAL_API_ORIGIN;
  process.env.MV_INTERNAL_API_ORIGIN = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    finishReport();
    if (previousOrigin === undefined) delete process.env.MV_INTERNAL_API_ORIGIN;
    else process.env.MV_INTERNAL_API_ORIGIN = previousOrigin;
    await new Promise<void>((resolve, reject) =>
      upstream.close((error) => (error ? reject(error) : resolve())),
    );
  });

  const request = new NextRequest(
    "http://frontend.test/api/mv/projects/project-1/pptx-template/merge",
    { method: "POST" },
  );
  const proxiedResponse = proxyMvPathToNest(request, [
    "projects",
    "project-1",
    "pptx-template",
    "merge",
  ]);
  await firstChunkSent;
  let readinessTimeout: ReturnType<typeof setTimeout> | undefined;
  const response = await Promise.race([
    proxiedResponse,
    new Promise<never>((_resolve, reject) => {
      readinessTimeout = setTimeout(
        () => reject(new Error("proxy buffered the response instead of streaming it")),
        1_000,
      );
    }),
  ]).finally(() => {
    if (readinessTimeout) clearTimeout(readinessTimeout);
  });

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("content-length"), null);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("x-accel-buffering"), "no");
  assert.ok(response.body);
  const reader = response.body.getReader();
  const firstRead = await reader.read();
  assert.equal(firstRead.done, false);
  assert.deepEqual(Buffer.from(firstRead.value).subarray(0, 8), firstChunk.subarray(0, 8));

  // The upstream deliberately withholds the remaining ~13MB. Releasing it
  // only after a browser-readable chunk proves this is a stream, not a buffer.
  finishReport();
  const receivedChunks = [Buffer.from(firstRead.value)];
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    receivedChunks.push(Buffer.from(next.value));
  }
  const received = Buffer.concat(receivedChunks);
  assert.equal(received.length, report.length);
  assert.deepEqual(received.subarray(0, 8), report.subarray(0, 8));
});
