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
const sourceProjectId = '2234567890abcdef12345678';
const project = {
  _id: projectId, name: 'تقييم معدات مصنع النور — مثال تعليمي', companyId: 'handbook-company',
  reportType: 'simple', workflowStatus: 'new', displayNumber: 12, referenceNumber: 'MV-2026-001',
  createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z',
  reportData: { projectName: 'تقييم معدات مصنع النور', clientName: 'شركة النور الصناعية', reportTitle: 'تقرير تقييم الآلات والمعدات', reportReference: 'MV-2026-001', valuationPurpose: 'البيع', valuationBasis: 'القيمة السوقية', currencyLabel: 'ريال سعودي', finalValue: 250000, wordTemplateId: 'training-word', inspectionDate: '2026-10-01', valuationDate: '2026-10-01', reportIssueDate: '2026-10-03', customSections: [], customFields: [] },
};
const sourceProject = {
  ...project,
  _id: sourceProjectId,
  name: 'مشروع معدات المستودع — مصدر الصور',
  displayNumber: 9,
  referenceNumber: 'MV-2026-009',
  reportData: { ...project.reportData, projectName: 'مشروع معدات المستودع', clientName: 'شركة المستودعات الحديثة' },
};
const photosRootId = '3234567890abcdef12345678';
const productionLineId = '4234567890abcdef12345678';
const assetNames = [
  'رافعة شوكية 01', 'رافعة شوكية 02', 'شاحنة نقل 03', 'سيارة خدمة 04',
  'مركبة ميدانية 05', 'رافعة شوكية 06', 'شاحنة نقل 07', 'سيارة خدمة 08',
  'مركبة ميدانية 09', 'رافعة شوكية 10', 'شاحنة نقل 11', 'سيارة خدمة 12',
  'مولد كهربائي 13', 'ضاغط هواء 14', 'ماكينة لحام 15', 'منضدة صناعية 16',
];
const subProjects = [
  { _id: photosRootId, projectId, parent: null, name: '2.صور المعاينة', createdAt: project.createdAt, updatedAt: project.updatedAt },
  { _id: productionLineId, projectId, parent: photosRootId, name: 'خط الإنتاج الرئيسي', createdAt: project.createdAt, updatedAt: project.updatedAt },
  ...assetNames.map((name, index) => {
    const id = `5234567890abcdef123456${String(index).padStart(2, '0')}`;
    const assetType = index < 12 ? 'vehicles' : 'machinery';
    return {
      _id: id, projectId, parent: productionLineId, name, createdAt: project.createdAt, updatedAt: project.updatedAt,
      picAsset: {
        _id: `6234567890abcdef123456${String(index).padStart(2, '0')}`,
        projectId, parent: productionLineId, name, lable: name, client_code: `AS-${String(index + 1).padStart(3, '0')}`,
        employer: 'فريق المعاينة', val_tech_id: String(1000 + index), asset_source: index % 2 ? 'نظام' : 'عميل',
        rawData: {}, createdAt: project.createdAt, updatedAt: project.updatedAt, isAssetFolder: true,
        writtenDescription: 'أصل بحالة تشغيلية جيدة', condition: index % 3 === 0 ? 'good' : 'fair',
        assetType, brand: index < 12 ? 'Toyota' : 'Atlas', code: `EQ-${index + 1}`,
        model: `M-${2020 + index}`, manufactureYear: 2020 + (index % 5), kilometersDriven: index < 12 ? 35000 + index * 1200 : null,
        isPresent: true, createdBy: 'handbook-user', images: [], imageCount: 0, photoCount: 0,
        voiceNotes: [], voiceNoteCount: 0, isDone: true, category: assetType === 'vehicles' ? 'مركبات' : 'معدات صناعية',
        type: assetType === 'vehicles' ? 'مركبة' : 'معدات', asset_location: 'المصنع الرئيسي', newAssetLocation: null,
      },
    };
  }),
  { _id: '7234567890abcdef12345678', projectId, parent: null, name: '3.ملفات العميل', createdAt: project.createdAt, updatedAt: project.updatedAt },
  { _id: '8234567890abcdef12345678', projectId, parent: null, name: '4.حسابات القيمة', createdAt: project.createdAt, updatedAt: project.updatedAt },
];
const archivedProject = {
  ...project,
  _id: '9234567890abcdef12345678',
  name: 'تقييم خط إنتاج قديم — مثال مؤرشف',
  displayNumber: 7,
  referenceNumber: 'MV-2026-007',
  deletedAt: '2026-10-05T09:30:00Z',
  canRestore: true,
};
await page.addInitScript(() => {
  localStorage.setItem('mv:handbook:hidden:handbook-user', '1');
  sessionStorage.setItem('mv:handbook:seen:handbook-user', '1');
});
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ json: body });
  if (path === '/api/auth/me') return json({ user: { id: 'handbook-user', username: 'مستخدم التدريب', role: 'company_admin', companyId: 'handbook-company', companyName: 'شركة النور للتقييم', valueTechProductIds: null, createdAt: '2026-10-01' }, session: { id: 'handbook-session', isActive: true }, csrfToken: 'fixture', config: { enableTracking: false }, guestAccess: null });
  if (path === '/api/mv/projects/archive') return json({ totalCount: 3, activeCount: 2, deletedCount: 1, canRestore: true, canPermanentlyDelete: true, projects: [archivedProject] });
  if (path === '/api/mv/projects') return json([project, sourceProject]);
  if (path === `/api/mv/projects/${projectId}`) return json({ project, subProjects });
  if (path === `/api/mv/projects/${projectId}/asset-image-imports/sources`) return json([{ ...sourceProject, folderCount: 8, imageCount: 42 }]);
  if (path === `/api/mv/projects/${projectId}/files`) return json([
    { _id: 'file-1', projectId, subProjectId: null, name: 'محضر المعاينة.pdf', mimeType: 'application/pdf', sizeBytes: 245760, uploadedAt: project.updatedAt, updatedAt: project.updatedAt },
  ]);
  if (path === `/api/mv/projects/${projectId}/pic-assets/batch`) return json({ items: subProjects.filter(item => item.picAsset) });
  if (path.startsWith(`/api/mv/projects/${projectId}/subprojects/`)) {
    const id = path.split('/').pop();
    return json(subProjects.find(item => item._id === id) ?? {});
  }
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
  await capture('word', '/machine-valuation/settings/report/word-template', 'إضافة قالب جديد');
  await capture('pptx', '/machine-valuation/settings/report/pptx-template', 'إضافة قالب جديد');
  await capture('system', '/machine-valuation/settings/report/letterhead', 'مكتبة قوالب النظام');
  await capture('sections', '/machine-valuation/settings/report/letterhead', 'مكتبة قوالب النظام', () => page.getByRole('tab', { name: 'أقسام وتعريفات التقرير', exact: true }).click());
  await capture('data', `/machine-valuation/${projectId}/workflow/report-data`, 'بيانات التقرير');
  await capture('images', `/machine-valuation/${projectId}/workflow/asset-images`, 'صور الأصول');
  await capture('image-import', `/machine-valuation/${projectId}/workflow/asset-images`, 'صور الأصول', async () => {
    await page.getByRole('button', { name: 'إضافة صور', exact: true }).click();
    await page.getByRole('menuitem', { name: /استيراد من مشروع آخر/ }).click();
    await page.getByRole('heading', { name: 'استيراد صور من مشروع آخر', exact: true }).waitFor();
  });
  await capture('asset-data', `/machine-valuation/${projectId}/workflow/asset-images`, 'صور الأصول', async () => {
    await page.getByRole('button', { name: 'عرض بيانات الأصول', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: /بيانات الأصول/ });
    await dialog.waitFor();
    await dialog.evaluate(node => { node.style.height = '760px'; node.style.maxHeight = '760px'; });
    await page.getByRole('combobox').last().waitFor();
  });
  await capture('valuation', `/machine-valuation/${projectId}/workflow/valuation`, 'حسابات القيمة');
  await capture('files', `/machine-valuation/${projectId}/workflow/files`, 'ملفات العميل');
  await capture('project-files', `/machine-valuation/${projectId}/workflow/files`, 'ملفات العميل', async () => {
    await page.getByRole('button', { name: 'تحميل من مجلد ملفات العميل', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'اختيار من مجلد ملفات العميل', exact: true });
    await dialog.waitFor();
    await dialog.evaluate(node => { node.style.height = '760px'; node.style.maxHeight = '760px'; });
  });
  await capture('archive', '/machine-valuation/archive', 'يمكنك استعادة المشاريع المحذوفة');
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
