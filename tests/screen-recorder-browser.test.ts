import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

test("screen recording remains live when its conversation closes and saves the captured screen", { timeout: 90_000 }, async () => {
  const bundle = await build({
    entryPoints: ["tests/screen-recorder-browser/fixture.tsx"],
    bundle: true,
    write: false,
    jsx: "automatic",
    platform: "browser",
  });
  const script = bundle.outputFiles[0]!.contents;
  const server = createServer((request, response) => {
    if (request.url === "/app.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(script);
      return;
    }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html><meta charset="utf-8"><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.evaluate(`(() => {
      navigator.mediaDevices.getDisplayMedia = async (options) => {
        window.captureOptions = options;
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const context = canvas.getContext("2d");
        let frame = 0;
        window.setInterval(() => {
          context.fillStyle = frame++ % 2 ? "#2563eb" : "#0f172a";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }, 100);
        const stream = canvas.captureStream(10);
        const track = stream.getVideoTracks()[0];
        const getSettings = track.getSettings.bind(track);
        track.getSettings = () => ({ ...getSettings(), displaySurface: window.selectedSurface || "monitor" });
        return stream;
      };
    })()`);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.locator("[data-state]")).toHaveText("recording");
    const options = await page.evaluate(() => (window as Window & { captureOptions?: DisplayMediaStreamOptions }).captureOptions);
    assert.equal((options?.video as { displaySurface?: string })?.displaySurface, "monitor");
    assert.equal((options as DisplayMediaStreamOptions & { preferCurrentTab?: boolean }).preferCurrentTab, false);
    await page.getByRole("button", { name: "Close conversation" }).click();
    await expect(page.getByRole("button", { name: "Close conversation" })).toHaveCount(0);
    await expect(page.locator("[data-state]")).toHaveText("recording");
    await page.waitForTimeout(1100);
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.locator("[data-state]")).toHaveText("preview");
    assert.ok(Number(await page.locator("[data-size]").textContent()) > 0);
    await page.getByRole("button", { name: "Reset" }).click();
    await page.evaluate("window.selectedSurface = 'browser'");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.locator("[data-error]")).toContainText("الشاشة بأكملها");
    await expect(page.locator("[data-state]")).toHaveText("idle");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
