// Capture the real application UI using fictional, browser-intercepted data.
// No account, credentials, or backend writes are used.
// Run: node scripts/capture-mv-handbook.mjs [screenshot-name ... | check]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const origin = process.env.MV_HANDBOOK_ORIGIN || 'http://localhost:3000';
const out = 'public/mv-handbook';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
const projectId = '1234567890abcdef12345678';
const project = {
  _id: projectId, name: 'تقييم معدات مصنع النور — مثال تعليمي', companyId: 'handbook-company',
  reportType: 'simple', workflowStatus: 'new', displayNumber: 'MV-2026-001',
  createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z',
  reportData: { projectName: 'تقييم معدات مصنع النور', clientName: 'شركة النور الصناعية', reportTitle: 'تقرير تقييم الآلات والمعدات', reportReference: 'MV-2026-001', valuationPurpose: 'البيع', valuationBasis: 'القيمة السوقية', currencyLabel: 'ريال سعودي', finalValue: 250000, wordTemplateId: 'training-word', inspectionDate: '2026-10-01', valuationDate: '2026-10-01', reportIssueDate: '2026-10-03', customSections: [], customFields: [] },
};
await page.addInitScript(() => {
  localStorage.setItem('mv:handbook:hidden:handbook-user', '1');
  sessionStorage.setItem('mv:handbook:seen:handbook-user', '1');
});
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ json: body });
  if (path === '/api/auth/me') return json({ user: { id: 'handbook-user', username: 'مستخدم التدريب', role: 'company_admin', companyId: 'handbook-company', companyName: 'شركة النور للتقييم', valueTechProductIds: null, createdAt: '2026-10-01' }, session: { id: 'handbook-session', isActive: true }, csrfToken: 'fixture', config: { enableTracking: false }, guestAccess: null });
  if (path === '/api/mv/projects') return json([project]);
  if (path === `/api/mv/projects/${projectId}`) return json({ project, subProjects: [] });
  if (path === `/api/mv/projects/${projectId}/attachment-workspaces`) return json({ project });
  if (path.includes('report-defaults')) return json({ reportDefaults: path === '/api/company/report-defaults' ? { wordTemplates: [{ id: 'training-word', name: 'تقرير تقييم المعدات — قالب تدريبي', fileName: 'training.docx', fileUrl: '/training.docx' }] } : {} });
  if (path === '/api/company/users') return json({ company: { id: 'handbook-company', name: 'شركة النور للتقييم' }, users: [], reportOnlySignatories: [] });
  if (path.includes('branding')) return json({ company: { name: 'شركة النور للتقييم' } });
  return json([]);
});
async function capture(name, path, ready, action) {
  if (process.argv.length > 2 && !process.argv.slice(2).includes(name)) return;
  await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByText(ready, { exact: false }).first().waitFor({ timeout: 90000 });
  if (action) await action();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  // Remove the global account bar and keep the actual workspace.
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 85, clip: { x: 0, y: 66, width: 1440, height: 810 } });
  console.log(`Captured ${name}`);
}
try {
  await capture('projects', '/machine-valuation', 'إنشاء مشروع جديد');
  await capture('create', '/machine-valuation', 'إنشاء مشروع جديد', () => page.getByRole('button', { name: 'إنشاء مشروع جديد', exact: true }).click());
  await capture('models', '/machine-valuation/settings/report/report-data-models', 'نموذج فرد', () => page.getByRole('button', { name: 'فتح القسم', exact: true }).first().click());
  await capture('word', '/machine-valuation/settings/report/word-template', 'أضف قالب جديد');
  await capture('pptx', '/machine-valuation/settings/report/pptx-template', 'أضف قالب جديد');
  await capture('system', '/machine-valuation/settings/report/letterhead', 'مكتبة قوالب النظام');
  await capture('sections', '/machine-valuation/settings/report/letterhead', 'مكتبة قوالب النظام', () => page.getByRole('tab', { name: 'أقسام وتعريفات التقرير', exact: true }).click());
  await capture('data', `/machine-valuation/${projectId}/workflow/report-data`, 'بيانات التقرير');
  await capture('images', `/machine-valuation/${projectId}/workflow/asset-images`, 'صور الأصول');
  await capture('files', `/machine-valuation/${projectId}/workflow/files`, 'رفع Excel');
  await capture('final', `/machine-valuation/${projectId}/workflow/final-report`, 'التقرير النهائي', async () => {
    await page.getByRole('button', { name: /تنزيل Word/ }).waitFor({ timeout: 90000 });
  });
  await capture('system-report', `/machine-valuation/${projectId}/workflow/final-report`, 'التقرير النهائي', async () => {
    await page.getByRole('tab', { name: /النظام/ }).click();
    await page.getByText('أقسام التقرير', { exact: true }).first().waitFor({ timeout: 90000 });
  });
  if (process.argv.includes('check')) {
    await page.goto(origin + '/machine-valuation', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: 'فتح كتيب استخدام نظام تقييم الآلات', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'كتيب استخدام نظام تقييم الآلات', exact: true });
    await dialog.waitFor();
    await page.waitForTimeout(500);
    await mkdir('test-results/mv-handbook', { recursive: true });
    await page.screenshot({ path: 'test-results/mv-handbook/integration-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'test-results/mv-handbook/integration-mobile.png' });
    await dialog.getByRole('button', { name: 'إغلاق الكتيب', exact: true }).click();
    await page.getByRole('button', { name: 'إنشاء مشروع جديد', exact: true }).click();
    await page.getByRole('dialog', { name: 'إنشاء مشروع جديد', exact: true }).waitFor();
    console.log('Verified handbook integration and project creation dialog');
  }
} finally { await browser.close(); }
