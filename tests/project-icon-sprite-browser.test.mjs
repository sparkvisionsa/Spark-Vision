import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import dynamicIconImports from "lucide-react/dynamicIconImports";

test("project icons remain available from the complete Lucide sprite", async () => {
  const sprite = await readFile(new URL("../public/project-icons.svg", import.meta.url));
  const manifest = await readFile(new URL("../src/lib/project-icon-names.ts", import.meta.url), "utf8");
  const symbols = [...sprite.toString().matchAll(/<symbol id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(symbols.length, Object.keys(dynamicIconImports).length);
  assert.deepEqual(symbols, JSON.parse(manifest.match(/= (\[[^\n]+\]) as const;/)?.[1] ?? "[]"));
  assert.equal(new Set(symbols).size, symbols.length);
  assert.ok(symbols.includes("heater"));
  assert.ok(symbols.includes("activity-square"));

  const server = createServer((request, response) => {
    if (request.url === "/project-icons.svg") {
      response.writeHead(200, { "content-type": "image/svg+xml" });
      response.end(sprite);
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="/project-icons.svg#heater"/></svg><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="/project-icons.svg#activity-square"/></svg>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const iconResponse = page.waitForResponse((response) => response.url().endsWith("/project-icons.svg"));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await iconResponse;
    await assert.doesNotReject(async () => {
      await page.waitForFunction(() => [...document.querySelectorAll("use")].length === 2 && [...document.querySelectorAll("use")].every((icon) => icon.getBBox().width > 0));
    });
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
