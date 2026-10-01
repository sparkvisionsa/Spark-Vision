import { test, expect } from "@playwright/test";

test("Arabic extraction history opens, copies, edits, saves, reloads and deletes with a source preview", async ({ page, context }) => {
  const id = "1234567890abcdef12345678";
  const api = "/api/mv/data-extraction";
  const document = {
    id, fileName: "مستند اختبار.png", documentType: "وثيقة تملك عقار", mimeType: "image/png", status: "completed", language: "العربية", createdAt: new Date().toISOString(),
    sourceUrl: api + "/history/" + id + "/file", thumbnailUrl: api + "/history/" + id + "/thumbnail", needsReview: true, pageCount: 1,
    fields: [
      { id: "first", label: "رقم الوثيقة", value: "123456", section: "البيانات الأساسية", category: "document", confidence: "medium", page: 1, reviewed: false, source: { x: 0.1, y: 0.2, width: 0.4, height: 0.1 } },
      ...Array.from({ length: 44 }, (_, index) => ({ id: `field-${index}`, label: `حقل اختبار ${index + 1}`, value: `قيمة مستخرجة ${index + 1}`, section: index < 22 ? "بيانات القضية" : "بيانات الخبرة", category: "document", confidence: "high", page: 1, reviewed: true })),
    ],
    pages: [{ page: 1, text: "رقم الوثيقة: 123456" }],
  };
  let exists = true;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path === "/api/auth/me") return json({ user: { id: "test-user", username: "اختبار", role: "super_admin", companyId: null, valueTechProductIds: null }, session: { id: "session", isActive: true }, csrfToken: "test-csrf", config: { enableTracking: false }, guestAccess: null });
    if (path.startsWith(api + "/history/" + id + "/")) return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="440"><rect width="300" height="440" fill="#f3efe0"/><rect x="20" y="80" width="260" height="40" fill="#087e75"/><text x="100" y="150" font-size="20">123456</text></svg>' });
    if (path === api + "/history") return json({ items: exists ? [{ ...document, fields: undefined, pages: undefined, fieldCount: document.fields.length }] : [], nextCursor: null });
    if (path === api + "/history/" + id) {
      if (method === "PATCH") document.fields = route.request().postDataJSON().fields;
      if (method === "DELETE") { exists = false; return json({ deleted: true }); }
      return json(document);
    }
    if (path === api && method === "POST") { exists = true; return json({ documents: [document] }); }
    if (path.endsWith("/projects")) return json([]);
    return json({});
  });
  await page.goto("/machine-valuation/data-extraction", { waitUntil: "domcontentloaded" });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:3000" });
  await expect(page.getByRole("heading", { name: "استخراج البيانات", exact: true })).toBeVisible();
  const history = page.getByRole("region", { name: "سجل الاستخراج" });
  await history.getByRole("button", { name: /مستند اختبار.png/ }).first().click();
  await expect(page.getByRole("dialog", { name: "مستند اختبار.png" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "رقم الوثيقة", exact: true })).toHaveValue("123456");
  await page.getByRole("button", { name: "نسخ قيمة رقم الوثيقة", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("123456");
  await expect(page.getByAltText("مستند اختبار.png", { exact: true })).toBeVisible();
  const fieldsScroll = page.getByRole("region", { name: "الحقول المستخرجة", exact: true });
  await expect.poll(() => fieldsScroll.evaluate(element => element.scrollHeight > element.clientHeight)).toBeTruthy();
  await fieldsScroll.evaluate(element => element.scrollTo({ top: element.scrollHeight }));
  await expect.poll(() => fieldsScroll.evaluate(element => element.scrollTop > 0)).toBeTruthy();
  await expect(page.getByRole("textbox", { name: "حقل اختبار 44", exact: true })).toBeVisible();
  await fieldsScroll.evaluate(element => element.scrollTo({ top: 0 }));
  await page.getByRole("textbox", { name: "رقم الوثيقة", exact: true }).fill("987654");
  await page.getByRole("button", { name: "حفظ التعديلات", exact: true }).click();
  await expect(page.getByRole("button", { name: "محفوظ", exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await history.getByRole("button", { name: /مستند اختبار.png/ }).first().click();
  await expect(page.getByRole("textbox", { name: "رقم الوثيقة", exact: true })).toHaveValue("987654");
  await page.screenshot({ path: "test-results/extraction/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => window.document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: "test-results/extraction/mobile.png", fullPage: true });
  await page.getByRole("button", { name: "إغلاق", exact: true }).click({ force: true });
  await expect(page.getByRole("dialog", { name: "مستند اختبار.png" })).toBeHidden();
  await page.getByRole("button", { name: "حذف مستند اختبار.png", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "حذف", exact: true }).click();
  await expect(history.getByText("ستظهر ملفاتك هنا بعد استخراج البيانات.")).toBeVisible();
  await page.getByLabel("اختيار ملفات الاستخراج", { exact: true }).setInputFiles({ name: "مستند اختبار.png", mimeType: "image/png", buffer: Buffer.from("test image upload") });
  await page.getByRole("button", { name: "استخراج البيانات", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "مستند اختبار.png" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "رقم الوثيقة", exact: true })).toHaveValue("987654");
  await page.getByRole("button", { name: "إغلاق", exact: true }).click({ force: true });
  await expect(history.getByRole("button", { name: /مستند اختبار.png/ }).first()).toBeVisible();
});
