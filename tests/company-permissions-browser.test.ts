import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect, type Page } from "@playwright/test";
import postcss from "postcss";
import tailwind from "tailwindcss";
import tailwindConfig from "../tailwind.config";

async function checkInternalScroll(page: Page, saveLabel: string) {
  const dialog = page.getByRole("dialog");
  const scroller = dialog.locator("[data-permissions-scroll]");
  const dimensions = await scroller.evaluate(element => ({ height: element.clientHeight, content: element.scrollHeight }));
  assert.ok(dimensions.height > 0 && dimensions.content > dimensions.height, "long forms have an internal scroll area");
  const documentScroll = await page.evaluate(() => window.scrollY);
  await scroller.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const lastAction = dialog.getByRole("checkbox").last();
  await lastAction.scrollIntoViewIfNeeded();
  const [lastBounds, scrollBounds, saveBounds, headerBounds] = await Promise.all([
    lastAction.boundingBox(), scroller.boundingBox(), dialog.getByRole("button", { name: saveLabel, exact: true }).boundingBox(), dialog.getByRole("heading").first().boundingBox(),
  ]);
  assert.ok(lastBounds && scrollBounds && lastBounds.y >= scrollBounds.y && lastBounds.y + lastBounds.height <= scrollBounds.y + scrollBounds.height + 1, "the last action can be reached inside the form");
  assert.ok(saveBounds && saveBounds.y >= 0 && saveBounds.y + saveBounds.height <= page.viewportSize()!.height, "save remains visible while scrolling");
  assert.ok(headerBounds && headerBounds.y >= 0, "dialog heading remains visible");
  assert.equal(await page.evaluate(() => window.scrollY), documentScroll, "scrolling the form does not move the background page");
  await scroller.evaluate(element => { element.scrollTop = 0; });
}

test("company permissions: scoped user table, profile dialogs and individual assignments", { timeout: 180_000 }, async () => {
  const catalog = [
    { key: "projects", label: "المشاريع", description: "مشاريع التقييم", actions: [{ key: "access", label: "الوصول للصفحة" }, { key: "edit", label: "تعديل" }] },
    { key: "asset_media", label: "المرفقات", description: "ملفات المشروع", actions: [{ key: "access", label: "الوصول للصفحة" }, { key: "upload", label: "رفع الملفات" }] },
    ...Array.from({ length: 12 }, (_, i) => ({ key: `page_${i}`, label: `صفحة ${i}`, description: "إجراءات إضافية", actions: [{ key: "access", label: "الوصول للصفحة" }] })),
  ];
  const allGrants = catalog.flatMap(page => page.actions.map(action => `${page.key}.${action.key}`));
  const members = [
    { id: "admin", username: "manager", valuationReportDisplayName: "مدير الشركة", role: "company_admin", productIds: ["machine-valuation", "real-estate-valuation"] },
    { id: "user-1", username: "ahmed", valuationReportDisplayName: "أحمد محمد", role: "valuer", phone: "0500000001", email: "ahmed@example.test", productIds: ["machine-valuation", "real-estate-valuation"], permissionOverrides: { "machine-valuation": { deny: ["asset_media.upload"] }, "real-estate-valuation": { deny: ["asset_media.upload"] } } },
    ...Array.from({ length: 10 }, (_, i) => ({ id: `user-${i + 2}`, username: `member-${i + 2}`, role: "inspector", productIds: ["machine-valuation", "real-estate-valuation"] })),
    { id: "other-product", username: "خارج النظام", role: "valuer", productIds: ["asset-inventory"] },
  ];
  const bundle = await build({
    stdin: { contents: `import React from "react"; import { createRoot } from "react-dom/client"; import { CompanyPermissionsDashboard } from "./src/components/company-permissions-dashboard"; const productId = new URLSearchParams(location.search).get("product") || "machine-valuation"; createRoot(document.getElementById("root")).render(<CompanyPermissionsDashboard productId={productId} csrfToken="test-csrf" users={${JSON.stringify(members)}} />);`, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, jsx: "automatic", platform: "browser", define: { "process.env.NEXT_PUBLIC_API_BASE_URL": '""' },
  });
  const css = await postcss([tailwind({ ...tailwindConfig, content: ["src/components/company-permissions-dashboard.tsx", "src/components/permissions/permission-page-preview.tsx", "src/components/ui/button.tsx", "src/components/ui/dialog.tsx"] })])
    .process(await readFile("src/app/globals.css", "utf8"), { from: "src/app/globals.css" });
  const server = createServer((req, res) => {
    if (req.url === "/app.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].contents); return; }
    if (req.url === "/app.css") { res.setHeader("Content-Type", "text/css; charset=utf-8"); res.end(css.css); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body style="background:#f8fafc"><main style="max-width:1280px;margin:auto;padding:24px"><div id="root"></div></main><script src="/app.js"></script></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  try {
    await mkdir("test-results/company-permissions", { recursive: true });
    for (const product of ["machine-valuation", "real-estate-valuation"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      let profiles = [
        { id: "default", name: "الصلاحية الافتراضية", grants: allGrants, isDefault: true, createdAt: "2026-10-17", updatedAt: "2026-10-17" },
        { id: "limited", name: "قراءة فقط", grants: ["projects.access", "asset_media.access"], isDefault: false, createdAt: "2026-10-17", updatedAt: "2026-10-17" },
      ];
      const writes: Array<{ method: string; path: string; body: any }> = [];
      let previewProjectRequests = 0;
      let failNext = false;
      await page.route("**/api/company/permissions**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        assert.equal(url.searchParams.get("productId"), product);
        if (request.method() === "GET") { await route.fulfill({ json: { catalog, profiles } }); return; }
        assert.equal(request.headers()["x-csrf-token"], "test-csrf");
        const body = request.postDataJSON();
        writes.push({ method: request.method(), path: url.pathname, body });
        if (failNext) { failNext = false; await route.fulfill({ status: 400, json: { message: "تعذر الحفظ التجريبي" } }); return; }
        if (request.method() === "PUT") { await route.fulfill({ json: { ok: true, profileIds: body.profileIds, effectiveGrants: body.effectiveGrants } }); return; }
        if (request.method() === "DELETE") { profiles = profiles.filter(profile => profile.id !== url.pathname.split("/").at(-1)); await route.fulfill({ json: { ok: true } }); return; }
        const id = request.method() === "POST" ? "created" : url.pathname.split("/").at(-1)!;
        const profile = { ...body, id, isDefault: false, createdAt: "2026-10-17", updatedAt: "2026-10-18" };
        profiles = [...profiles.filter(item => item.id !== id), profile];
        await route.fulfill({ json: { profile } });
      });
      await page.route("**/api/mv/permission-preview-project", async route => {
        previewProjectRequests += 1;
        assert.equal(route.request().method(), "POST");
        await route.fulfill({ json: { projectId: "real-preview-project", name: "مشروع معاينة الصلاحيات — بيانات تجريبية", created: previewProjectRequests === 1, version: 1 } });
      });
      await page.route("**/*permissionPreview=1", async route => {
        const url = new URL(route.request().url());
        await route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><html lang="ar" dir="rtl"><body><main data-real-system-page><h1>صفحة النظام الحقيقية</h1><p>${url.pathname}</p></main></body></html>` });
      });
      await page.goto(`http://127.0.0.1:${address.port}/?product=${product}`);
      const table = page.getByRole("table", { name: "مستخدمو الشركة وصلاحياتهم" });
      await expect(table.locator("tbody tr")).toHaveCount(10);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(table.getByRole("row").filter({ hasText: "manager" }).getByRole("button")).toHaveCount(0);
      await expect(page.getByText("خارج النظام", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "الصفحة التالية" }).click();
      await expect(table.locator("tbody tr")).toHaveCount(2);
      await page.getByRole("textbox", { name: "بحث عن مستخدم" }).fill("ahmed@example.test");
      await expect(table.locator("tbody tr")).toHaveCount(1);
      await expect(table).toContainText("أحمد محمد");
      await page.getByRole("textbox", { name: "بحث عن مستخدم" }).fill("");
      await page.screenshot({ path: `test-results/company-permissions/${product}-users.png`, fullPage: true });

      await page.getByRole("button", { name: "إضافة صلاحية جديدة", exact: true }).click();
      let dialog = page.getByRole("dialog");
      await checkInternalScroll(page, "إنشاء الصلاحية");
      if (product === "machine-valuation") {
        await dialog.getByRole("button", { name: "معاينة صفحة المشاريع", exact: true }).click();
        let previewDialog = page.getByRole("dialog", { name: "معاينة الصفحة الحقيقية: المشاريع" });
        await expect(previewDialog).toBeVisible();
        await expect(previewDialog).toContainText("مشروع معاينة حقيقي محفوظ داخل شركتك");
        const projectFrame = previewDialog.locator('iframe[title="الصفحة الحقيقية: المشاريع"]');
        await expect(projectFrame).toHaveAttribute("src", "/machine-valuation/projects?permissionPreview=1");
        await expect(page.frameLocator('iframe[title="الصفحة الحقيقية: المشاريع"]').locator("[data-real-system-page]")).toContainText("صفحة النظام الحقيقية");
        await previewDialog.getByRole("button", { name: "العودة للصلاحيات", exact: true }).click();
        await expect(previewDialog).toHaveCount(0);
        assert.equal(previewProjectRequests, 1, "the company preview project is ensured once");
        await dialog.getByRole("button", { name: "معاينة صفحة الأصول", exact: true }).click();
        previewDialog = page.getByRole("dialog", { name: "معاينة الصفحة الحقيقية: الأصول" });
        await expect(previewDialog.getByRole("button", { name: "المرفقات", exact: true })).toBeVisible();
        await previewDialog.getByRole("button", { name: "ملفات المعاين", exact: true }).click();
        previewDialog = page.getByRole("dialog", { name: "معاينة الصفحة الحقيقية: ملفات المعاين" });
        await expect(previewDialog.locator('iframe[title="الصفحة الحقيقية: ملفات المعاين"]')).toHaveAttribute("src", "/machine-valuation/real-preview-project/inspector-files?permissionPreview=1");
        assert.equal(previewProjectRequests, 1, "reopening previews reuses the same real project");
        await page.screenshot({ path: "test-results/company-permissions/machine-valuation-preview.png" });
        await previewDialog.getByRole("button", { name: "العودة للصلاحيات", exact: true }).click();
      }
      await dialog.getByLabel("اسم الصلاحية", { exact: true }).fill("فريق المرفقات");
      await dialog.getByRole("button", { name: "إلغاء الكل", exact: true }).click();
      await dialog.getByRole("checkbox", { name: "المرفقات: رفع الملفات" }).click();
      await expect(dialog.getByRole("checkbox", { name: "المرفقات: الوصول للصفحة" })).toBeChecked();
      await dialog.getByRole("checkbox", { name: "المرفقات: الوصول للصفحة" }).click();
      await expect(dialog.getByRole("checkbox", { name: "المرفقات: رفع الملفات" })).not.toBeChecked();
      await dialog.getByRole("checkbox", { name: "المرفقات: رفع الملفات" }).click();
      await page.screenshot({ path: `test-results/company-permissions/${product}-create.png` });
      await dialog.getByRole("button", { name: "إنشاء الصلاحية", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      assert.deepEqual(new Set(writes.at(-1)!.body.grants), new Set(["asset_media.access", "asset_media.upload"]));

      await page.getByRole("button", { name: "تعديل صلاحيات أحمد محمد", exact: true }).click();
      dialog = page.getByRole("dialog");
      await checkInternalScroll(page, "حفظ صلاحيات المستخدم");
      await expect(dialog.getByRole("checkbox", { name: "المرفقات: رفع الملفات" })).not.toBeChecked();
      await dialog.getByRole("checkbox", { name: "فريق المرفقات", exact: true }).click();
      await expect(dialog.getByRole("checkbox", { name: "الصلاحية الافتراضية", exact: true })).not.toBeChecked();
      // Explicit user denial survives assigning a template that grants upload.
      await expect(dialog.getByRole("checkbox", { name: "المرفقات: رفع الملفات" })).not.toBeChecked();
      failNext = true;
      await dialog.getByRole("button", { name: "حفظ صلاحيات المستخدم" }).click();
      await expect(dialog.getByRole("alert")).toContainText("تعذر الحفظ التجريبي");
      await expect(dialog.getByRole("checkbox", { name: "فريق المرفقات", exact: true })).toBeChecked();
      await dialog.getByRole("button", { name: "حفظ صلاحيات المستخدم" }).click();
      await expect(dialog).toHaveCount(0);
      assert.equal(writes.at(-1)!.path, "/api/company/permissions/users/user-1");
      assert.deepEqual(writes.at(-1)!.body.profileIds, ["created"]);
      assert.deepEqual(writes.at(-1)!.body.effectiveGrants, ["asset_media.access"]);
      const row = table.getByRole("row").filter({ hasText: "أحمد محمد" });
      await expect(row).toContainText("فريق المرفقات");
      await expect(row).toContainText("تخصيص فردي");
      await page.getByRole("combobox", { name: "تصفية المستخدمين حسب الصلاحية" }).selectOption("created");
      await expect(table.locator("tbody tr")).toHaveCount(1);

      await page.getByRole("button", { name: "تعديل صلاحيات أحمد محمد", exact: true }).click();
      dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "إعادة ضبط التخصيصات" }).click();
      await expect(dialog.getByRole("checkbox", { name: "المرفقات: رفع الملفات" })).toBeChecked();
      const beforeCancel = writes.length;
      await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
      assert.equal(writes.length, beforeCancel);
      await page.getByRole("button", { name: "الصلاحيات المحفوظة", exact: true }).click();
      await page.getByRole("button", { name: "عرض صلاحية الصلاحية الافتراضية" }).click();
      dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("checkbox").first()).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "حفظ التعديلات" })).toHaveCount(0);
      await dialog.getByRole("button", { name: "إغلاق", exact: true }).click();
      await page.getByRole("button", { name: "تعديل صلاحية فريق المرفقات" }).click();
      await checkInternalScroll(page, "حفظ التعديلات");
      await page.getByRole("dialog").getByLabel("اسم الصلاحية", { exact: true }).fill("فريق الملفات");
      await page.getByRole("dialog").getByRole("button", { name: "حفظ التعديلات" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("table", { name: "الصلاحيات المحفوظة" })).toContainText("فريق الملفات");

      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "إضافة صلاحية جديدة", exact: true }).click();
      dialog = page.getByRole("dialog");
      await checkInternalScroll(page, "إنشاء الصلاحية");
      const fullMatrixSave = await dialog.getByRole("button", { name: "إنشاء الصلاحية", exact: true }).boundingBox();
      assert.ok(fullMatrixSave && fullMatrixSave.y + fullMatrixSave.height <= 844, "long permission lists keep the mobile save action visible");
      await dialog.getByRole("textbox", { name: "بحث في الصفحات والإجراءات" }).fill("المرفقات");
      await expect(dialog.getByRole("checkbox")).toHaveCount(2);
      const bounds = await dialog.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 390 && bounds.y + bounds.height <= 844);
      const saveBounds = await dialog.getByRole("button", { name: "إنشاء الصلاحية", exact: true }).boundingBox();
      assert.ok(saveBounds && saveBounds.y + saveBounds.height <= 844, "save action stays inside the mobile viewport");
      await page.screenshot({ path: `test-results/company-permissions/${product}-mobile.png` });
      await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 568 });
      await page.getByRole("button", { name: "تعديل صلاحية فريق الملفات" }).click();
      await checkInternalScroll(page, "حفظ التعديلات");
      await page.screenshot({ path: `test-results/company-permissions/${product}-compact-edit.png` });
      await page.getByRole("dialog").getByRole("button", { name: "إلغاء", exact: true }).click();
      await page.getByRole("button", { name: "حذف صلاحية فريق الملفات" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "تأكيد الحذف" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "تعديل صلاحية فريق الملفات" })).toHaveCount(0);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
