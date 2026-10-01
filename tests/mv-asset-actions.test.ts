import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

test("asset menus stay visible, scrollable and clickable across viewport sizes", { timeout: 180_000 }, async (t) => {
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { DropdownMenu, DropdownMenuTrigger, DropdownMenuItem } from "./src/components/ui/dropdown-menu";
      import { MvAssetActionsContent } from "./src/components/workspace/workspace-sections/machine-valuation/mv-asset-actions-content";
      function App() {
        const [count, setCount] = React.useState(0);
        return <div dir="rtl" style={{position: "absolute", inset: 8, overflow: "hidden"}}>
          <output data-testid="count">{count}</output>
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger style={{position: "absolute", top: 8, right: 8, width: 36, height: 36}}
              aria-label="Actions">...</DropdownMenuTrigger>
            <MvAssetActionsContent align="end" style={{width: 208, background: "white"}}>
              {Array.from({length: 14}, (_, i) => <DropdownMenuItem key={i}
                style={{padding: 12}} onSelect={() => setCount(v => v + 1)}>Action {i + 1}</DropdownMenuItem>)}
            </MvAssetActionsContent>
          </DropdownMenu>
        </div>;
      }
      createRoot(document.getElementById("root")!).render(<App />);
    ` },
    bundle: true, write: false, platform: "browser", format: "esm", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{ name: "omit-decorative-icons", setup(builder) {
      builder.onResolve({ filter: /^lucide-react$/ }, () => ({ path: "icons", namespace: "test-icons" }));
      builder.onLoad({ filter: /.*/, namespace: "test-icons" }, () => ({
        contents: "export const Check = () => null; export const ChevronRight = Check; export const Circle = Check;",
      }));
    } }],
  });
  t.diagnostic("Menu browser fixture bundled");
  const server = createServer((req, res) => {
    if (req.url === "/app.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(bundle.outputFiles[0].text);
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end('<div id="root"></div><script type="module" src="/app.js"></script>');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    t.diagnostic("Chromium launched");
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const address = server.address() as { port: number };
    await page.goto(`http://127.0.0.1:${address.port}`);
    let clicks = 0;
    for (const viewport of [{ width: 320, height: 420 }, { width: 768, height: 600 },
      { width: 1280, height: 600 }, { width: 1536, height: 220 }]) {
      await page.setViewportSize(viewport);
      await page.getByRole("button", { name: "Actions" }).click();
      const menu = page.getByRole("menu");
      await menu.waitFor({ state: "visible" });
      await page.waitForFunction(() => {
        const menu = document.querySelector('[role="menu"]')!;
        return menu.getBoundingClientRect().height <= innerHeight - 16;
      });
      const rect = (await menu.boundingBox())!;
      assert.ok(rect.x >= 0 && rect.x + rect.width <= viewport.width, JSON.stringify(rect));
      assert.ok(rect.y >= 0 && rect.y + rect.height <= viewport.height, JSON.stringify(rect));
      assert.ok(await menu.evaluate((el) => el.scrollHeight > el.clientHeight));
      await page.getByRole("menuitem", { name: "Action 14", exact: true }).click();
      await page.waitForFunction((n) => document.querySelector("output")?.textContent === String(n), ++clicks);
      await page.getByRole("button", { name: "Actions" }).focus();
      await page.keyboard.press("ArrowDown");
      await menu.waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await menu.waitFor({ state: "hidden" });
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
