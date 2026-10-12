import { test, expect, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";

function session(who: "owner" | "agent" | "admin") {
  return JSON.parse(readFileSync(".support-test-sessions.json", "utf8")).users[who] as { cookie: string; csrf: string };
}
async function authenticate(context: BrowserContext, who: "owner" | "agent" | "admin") {
  await context.addCookies(session(who).cookie.split("; ").map(part => {
    const index = part.indexOf("=");
    return { name: part.slice(0, index), value: part.slice(index + 1), url: "http://127.0.0.1:3100", httpOnly: !part.startsWith("sv_csrf"), sameSite: "Lax" as const };
  }));
}
test("authenticated ticket conversation synchronizes between the user and support", async ({ page, browser, context }) => {
  await authenticate(context, "owner");
  await page.goto("/support", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("الدعم والتذاكر", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "إنشاء تذكرة", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const request = "تعذر تنزيل التقرير — أحتاج متابعة تنزيل التقرير النهائي.";
  await dialog.getByLabel("عنوان التذكرة أو رسالتك", { exact: true }).fill(request);
  await expect(dialog.getByLabel("العنوان", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("الرسالة", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "إنشاء التذكرة", exact: true }).click();
  await expect(page.getByRole("heading", { name: request, exact: true })).toBeVisible();
  await expect(page.getByRole("log", { name: "رسائل التذكرة" }).getByText(request, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "تسجيل الشاشة والصوت", exact: true })).toBeVisible();
  const ticketId = new URL(page.url()).searchParams.get("ticket");
  const agentContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    await authenticate(agentContext, "agent"); const agentPage = await agentContext.newPage();
    await agentPage.goto(`/support?ticket=${ticketId}`);
    await expect(agentPage.getByRole("heading", { name: "مركز الدعم", exact: true })).toBeVisible();
    await agentPage.getByLabel("رسالتك للدعم", { exact: true }).fill("مرحباً، سأتابع المشكلة معك الآن.");
    await agentPage.getByRole("button", { name: "إرسال الرسالة", exact: true }).click();
    const supportMessage = page.getByRole("log", { name: "رسائل التذكرة" }).getByText("مرحباً، سأتابع المشكلة معك الآن.", { exact: true });
    await expect(supportMessage).toBeVisible();
    const supportBubble = supportMessage.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    await expect(supportBubble.getByText("الدعم الفني", { exact: true })).toBeVisible();
    await expect(supportBubble).not.toContainText("agent");
    await agentPage.getByLabel("حالة التذكرة", { exact: true }).selectOption("in_progress");
    await expect(page.getByText("قيد العمل", { exact: true }).last()).toBeVisible();
    await page.screenshot({ path: "test-results/support/ticket-desktop.png", fullPage: true });
    await agentPage.screenshot({ path: "test-results/support/support-inbox.png", fullPage: true });
  } finally { await agentContext.close(); }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "العودة للتذاكر", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/support/ticket-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("Arabic assistant shows verified steps and recording handles denied permissions", async ({ page, context }) => {
  await authenticate(context, "owner");
  await page.goto("/support", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "فتح مساعد فاليو تك", exact: true }).click();
  await page.getByRole("button", { name: "كيف أنشئ مشروع تقييم آلات؟", exact: true }).click();
  await expect(page.getByText("من دليل النظام", { exact: true })).toBeVisible();
  await expect(page.getByRole("log", { name: "المحادثة مع المساعد" }).getByText(/إنشاء مشروع جديد/)).toBeVisible();
  await page.screenshot({ path: "test-results/support/assistant.png", fullPage: true });
  await page.keyboard.press("Escape");
  await page.getByTitle("شارك فكرتك", { exact: true }).first().click();
  await expect(page.getByRole("dialog").getByText("شارك فكرتك بالصوت والصورة", { exact: true })).toBeVisible();
  await page.evaluate(() => { navigator.mediaDevices.getDisplayMedia = () => Promise.reject(new DOMException("Denied", "NotAllowedError")); });
  await page.getByRole("button", { name: "بدء التسجيل", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "لم تُمنح صلاحية" })).toBeVisible();
  await page.screenshot({ path: "test-results/support/recorder-permission.png", fullPage: true });
});

test("screen and microphone recording can pause, preview and upload a playable attachment", async ({ page, context }) => {
  await authenticate(context, "owner");
  await page.goto("/support", { waitUntil: "domcontentloaded" });
  // Synthetic browser MediaStreams exercise the real MediaRecorder + upload pipeline.
  // Native OS share-picker interaction remains a manual browser permission step.
  await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 360;
    const drawing = canvas.getContext("2d")!; drawing.fillStyle = "#0f172a"; drawing.fillRect(0, 0, 640, 360); drawing.fillStyle = "white"; drawing.font = "30px sans-serif"; drawing.fillText("Spark Vision", 40, 150);
    const stream = canvas.captureStream(15);
    const context = new AudioContext(); const tone = context.createOscillator(); const destination = context.createMediaStreamDestination();
    tone.connect(destination); tone.start();
    navigator.mediaDevices.getDisplayMedia = async () => stream;
    navigator.mediaDevices.getUserMedia = async () => destination.stream;
  });
  await page.getByTitle("شارك فكرتك", { exact: true }).first().click();
  await page.getByRole("button", { name: "بدء التسجيل", exact: true }).click();
  await expect(page.getByRole("region", { name: "التحكم في تسجيل شارك فكرتك" })).toBeVisible();
  await page.waitForTimeout(1700);
  await page.getByRole("button", { name: "إيقاف مؤقت", exact: true }).click();
  await expect(page.getByText("متوقف مؤقتاً", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "استئناف التسجيل", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "إنهاء", exact: true }).click();
  await expect(page.getByLabel("معاينة تسجيل الشاشة والصوت", { exact: true })).toBeVisible();
  await page.getByLabel("عنوان التسجيل، اختياري", { exact: true }).fill("تسجيل متصفح للاختبار");
  await page.getByRole("button", { name: "إرسال الفكرة", exact: true }).click();
  await expect(page.getByText(/وصلت فكرتك/)).toBeVisible();
  await page.getByRole("button", { name: "متابعة الفكرة", exact: true }).click();
  await page.getByRole("button", { name: /تسجيل متصفح للاختبار/ }).click();
  await expect(page.getByRole("heading", { name: "تسجيل متصفح للاختبار", exact: true })).toBeVisible();
  await expect(page.locator('video[src^="/api/support/files/"]')).toBeVisible();
});

test("ticket screen recording survives closing the conversation and keeps its ticket target", async ({ page, context }) => {
  test.setTimeout(300_000);
  await authenticate(context, "owner");
  await page.goto("/support", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "إنشاء تذكرة", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const subject = `تسجيل شاشة مستمر ${Date.now()}`;
  const request = `${subject} — أريد تسجيل التنقل بين أجزاء النظام.`;
  await dialog.getByLabel("عنوان التذكرة أو رسالتك", { exact: true }).fill(request);
  await dialog.getByRole("button", { name: "إنشاء التذكرة", exact: true }).click();
  await expect(page.getByRole("heading", { name: request, exact: true })).toBeVisible();

  await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 360;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#0f172a"; context.fillRect(0, 0, 640, 360);
    const stream = canvas.captureStream(15);
    const track = stream.getVideoTracks()[0]!;
    const getSettings = track.getSettings.bind(track);
    track.getSettings = () => ({ ...getSettings(), displaySurface: "monitor" });
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const destination = audio.createMediaStreamDestination();
    oscillator.connect(destination); oscillator.start();
    navigator.mediaDevices.getDisplayMedia = async (options) => {
      (window as Window & { captureOptions?: DisplayMediaStreamOptions }).captureOptions = options;
      return stream;
    };
    navigator.mediaDevices.getUserMedia = async () => destination.stream;
  });

  await page.getByRole("button", { name: "تسجيل الشاشة والصوت", exact: true }).click();
  await page.getByRole("button", { name: "بدء التسجيل", exact: true }).click();
  const controls = page.getByRole("region", { name: "التحكم في تسجيل التذكرة" });
  await expect(controls).toBeVisible();
  const captureOptions = await page.evaluate(() => (window as Window & { captureOptions?: DisplayMediaStreamOptions }).captureOptions);
  expect((captureOptions?.video as { displaySurface?: string })?.displaySurface).toBe("monitor");
  expect((captureOptions as DisplayMediaStreamOptions & { preferCurrentTab?: boolean }).preferCurrentTab).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "العودة للتذاكر", exact: true }).click();
  await expect(page.getByRole("heading", { name: request, exact: true })).not.toBeVisible();
  await expect(controls).toBeVisible();
  await page.waitForTimeout(1200);
  await controls.getByRole("button", { name: "إنهاء التسجيل" }).click();
  await expect(page.getByLabel("معاينة تسجيل الشاشة والصوت", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "إرسال داخل التذكرة", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "تسجيل الشاشة داخل التذكرة" })).not.toBeVisible();
  await page.getByRole("button", { name: new RegExp(subject) }).click();
  await expect(page.getByRole("log", { name: "رسائل التذكرة" }).locator('video[src^="/api/support/files/"]')).toBeVisible();
});
