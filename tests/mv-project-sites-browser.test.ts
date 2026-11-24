import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { build, type Plugin } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwind from "tailwindcss";
import tailwindConfig from "../tailwind.config";

const stubs: Plugin = {
  name: "mv-project-sites-stubs",
  setup(api) {
    api.onResolve({ filter: /use-product-permissions$/ }, () => ({ path: "permissions", namespace: "stub" }));
    api.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export function useProductPermissions(){ return { can: () => true, loading: false } }",
      loader: "js",
    }));
  },
};

type SiteFile = { id: string; name: string; type: string; url: string; uploadedBy: string; createdAt: string; sizeBytes: number; locationIds?: string[] };
type Site = { id: string; name?: string; primaryPhone?: string; region: string; city: string };

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPhfDwAEhQG0E8Ln1gAAAABJRU5ErkJggg==",
  "base64",
);

const readBody = (request: IncomingMessage) =>
  new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("inspection sites: autosave, files attached inside each site without saving first", { timeout: 180_000 }, async () => {
  // ---- a backend with the same rules as the Nest service ----
  let sites: Site[] = [{ id: "site-a", name: "المصنع", region: "", city: "" }];
  let files: SiteFile[] = [
    { id: "f1", name: "الواجهة.png", type: "image", url: "", uploadedBy: "u", createdAt: "2026-01-01", sizeBytes: 2048, locationIds: ["site-a"] },
    { id: "g1", name: "عقد.pdf", type: "pdf", url: "", uploadedBy: "u", createdAt: "2026-01-01", sizeBytes: 4096 },
  ];
  const sitePatches: Site[][] = [];
  const uploads: { name: string; siteIds: string[] }[] = [];
  let active = 0;
  let maxActive = 0;
  let failedOnce = false;

  const bundle = await build({
    entryPoints: ["tests/mv-project-sites-browser/fixture.tsx"],
    bundle: true,
    write: false,
    jsx: "automatic",
    platform: "browser",
    define: { process: JSON.stringify({ env: { NODE_ENV: "test" } }) },
    plugins: [stubs],
  });
  const css = await postcss([
    tailwind({
      ...tailwindConfig,
      content: [
        "tests/mv-project-sites-browser/fixture.tsx",
        "src/components/workspace/workspace-sections/machine-valuation/mv-project-sites-editor.tsx",
        "src/components/workspace/workspace-sections/machine-valuation/mv-inspection-locations-fields.tsx",
        "src/components/ui/*.tsx",
      ],
    }),
  ]).process(await readFile("src/app/globals.css", "utf8"), { from: "src/app/globals.css" });

  const json = (response: import("node:http").ServerResponse, status: number, body: unknown) => {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(body));
  };

  const server = createServer(async (request, response) => {
    const url = request.url ?? "/";
    if (url === "/app.css") {
      response.setHeader("Content-Type", "text/css; charset=utf-8");
      response.end(css.css);
      return;
    }
    if (url.startsWith("/app.js")) {
      response.setHeader("Content-Type", "text/javascript; charset=utf-8");
      response.end(bundle.outputFiles[0].contents);
      return;
    }
    if (url === "/api/locations/regions") return json(response, 200, [{ id: "r1", titleAr: "منطقة الرياض", titleEn: "Riyadh" }]);
    if (url === "/api/locations/cities") return json(response, 200, [{ id: "c1", regionId: "r1", titleAr: "الرياض", titleEn: "Riyadh" }]);
    if (url === "/api/mv/projects/p1/locations" && request.method === "PATCH") {
      const body = JSON.parse((await readBody(request)).toString("utf8")) as { locations: Site[] };
      await sleep(120);
      sites = body.locations;
      sitePatches.push(sites);
      const kept = new Set(sites.map((site) => site.id));
      files = files.map((file) =>
        file.locationIds ? { ...file, locationIds: file.locationIds.filter((id) => kept.has(id)) } : file,
      );
      return json(response, 200, { ok: true, locations: sites, contacts: [], inspectorFiles: files, updatedAt: new Date().toISOString() });
    }
    if (url === "/api/mv/projects/p1/inspectorFiles" && request.method === "POST") {
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        const body = (await readBody(request)).toString("latin1");
        const name = Buffer.from(/filename="([^"]+)"/.exec(body)?.[1] ?? "file", "latin1").toString("utf8");
        const siteIds = JSON.parse(/name="locationIds"\r\n\r\n([^\r]*)\r\n/.exec(body)?.[1] ?? "[]") as string[];
        await sleep(450);
        if (siteIds.some((id) => !sites.some((site) => site.id === id))) {
          return json(response, 400, { message: "موقع المعاينة المحدد غير محفوظ في المشروع. أعد المحاولة." });
        }
        if (name === "bad.png" && !failedOnce) {
          failedOnce = true;
          return json(response, 500, { message: "انقطع الاتصال بالتخزين." });
        }
        const file: SiteFile = {
          id: `up-${uploads.length + 1}`,
          name,
          type: "image",
          url: "",
          uploadedBy: "u",
          createdAt: new Date().toISOString(),
          sizeBytes: 5000,
          ...(siteIds.length ? { locationIds: siteIds } : {}),
        };
        uploads.push({ name, siteIds });
        files = [...files, file];
        return json(response, 200, { ok: true, file, inspectorFiles: files });
      } finally {
        active -= 1;
      }
    }
    const deleteMatch = /^\/api\/mv\/projects\/p1\/inspectorFiles\/([^/]+)$/.exec(url);
    if (deleteMatch && request.method === "DELETE") {
      files = files.filter((file) => file.id !== decodeURIComponent(deleteMatch[1]!));
      return json(response, 200, { ok: true, inspectorFiles: files });
    }
    if (/\/inspectorFiles\/[^/]+\/download/.test(url)) {
      response.setHeader("Content-Type", "image/png");
      response.end(PNG);
      return;
    }
    const project = {
      _id: "p1",
      name: "مشروع اختبار",
      locations: sites,
      contacts: [],
      inspectorFiles: files,
    };
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(
      `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script>window.__PROJECT__=${JSON.stringify(project)}</script><script src="/app.js"></script></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  await mkdir("test-results/mv-project-sites", { recursive: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);

    const cards = page.locator("main > div > div > div.flex.flex-col.gap-3 > section");
    await expect(cards).toHaveCount(1);
    await expect(cards.nth(0).getByText("ملفات الموقع")).toBeVisible();
    await expect(cards.nth(0).getByText("الواجهة.png")).toBeVisible();
    await expect(page.getByText("ملفات عامة للمشروع")).toBeVisible();
    await expect(page.getByText("عقد.pdf")).toBeVisible();
    await expect(page.getByText("إرفاق ملفات", { exact: true })).toHaveCount(0);
    assert.equal(sitePatches.length, 0, "opening saves nothing");

    // 1. A brand-new, untouched site receives files straight away.
    await page.getByRole("button", { name: "إضافة موقع آخر" }).click();
    await expect(cards).toHaveCount(2);
    const newSite = cards.nth(1);
    await newSite.locator('input[type="file"]').setInputFiles(
      ["1.png", "2.png", "3.png", "4.png", "bad.png"].map((name) => ({ name, mimeType: "image/png", buffer: PNG })),
    );
    await expect(newSite.getByText(/جاري رفع/)).toBeVisible();
    await expect(newSite.getByText("انقطع الاتصال بالتخزين.")).toBeVisible({ timeout: 15_000 });
    await expect(newSite.locator("li img")).toHaveCount(4, { timeout: 15_000 });
    assert.equal(sitePatches.length >= 1, true, "the site was saved automatically before the upload");
    const newSiteId = sitePatches[0]!.at(-1)!.id;
    assert.equal(sitePatches[0]!.length, 2, "the empty new site is kept because files go to it");
    assert.equal(uploads.length, 4);
    for (const upload of uploads) assert.deepEqual(upload.siteIds, [newSiteId], `${upload.name} filed under its site`);
    assert.ok(maxActive >= 2 && maxActive <= 3, `parallel uploads (max ${maxActive})`);

    // 2. The failed file is kept with its reason and a retry.
    await newSite.getByRole("button", { name: "إعادة المحاولة" }).click();
    await expect(newSite.locator("li img")).toHaveCount(5, { timeout: 15_000 });
    assert.deepEqual(uploads.at(-1), { name: "bad.png", siteIds: [newSiteId] });
    await expect(page.getByTestId("pending")).toHaveText("0");

    // 3. Typing is saved automatically.
    await cards.nth(0).locator('input[inputmode="tel"]').fill("0501234567");
    await expect(page.getByTestId("status")).toHaveText("pending");
    await expect(page.getByTestId("status")).toHaveText("saved", { timeout: 10_000 });
    assert.equal(sitePatches.at(-1)![0]!.primaryPhone, "0501234567");
    await page.screenshot({ path: "test-results/mv-project-sites/sites-with-files.png", fullPage: true });

    // 4. Removing a site with files asks first; the files are kept as general files.
    await newSite.getByRole("button", { name: "حذف الموقع" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("5 ملف");
    await confirm.getByRole("button", { name: "حذف الموقع" }).click();
    await expect(cards).toHaveCount(1);
    await expect(page.getByTestId("status")).toHaveText("saved", { timeout: 10_000 });
    assert.deepEqual(sitePatches.at(-1)!.map((site) => site.id), ["site-a"]);
    const general = page.locator("section").filter({ hasText: "ملفات عامة للمشروع" });
    await expect(general.locator("li")).toHaveCount(6);
    assert.equal(files.length, 7, "no file deleted with its site");

    // 5. Deleting a file takes a second, explicit click.
    const tile = cards.nth(0).locator("li").filter({ hasText: "الواجهة.png" });
    await tile.hover();
    await tile.getByRole("button", { name: "حذف" }).click();
    assert.equal(files.length, 7, "first click only asks");
    await tile.getByRole("button", { name: "تأكيد الحذف" }).click();
    await expect(cards.nth(0).getByText("الواجهة.png")).toHaveCount(0);
    assert.equal(files.some((file) => file.id === "f1"), false);
    await expect(page.getByTestId("list-files")).toHaveText("6");

    // 6. Leaving: flush reports everything saved.
    await page.getByRole("button", { name: "flush" }).click();
    await expect(page.getByTestId("flushed")).toHaveText("true");
    await page.screenshot({ path: "test-results/mv-project-sites/after-remove.png", fullPage: true });
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
