/** عناصر الفهرس — حقل anchor يحدد هدف التمرير (قد يتكرر للعناوين ضمن نفس الكتلة). */
export type MvReportTocRow = {
  num: string;
  title: string;
  anchor: string;
};

export const MV_REPORT_TOC_ROWS: MvReportTocRow[] = [
  { num: "1.0", title: "مقدمة", anchor: "mv-toc-1" },
  { num: "2.0", title: "التواريخ المستخدمة", anchor: "mv-toc-2" },
  { num: "3.0", title: "الامتثال لمعايير التقييم الدولية", anchor: "mv-b1" },
  { num: "4.0", title: "إقرار بالاستقلالية وعدم تضارب المصالح", anchor: "mv-b1" },
  { num: "5.0", title: "هوية المقيم", anchor: "mv-b1" },
  { num: "6.0", title: "هوية العميل (المستخدم المقصود)", anchor: "mv-b1" },
  { num: "7.0", title: "هوية المستخدمين المقصودين الآخرين", anchor: "mv-b1" },
  { num: "8.0", title: "نطاق العمل", anchor: "mv-b2" },
  { num: "9.0", title: "الغرض من التقييم", anchor: "mv-b2" },
  { num: "10.0", title: "الاستخدام المقصود", anchor: "mv-b2" },
  { num: "11.0", title: "أساس القيمة المستخدم", anchor: "mv-b2" },
  { num: "12.0", title: "فرضية القيمة", anchor: "mv-b2" },
  { num: "13.0", title: "القيود على الاستخدام أو التوزيع أو النشر", anchor: "mv-b2" },
  { num: "14.0", title: "الاستعانة بأخصائيين", anchor: "mv-b3" },
  { num: "15.0", title: "العوامل البيئية والاجتماعية والحوكمة", anchor: "mv-b3" },
  { num: "16.0", title: "نوع التقرير", anchor: "mv-b3" },
  { num: "17.0", title: "طبيعة ومصادر المعلومات المعتمد عليها", anchor: "mv-b3" },
  { num: "18.0", title: "الأصل محل التقييم", anchor: "mv-toc-18" },
  { num: "18.1", title: "الوصف الجزئي", anchor: "mv-toc-18-1" },
  { num: "19.0", title: "العملة", anchor: "mv-toc-19" },
  { num: "20.0", title: "المعاينة", anchor: "mv-toc-20" },
  { num: "21.0", title: "منهجية التقييم والتحليل", anchor: "mv-b4" },
  { num: "22.0", title: "تطبيق أسلوب التقييم", anchor: "mv-b4" },
  { num: "23.0", title: "الإفادات المهمة والإفادات الخاصة", anchor: "mv-b4" },
  { num: "24.0", title: "رأي القيمة", anchor: "mv-toc-24" },
  { num: "مرفق 1", title: "الوصف الجزئي وحسابات القيمة", anchor: "mv-annex-1" },
  { num: "مرفق 2", title: "صور الأصول", anchor: "mv-annex-2" },
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
  "mv-b1",
  "mv-b2",
  "mv-b3",
  "mv-toc-18",
  "mv-toc-18-1",
  "mv-toc-19",
  "mv-toc-20",
  "mv-b4",
  "mv-toc-24",
  "mv-annex-1",
  "mv-annex-2",
  "mv-annex-3",
  "mv-annex-sce",
];
