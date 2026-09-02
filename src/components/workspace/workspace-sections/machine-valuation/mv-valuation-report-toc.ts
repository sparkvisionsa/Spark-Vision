/**
 * فهرس التقرير النهائي — كل قسم له anchor خاص حتى تتمكن قائمة التنقل من القفز
 * مباشرة إليه. الترقيم والتسميات مطابقة لقالب التقرير الاحترافي المعتمد لدى
 * الهيئة السعودية للمقيمين المعتمدين (تقييم) — 1.0 → 27.0 مع 4 مرفقات.
 *
 * الإضافات الجديدة:
 *  - 8.0  الأصل محل التقييم (مختصر مع إشارة للمرفقات)
 *  - 20.0 الاستثناءات
 *  - 22.0 إجراءات التقييم
 *  - 25.0 تطبيق أسلوب التقييم (العنوان ديناميكي حسب الأسلوب المختار)
 */
export type MvReportTocRow = {
  num: string;
  title: string;
  anchor: string;
};

export const MV_REPORT_TOC_ROWS: MvReportTocRow[] = [
  { num: "1.0", title: "مقدمة", anchor: "mv-toc-1" },
  { num: "2.0", title: "التواريخ المستخدمة", anchor: "mv-toc-2" },
  { num: "3.0", title: "الالتزام بمعايير التقييم", anchor: "mv-toc-3" },
  { num: "4.0", title: "الاستقلالية وعدم تضارب المصالح", anchor: "mv-toc-4" },
  { num: "5.0", title: "هوية المقيم", anchor: "mv-toc-5" },
  { num: "6.0", title: "هوية العميل", anchor: "mv-toc-6" },
  { num: "7.0", title: "من يجوز له استخدام التقرير", anchor: "mv-toc-7" },
  { num: "8.0", title: "الأصل محل التقييم", anchor: "mv-toc-asset-summary" },
  { num: "9.0", title: "نطاق العمل", anchor: "mv-toc-8" },
  { num: "10.0", title: "الغرض من التقييم", anchor: "mv-toc-9" },
  { num: "11.0", title: "الغرض من استخدام التقرير", anchor: "mv-toc-10" },
  { num: "12.0", title: "أساس القيمة", anchor: "mv-toc-11" },
  { num: "13.0", title: "فرضية القيمة", anchor: "mv-toc-12" },
  { num: "14.0", title: "قيود استخدام التقرير ونشره", anchor: "mv-toc-13" },
  { num: "15.0", title: "الاستعانة بأخصائيين", anchor: "mv-toc-14" },
  { num: "16.0", title: "العوامل البيئية والاجتماعية", anchor: "mv-toc-15" },
  { num: "17.0", title: "نوع التقرير", anchor: "mv-toc-16" },
  { num: "18.0", title: "مصادر المعلومات", anchor: "mv-toc-17" },
  { num: "19.0", title: "الأصل محل التقييم", anchor: "mv-toc-18" },
  { num: "19.1", title: "الوصف الجزئي", anchor: "mv-toc-18-1" },
  { num: "20.0", title: "الاستثناءات", anchor: "mv-toc-exclusions" },
  { num: "21.0", title: "العملة", anchor: "mv-toc-19" },
  { num: "22.0", title: "إجراءات التقييم", anchor: "mv-toc-procedures" },
  { num: "23.0", title: "المعاينة", anchor: "mv-toc-20" },
  { num: "24.0", title: "منهجية التقييم", anchor: "mv-toc-21" },
  { num: "25.0", title: "تطبيق أسلوب التقييم", anchor: "mv-toc-22" },
  { num: "25.1", title: "القيمة المتبقية", anchor: "mv-toc-22-1" },
  { num: "25.2", title: "الإهلاك المادي", anchor: "mv-toc-22-2" },
  { num: "25.3", title: "التقادم الوظيفي", anchor: "mv-toc-22-3" },
  { num: "25.4", title: "التقادم الاقتصادي", anchor: "mv-toc-22-4" },
  { num: "26.0", title: "الافتراضات المهمة", anchor: "mv-toc-23" },
  { num: "27.0", title: "رأي القيمة", anchor: "mv-toc-24" },
  { num: "مرفق 1", title: "حسابات القيمة", anchor: "mv-annex-1" },
  { num: "مرفق 2", title: "صور الأصول", anchor: "mv-annex-2" },
  { num: "مرفق 3", title: "مستندات العميل", anchor: "mv-annex-3" },
  { num: "مرفق 4", title: "شهادة التسجيل في بوابة «تقييم»", anchor: "mv-annex-sce" },
  { num: "ختام", title: "صفحة الخاتمة", anchor: "mv-report-closing" },
];

/** فواصل الفصول الأربعة في قالب النظام — عناوين قصيرة يفهمها غير المختص. */
export const MV_REPORT_CHAPTERS = [
  {
    sequence: "01",
    title: "مقدمة التقرير",
    summary: "ما هو هذا التقرير، ومن أطرافه، وما هي تواريخه.",
  },
  {
    sequence: "02",
    title: "نطاق العمل ووصف الأصل",
    summary: "ماذا يشمل التقييم، وما هو الأصل، ومن أين جاءت البيانات.",
  },
  {
    sequence: "03",
    title: "طريقة التقييم والنتيجة",
    summary: "كيف تم التقييم، وما هي القيمة النهائية.",
  },
  {
    sequence: "04",
    title: "المرفقات",
    summary: "حسابات القيمة، صور الأصول، ومستندات العميل.",
  },
] as const;

export function mvReportTocHeading(anchor: string): string {
  const row = MV_REPORT_TOC_ROWS.find((item) => item.anchor === anchor);
  return row ? `${row.num} ${row.title}` : "";
}

export function mvReportAnnexHeading(anchor: string): string {
  const row = MV_REPORT_TOC_ROWS.find((item) => item.anchor === anchor);
  return row ? `${row.num}: ${row.title}` : "";
}

/** ترتيب العناصر لاكتشاف القسم النشط أثناء التمرير */
export const MV_REPORT_SCROLL_ANCHOR_ORDER: string[] = [
  "report-cover",
  "report-toc",
  "mv-toc-1",
  "mv-toc-2",
  "mv-toc-3",
  "mv-toc-4",
  "mv-toc-5",
  "mv-toc-6",
  "mv-toc-7",
  "mv-toc-asset-summary",
  "mv-toc-8",
  "mv-toc-9",
  "mv-toc-10",
  "mv-toc-11",
  "mv-toc-12",
  "mv-toc-13",
  "mv-toc-14",
  "mv-toc-15",
  "mv-toc-16",
  "mv-toc-17",
  "mv-toc-18",
  "mv-toc-18-1",
  "mv-toc-exclusions",
  "mv-toc-19",
  "mv-toc-procedures",
  "mv-toc-20",
  "mv-toc-21",
  "mv-toc-22",
  "mv-toc-22-1",
  "mv-toc-22-2",
  "mv-toc-22-3",
  "mv-toc-22-4",
  "mv-toc-23",
  "mv-toc-24",
  "mv-annex-1",
  "mv-annex-2",
  "mv-annex-3",
  "mv-annex-sce",
  "mv-report-closing",
];
