import { expect, test } from "@playwright/test";

test("a simplified project imports extracted file fields into the final report-data section", async ({ page }) => {
  const projectId = "1234567890abcdef12345678";
  let project = {
    _id: projectId,
    name: "مشروع مبسط للاختبار",
    reportType: "simple",
    workflowStatus: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reportData: {
      reportTitle: "تقرير قائم",
      customSections: [{ id: "existing-section", title: "قسم قائم" }],
      customFields: [{ id: "existing-field", sectionId: "existing-section", label: "بيان قائم", type: "text", required: false, value: "قيمة قائمة" }],
    },
  };
  let patchBody: any = null;

  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path === "/api/auth/me") return json({ user: { id: "user", username: "اختبار", role: "super_admin", companyId: null, valueTechProductIds: null }, session: { id: "session", isActive: true }, csrfToken: "csrf", config: { enableTracking: false }, guestAccess: null });
    if (path === "/api/mv/projects" && method === "GET") return json([project]);
    if (path === `/api/mv/projects/${projectId}` && method === "GET") return json({ project, subProjects: [] });
    if (path === `/api/mv/projects/${projectId}` && method === "PATCH") {
      patchBody = route.request().postDataJSON();
      project = { ...project, ...patchBody, updatedAt: new Date().toISOString() };
      return json({ project });
    }
    if (path === "/api/mv/data-extraction" && method === "POST") return json({ documents: [{ id: "extraction", fileName: "خطاب.pdf", status: "completed", fields: [{ id: "one", label: "رقم القضية", value: "4870385439", category: "document", section: "بيانات القضية" }, { id: "two", label: "المحكمة", value: "المحكمة التجارية بالرياض", category: "organization", section: "بيانات القضية" }] }] });
    if (path.includes("report-defaults")) return json({ reportDefaults: { reportDataModels: [] } });
    if (path.endsWith("/clients")) return json([]);
    return json([]);
  });

  await page.goto("/machine-valuation", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("مشروع مبسط للاختبار", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /إجراءات مشروع مبسط للاختبار/ }).first().click();
  await page.getByRole("menuitem", { name: "استيراد بيانات من ملفات", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "استيراد بيانات من ملفات" })).toBeVisible();

  await page.getByLabel("اختيار ملفات الاستيراد", { exact: true }).setInputFiles({ name: "خطاب.pdf", mimeType: "application/pdf", buffer: Buffer.from("test-pdf") });
  await page.getByRole("button", { name: "استخراج البيانات", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "رقم القضية", exact: true })).toHaveValue("4870385439");
  await page.getByRole("button", { name: "دمج في بيانات التقرير", exact: true }).click();

  await expect.poll(() => patchBody).not.toBeNull();
  expect(patchBody.reportData.reportTitle).toBe("تقرير قائم");
  expect(patchBody.reportData.customSections.map((section: any) => section.title)).toEqual(["قسم قائم", "البيانات المستوردة من الملفات"]);
  expect(patchBody.reportData.customFields.slice(-2).map((field: any) => [field.label, field.value])).toEqual([["رقم القضية", "4870385439"], ["المحكمة", "المحكمة التجارية بالرياض"]]);
  await expect(page).toHaveURL(new RegExp(`/machine-valuation/${projectId}/workflow/report-data$`));
});

test("report data imports a file from the model toolbar and renders the appended section", async ({ page }) => {
  const projectId = "2234567890abcdef12345678";
  let project = {
    _id: projectId,
    name: "مشروع الاستيراد المباشر",
    reportType: "simple",
    workflowStatus: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reportData: {
      reportTitle: "تقرير قائم",
      customSections: [],
      customFields: [],
    },
  };
  let patchBody: any = null;

  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path === "/api/auth/me") return json({ user: { id: "user", username: "اختبار", role: "super_admin", companyId: null, valueTechProductIds: null }, session: { id: "session", isActive: true }, csrfToken: "csrf", config: { enableTracking: false }, guestAccess: null });
    if (path === `/api/mv/projects/${projectId}` && method === "GET") return json({ project, subProjects: [] });
    if (path === `/api/mv/projects/${projectId}` && method === "PATCH") {
      patchBody = route.request().postDataJSON();
      project = { ...project, ...patchBody, updatedAt: new Date().toISOString() };
      return json({ project });
    }
    if (path === "/api/mv/data-extraction" && method === "POST") return json({ documents: [{ id: "extraction", fileName: "رخصة.pdf", status: "completed", fields: [{ id: "one", label: "رقم الرخصة", value: "LIC-2026-19", category: "document", section: "بيانات الرخصة" }] }] });
    if (path.includes("report-defaults")) return json({ reportDefaults: { reportDataModels: [] } });
    if (path.endsWith("/clients")) return json([]);
    return json([]);
  });

  await page.goto(`/machine-valuation/${projectId}/workflow/report-data`, { waitUntil: "domcontentloaded" });
  const importButton = page.getByRole("button", { name: "استيراد بيانات من ملف", exact: true });
  await expect(importButton).toBeVisible();
  await importButton.click();
  await expect(page.getByRole("dialog", { name: "استيراد بيانات من ملفات" })).toBeVisible();

  await page.getByLabel("اختيار ملفات الاستيراد", { exact: true }).setInputFiles({ name: "رخصة.pdf", mimeType: "application/pdf", buffer: Buffer.from("test-pdf") });
  await page.getByRole("button", { name: "استخراج البيانات", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "رقم الرخصة", exact: true })).toHaveValue("LIC-2026-19");
  await page.getByRole("button", { name: "دمج في بيانات التقرير", exact: true }).click();

  await expect.poll(() => patchBody?.reportData?.customSections?.length).toBe(1);
  expect(patchBody.reportData.customSections[0].title).toBe("البيانات المستوردة من الملفات");
  expect(patchBody.reportData.customFields[0]).toMatchObject({ label: "رقم الرخصة", value: "LIC-2026-19" });
  await expect(page.getByText("البيانات المستوردة من الملفات", { exact: true })).toBeVisible();
});
