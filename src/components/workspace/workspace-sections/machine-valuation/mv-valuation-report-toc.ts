/**
 * فهرس التقرير النهائي — كل قسم له anchor خاص حت تتمكن قائمة التنقل من القفز
 * مباشرة إليه. الترتيب والأرقام مطابقان لشكل التقرير النهائي الاحترافي.
 */
export type MvReportTocRow = {
  num: string;
  title: string;
  anchor: string;
};

export const MV_REPORT_TOC_ROWS: MvReportTocRow[] = [
  { num: "1.0", title: "مقدمة", anchor: "mv-toc-1" },
  { num: "2.0", title: "التواريخ المستخدمة", anchor: "mv-toc-2" },
  { num: "3.0", title: "الامتثال لمعايير التقييم الدولية", anchor: "mv-toc-3" },
  { num: "4.0", title: "إقرار بالاستقلالية وعدم تضارب المصالح", anchor: "mv-toc-4" },
  { num: "5.0", title: "هوية المقيم", anchor: "mv-toc-5" },
  { num: "6.0", title: "هوية العميل (المستخدم المقصود)", anchor: "mv-toc-6" },
  { num: "7.0", title: "هوية المستخدمين المقصودين الآخرين", anchor: "mv-toc-7" },
  { num: "8.0", title: "نطاق العمل", anchor: "mv-toc-8" },
  { num: "9.0", title: "الغرض من التقييم", anchor: "mv-toc-9" },
  { num: "10.0", title: "الاستخدام المقصود", anchor: "mv-toc-10" },
  { num: "11.0", title: "أساس القيمة المستخدم", anchor: "mv-toc-11" },
  { num: "12.0", title: "فرضية القيمة", anchor: "mv-toc-12" },
  { num: "13.0", title: "القيود على الاستخدام أو التوزيع أو النشر", anchor: "mv-toc-13" },
  { num: "14.0", title: "الاستعانة بأخصائيين", anchor: "mv-toc-14" },
  { num: "15.0", title: "العوامل البيئية والاجتماعية والحوكمة", anchor: "mv-toc-15" },
  { num: "16.0", title: "نوع التقرير", anchor: "mv-toc-16" },
  { num: "17.0", title: "طبيعة ومصادر المعلومات المعتمد عليها", anchor: "mv-toc-17" },
  { num: "18.0", title: "الأصل محل التقييم", anchor: "mv-toc-18" },
  { num: "18.1", title: "الوصف الجزئي", anchor: "mv-toc-18-1" },
  { num: "19.0", title: "العملة", anchor: "mv-toc-19" },
  { num: "20.0", title: "المعاينة", anchor: "mv-toc-20" },
  { num: "21.0", title: "منهجية التقييم والتحليل", anchor: "mv-toc-21" },
  { num: "22.0", title: "تطبيق أسلوب التكلفة", anchor: "mv-toc-22" },
  { num: "22.1", title: "القيمة المتبقية (القيمة التخريدية)", anchor: "mv-toc-22-1" },
  { num: "22.2", title: "الإهلاك المادي", anchor: "mv-toc-22-2" },
  { num: "22.3", title: "التقادم الوظيفي", anchor: "mv-toc-22-3" },
  { num: "22.4", title: "التقادم الاقتصادي", anchor: "mv-toc-22-4" },
  { num: "23.0", title: "الافتراضات المهمة والافتراضات الخاصة", anchor: "mv-toc-23" },
  { num: "24.0", title: "رأي القيمة", anchor: "mv-toc-24" },
  { num: "مرفق 1", title: "الوصف الجزئي وحسابات القيمة", anchor: "mv-annex-1" },
  { num: "مرفق 2", title: "الصور الفوتوغرافية", anchor: "mv-annex-2" },
  { num: "مرفق 3", title: "مستندات مستلمة من العميل", anchor: "mv-annex-3" },
  {
    num: "مرفق 4",
    title: "شهادة التسجيل — بوابة الخدمات الإلكترونية للهيئة السعودية للمقيمين المعتمدين (تقييم)",
    anchor: "mv-annex-sce",
  },
];

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
  "mv-toc-19",
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
];
