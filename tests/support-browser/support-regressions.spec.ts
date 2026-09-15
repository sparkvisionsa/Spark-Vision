import { test, expect, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const marker = `support-regression-${randomUUID()}`;
let ticketId: string;
let developerId: string;
function session(who: "owner" | "agent" | "admin" | "supportOne" | "supportTwo") {
  return JSON.parse(readFileSync(".support-test-sessions.json", "utf8")).users[who] as { id: string; cookie: string; csrf: string };
}
async function authenticate(context: BrowserContext, who: "owner" | "agent" | "admin") {
  await context.addCookies(session(who).cookie.split("; ").map(part => {
    const index = part.indexOf("=");
    return { name: part.slice(0, index), value: part.slice(index + 1), url: "http://127.0.0.1:3100", httpOnly: !part.startsWith("sv_csrf"), sameSite: "Lax" as const };
  }));
}

test.beforeAll(async ({ request }) => {
  const owner = session("owner"); const admin = session("admin");
  for (const kind of ["ticket", "bug", "idea"]) {
    const created = await request.post("/api/support/tickets", {
      headers: { cookie: owner.cookie, "x-csrf-token": owner.csrf },
      data: { subject: `${marker}-${kind}`, kind, product: "general", clientId: randomUUID() },
    });
    expect(created.status()).toBe(201);
    const { ticket } = await created.json();
    if (kind === "ticket") ticketId = ticket._id;
    else {
      if (kind === "bug") developerId = ticket._id;
      const updated = await request.patch(`/api/support/tickets/${ticket._id}`, {
        headers: { cookie: admin.cookie, "x-csrf-token": admin.csrf },
        data: { revision: 0, status: kind === "bug" ? "closed" : "planned" },
      });
      expect(updated.status()).toBe(200);
    }
  }
});

for (const who of ["owner", "agent", "admin"] as const) {
  test(`support and developer status tabs stay separate for ${who}`, async ({ page, context }) => {
    await authenticate(context, who);
    await page.goto("/support", { waitUntil: "domcontentloaded" });
    await page.getByRole("textbox", { name: "البحث في التذاكر", exact: true }).fill(marker);
    const tabs = page.getByRole("group", { name: "تصفية حسب الحالة", exact: true });
    await expect(tabs.getByRole("button", { name: /^الكل/ })).toHaveText(/الكل\s*1$/);
    await expect(tabs.getByRole("button", { name: /^مفتوحة/ })).toHaveText(/مفتوحة\s*1$/);
    await expect(tabs.getByRole("button", { name: /^مغلقة/ })).toHaveText(/مغلقة\s*0$/);
    await expect(page.getByRole("button").filter({ hasText: `${marker}-ticket` })).toBeVisible();
    await expect(page.getByRole("button").filter({ hasText: `${marker}-bug` })).toHaveCount(0);
    await page.goto("/developer-requests", { waitUntil: "domcontentloaded" });
    await page.getByRole("textbox", { name: "البحث في طلبات كن مطور", exact: true }).fill(marker);
    await expect(tabs.getByRole("button", { name: /^الكل/ })).toHaveText(/الكل\s*2$/);
    await expect(tabs.getByRole("button", { name: /^مفتوحة/ })).toHaveText(/مفتوحة\s*0$/);
    await expect(tabs.getByRole("button", { name: /^مخطط لها/ })).toHaveText(/مخطط لها\s*1$/);
    await tabs.getByRole("button", { name: /^مغلقة/ }).click();
    await expect(page.getByRole("button").filter({ hasText: `${marker}-bug` })).toBeVisible();
    await expect(page.getByRole("button").filter({ hasText: `${marker}-idea` })).toHaveCount(0);
    await expect(tabs.getByRole("button", { name: /^الكل/ })).toHaveText(/الكل\s*2$/);
  });
}

test("admin assigns both inboxes to their UUID account and the two support phone accounts", async ({ page, context }) => {
  await authenticate(context, "admin");
  const directory = await page.request.get("/api/support/agents");
  expect(directory.status()).toBe(200);
  expect((await directory.json()).agents.some((agent: { id: string }) => agent.id === session("admin").id)).toBe(true);
  for (const [route, id, kind] of [["/support", ticketId, "ticket"], ["/developer-requests", developerId, "bug"]]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.getByRole("button").filter({ hasText: `${marker}-${kind}` }).click();
    await page.getByRole("button", { name: "إسناد لي", exact: true }).click();
    await expect(page.getByLabel("إسناد التذكرة", { exact: true })).toHaveValue(session("admin").id);
    if (kind === "ticket") {
      await page.getByRole("button", { name: "إدارة فريق الدعم", exact: true }).click();
      const dialog = page.getByRole("dialog");
      for (const phone of ["579228782", "596220001"]) {
        await dialog.getByRole("textbox", { name: "رقم موظف الدعم", exact: true }).fill(phone);
        await dialog.getByRole("button", { name: "إضافة موظف دعم", exact: true }).click();
        await expect(dialog.getByText(`+966${phone}`, { exact: true }).first()).toBeVisible();
      }
      await page.keyboard.press("Escape");
    }
    for (const who of ["supportOne", "supportTwo"] as const) {
      await expect(page.getByLabel("إسناد التذكرة", { exact: true })).toBeEnabled();
      await page.getByLabel("إسناد التذكرة", { exact: true }).selectOption(session(who).id);
      await expect.poll(async () => (await (await page.request.get(`/api/support/tickets/${id}`)).json()).ticket.assigneeId).toBe(session(who).id);
    }
    await expect(page.getByRole("alert").filter({ hasText: /تعذر تحميل فريق الدعم|اختر موظف دعم/ })).toHaveCount(0);
  }
});
