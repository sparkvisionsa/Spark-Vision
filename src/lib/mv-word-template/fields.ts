import type { MvProjectReportData } from "@/components/workspace/workspace-sections/machine-valuation/types";
import { buildLabelPatterns } from "./label-patterns";

export type MvWordMergeFieldKey = keyof MvProjectReportData | "projectName" | "displayNumber";

export type MvWordMergeFieldDef = {
  key: MvWordMergeFieldKey;
  labelAr: string;
  labelEn: string;
  /** علامات بديلة يمكن للفنان استخدامها داخل القالب: {{clientName}} أو {{اسم_العميل}} */
  aliases: string[];
  /** أنماط نصية للاستبدال الذكي داخل ملف Word (بعد التسمية) */
  labelPatterns: RegExp[];
};

const label = (ar: string, extra: string[] = []) => buildLabelPatterns([ar, ...extra]);

export const MV_WORD_MERGE_FIELDS: MvWordMergeFieldDef[] = [
  {
    key: "projectName",
    labelAr: "اسم المشروع",
    labelEn: "Project name",
    aliases: ["projectName", "project_name", "اسم_المشروع", "اسم_التقرير"],
    labelPatterns: label("اسم المشروع", ["اسم التقرير / المشروع", "اسم التقرير", "اسم المشروع / التقرير"]),
  },
  {
    key: "displayNumber",
    labelAr: "رقم التقرير التسلسلي",
    labelEn: "Report serial number",
    aliases: ["displayNumber", "report_number", "رقم_التقرير"],
    labelPatterns: label("رقم التقرير داخل الشركة", ["رقم المرجع / رقم التقرير", "رقم المرجع", "رقم التقرير"]),
  },
  {
    key: "reportTitle",
    labelAr: "عنوان الغلاف",
    labelEn: "Report title",
    aliases: ["reportTitle", "report_title", "عنوان_الغلاف", "عنوان_التقرير"],
    labelPatterns: label("عنوان الغلاف داخل التقرير", ["عنوان التقرير", "عنوان الغلاف"]),
  },
  {
    key: "reportReference",
    labelAr: "رقم المرجع",
    labelEn: "Reference number",
    aliases: ["reportReference", "reference", "رقم_المرجع"],
    labelPatterns: label("رقم المرجع", ["المرجع", "رقم المرجع / Reference"]),
  },
  {
    key: "valuationMethod",
    labelAr: "أسلوب التقييم",
    labelEn: "Valuation method",
    aliases: ["valuationMethod", "اسلوب_التقييم", "الأسلوب_المستخدم"],
    labelPatterns: label("الأسلوب المستخدم داخل التقرير", ["أسلوب التقييم", "الأسلوب المستخدم"]),
  },
  {
    key: "valuationPurpose",
    labelAr: "الغرض من التقييم",
    labelEn: "Valuation purpose",
    aliases: ["valuationPurpose", "الغرض_من_التقييم"],
    labelPatterns: label("الغرض من التقييم", ["الغرض"]),
  },
  {
    key: "valuePremise",
    labelAr: "فرضية القيمة",
    labelEn: "Value premise",
    aliases: ["valuePremise", "فرضية_القيمة"],
    labelPatterns: label("فرضية القيمة"),
  },
  {
    key: "valuationBasis",
    labelAr: "أساس القيمة",
    labelEn: "Valuation basis",
    aliases: ["valuationBasis", "اساس_القيمة"],
    labelPatterns: label("أساس القيمة", ["أساس التقييم"]),
  },
  {
    key: "reportTypeLabel",
    labelAr: "نوع التقرير المهني",
    labelEn: "Professional report type",
    aliases: ["reportTypeLabel", "نوع_التقرير_المهني"],
    labelPatterns: label("نوع التقرير المهني", ["نوع التقرير"]),
  },
  {
    key: "standardsVersion",
    labelAr: "المعايير والإصدارات",
    labelEn: "Standards version",
    aliases: ["standardsVersion", "المعايير"],
    labelPatterns: label("المعايير والإصدارات المطبقة", ["المعايير المطبقة", "المعايير"]),
  },
  {
    key: "currencyLabel",
    labelAr: "العملة",
    labelEn: "Currency",
    aliases: ["currencyLabel", "العملة"],
    labelPatterns: label("العملة", ["عملة التقرير"]),
  },
  {
    key: "reportIssueDate",
    labelAr: "تاريخ إصدار التقرير",
    labelEn: "Issue date",
    aliases: ["reportIssueDate", "تاريخ_الاصدار"],
    labelPatterns: label("تاريخ إصدار التقرير", ["تاريخ الإصدار", "تاريخ اصدار التقرير"]),
  },
  {
    key: "inspectionDate",
    labelAr: "تاريخ المعاينة",
    labelEn: "Inspection date",
    aliases: ["inspectionDate", "تاريخ_المعاينة"],
    labelPatterns: label("تاريخ المعاينة", ["تاريخ الفحص"]),
  },
  {
    key: "valuationDate",
    labelAr: "تاريخ التقييم",
    labelEn: "Valuation date",
    aliases: ["valuationDate", "تاريخ_التقييم"],
    labelPatterns: label("تاريخ التقييم", ["تاريخ قياس القيمة"]),
  },
  {
    key: "agreementDate",
    labelAr: "تاريخ الاتفاقية",
    labelEn: "Agreement date",
    aliases: ["agreementDate", "تاريخ_الاتفاقية"],
    labelPatterns: label("تاريخ الاتفاقية", ["تاريخ الاتفاقية (نطاق العمل)", "تاريخ التعاقد"]),
  },
  {
    key: "inspectionLocation",
    labelAr: "موقع المعاينة",
    labelEn: "Inspection location",
    aliases: ["inspectionLocation", "موقع_المعاينة"],
    labelPatterns: label("موقع المعاينة", ["مكان المعاينة", "موقع الأصول"]),
  },
  {
    key: "clientName",
    labelAr: "اسم العميل",
    labelEn: "Client name",
    aliases: ["clientName", "اسم_العميل"],
    labelPatterns: label("اسم العميل", ["العميل", "اسم الجهة", "اسم الشركة", "الجهة المالكة", "اسم الجهة المالكة"]),
  },
  {
    key: "clientEmail",
    labelAr: "بريد العميل",
    labelEn: "Client email",
    aliases: ["clientEmail", "بريد_العميل"],
    labelPatterns: label("البريد الإلكتروني", ["بريد العميل", "البريد"]),
  },
  {
    key: "clientPhone",
    labelAr: "هاتف العميل",
    labelEn: "Client phone",
    aliases: ["clientPhone", "هاتف_العميل"],
    labelPatterns: label("هاتف العميل", ["رقم الهاتف", "الهاتف", "جوال العميل"]),
  },
  {
    key: "clientLegalType",
    labelAr: "الكيان القانوني",
    labelEn: "Legal entity type",
    aliases: ["clientLegalType", "الكيان_القانوني"],
    labelPatterns: label("الكيان القانوني", ["الشكل القانوني"]),
  },
  {
    key: "clientActivity",
    labelAr: "نشاط العميل",
    labelEn: "Client activity",
    aliases: ["clientActivity", "نشاط_العميل"],
    labelPatterns: label("نشاط العميل", ["نشاط الشركة"]),
  },
  {
    key: "clientRepresentativeName",
    labelAr: "اسم ممثل العميل",
    labelEn: "Client representative",
    aliases: ["clientRepresentativeName", "ممثل_العميل"],
    labelPatterns: label("اسم ممثل العميل", ["ممثل العميل", "الممثل"]),
  },
  {
    key: "clientRepresentativeRole",
    labelAr: "صفة ممثل العميل",
    labelEn: "Representative role",
    aliases: ["clientRepresentativeRole", "صفة_الممثل"],
    labelPatterns: label("صفة ممثل العميل", ["صفة الممثل", "منصب الممثل"]),
  },
  {
    key: "intendedUsers",
    labelAr: "المستخدمون المقصودون",
    labelEn: "Intended users",
    aliases: ["intendedUsers", "المستخدمون_المقصودون"],
    labelPatterns: label("المستخدمون المقصودون", ["المستخدم المقصود"]),
  },
  {
    key: "intendedUse",
    labelAr: "الاستخدام المقصود",
    labelEn: "Intended use",
    aliases: ["intendedUse", "الاستخدام_المقصود"],
    labelPatterns: label("الاستخدام المقصود", ["الغرض من الاستخدام"]),
  },
  {
    key: "finalValue",
    labelAr: "القيمة النهائية",
    labelEn: "Final value",
    aliases: ["finalValue", "القيمة_النهائية", "قيمة_التقييم"],
    labelPatterns: label("القيمة النهائية", [
      "قيمة التقييم",
      "القيمة السوقية",
      "القيمة الإجمالية",
      "إجمالي القيمة",
    ]),
  },
  {
    key: "finalValueWords",
    labelAr: "القيمة كتابةً",
    labelEn: "Final value in words",
    aliases: ["finalValueWords", "القيمة_كتابة", "قيمة_كتابة"],
    labelPatterns: label("القيمة كتابة", ["القيمة كتابةً", "القيمة بالحروف", "القيمة كتابةاً"]),
  },
  {
    key: "valuationFirmName",
    labelAr: "اسم شركة التقييم",
    labelEn: "Valuation firm",
    aliases: ["valuationFirmName", "اسم_شركة_التقييم"],
    labelPatterns: label("اسم شركة التقييم", ["شركة التقييم", "الجهة المقيّمة", "مكتب التقييم"]),
  },
  {
    key: "valuationFirmLicense",
    labelAr: "رخصة شركة التقييم",
    labelEn: "Firm license",
    aliases: ["valuationFirmLicense", "رخصة_التقييم"],
    labelPatterns: label("رخصة شركة التقييم", ["رقم الرخصة", "رخصة الهيئة"]),
  },
  {
    key: "leadValuerName",
    labelAr: "اسم المقيّم",
    labelEn: "Lead valuer",
    aliases: ["leadValuerName", "اسم_المقيم"],
    labelPatterns: label("اسم المقيّم", ["المقيّم الرئيسي", "اسم المقيم المعتمد"]),
  },
  {
    key: "scopeOfWorkDetails",
    labelAr: "نطاق العمل",
    labelEn: "Scope of work",
    aliases: ["scopeOfWorkDetails", "نطاق_العمل"],
    labelPatterns: label("نطاق العمل", ["تفاصيل نطاق العمل", "نطاق الخدمة"]),
  },
  {
    key: "assetSubjectDescription",
    labelAr: "وصف موضوع التقييم",
    labelEn: "Asset subject",
    aliases: ["assetSubjectDescription"],
    labelPatterns: label("وصف موضوع التقييم", ["موضوع التقييم", "وصف الأصل"]),
  },
  {
    key: "assetDetailedDescription",
    labelAr: "الوصف التفصيلي",
    labelEn: "Detailed description",
    aliases: ["assetDetailedDescription"],
    labelPatterns: label("الوصف التفصيلي", ["وصف تفصيلي للأصل", "الوصف التفصيلي للأصل"]),
  },
  {
    key: "methodologyRationale",
    labelAr: "مبررات المنهجية",
    labelEn: "Methodology rationale",
    aliases: ["methodologyRationale"],
    labelPatterns: label("مبررات المنهجية", ["منهجية التقييم", "أساس المنهجية"]),
  },
  {
    key: "generalAssumptions",
    labelAr: "الافتراضات العامة",
    labelEn: "General assumptions",
    aliases: ["generalAssumptions", "importantAssumptions"],
    labelPatterns: label("الافتراضات العامة", ["افتراضات عامة", "الافتراضات المهمة"]),
  },
  {
    key: "specialAssumptions",
    labelAr: "الافتراضات الخاصة",
    labelEn: "Special assumptions",
    aliases: ["specialAssumptions"],
    labelPatterns: label("الافتراضات الخاصة", ["افتراضات خاصة"]),
  },
];

export const MV_WORD_IMAGE_LOOP_TAGS = {
  assetImages: {
    tag: "assetImages",
    labelAr: "صور الأصول",
    hint: "{{#assetImages}}{{@image}}{{/assetImages}}",
  },
  valuationImages: {
    tag: "valuationImages",
    labelAr: "صور حسابات القيمة",
    hint: "{{#valuationImages}}{{@image}}{{/valuationImages}}",
  },
  clientImages: {
    tag: "clientImages",
    labelAr: "مستندات العميل",
    hint: "{{#clientImages}}{{@image}}{{/clientImages}}",
  },
} as const;

export function resolveFieldByAlias(tag: string): MvWordMergeFieldDef | undefined {
  const normalized = tag.trim().replace(/\s+/g, "_");
  return MV_WORD_MERGE_FIELDS.find(
    (field) =>
      field.key === normalized ||
      field.aliases.some((alias) => alias.toLowerCase() === normalized.toLowerCase()),
  );
}
