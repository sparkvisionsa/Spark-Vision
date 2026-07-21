/** تعريف الإشارات المرجعية (Bookmarks) في ملف Word وربطها ببيانات المشروع */

export type MvWordBookmarkTextField =
  | "reportTitle"
  | "clientName"
  | "clientIdentity"
  | "valuationBasis"
  | "valuationPurpose"
  | "agreementDate"
  | "reportIssueDate"
  | "valuationDate"
  | "inspectionDate"
  | "valuePremise"
  | "finalValue"
  | "finalValueAmount"
  | "finalValueWords"
  | "inspectionLocation"
  | "inspectionMapUrl";

export type MvWordBookmarkImageField = "assetImages" | "valuationImages" | "clientImages";

export type MvWordTextBookmarkDef = {
  type: "text";
  field: MvWordBookmarkTextField;
  /** أسماء الإشارة المرجعية في Word (كما أضافها المستخدم) */
  names: string[];
  labelAr: string;
};

export type MvWordImageBookmarkDef = {
  type: "images";
  field: MvWordBookmarkImageField;
  names: string[];
  labelAr: string;
  layout: "grid3" | "stack";
};

export type MvWordBookmarkDef = MvWordTextBookmarkDef | MvWordImageBookmarkDef;

export const MV_WORD_TEXT_BOOKMARKS: MvWordTextBookmarkDef[] = [
  {
    type: "text",
    field: "reportTitle",
    names: ["عنوان", "عنوانغ", "غلاف", "عنواناصل"],
    labelAr: "عنوان الغلاف داخل التقرير",
  },
  {
    type: "text",
    field: "clientName",
    names: ["عميل", "عميلاستخدام", "عميلغلاف"],
    labelAr: "اسم العميل",
  },
  {
    type: "text",
    field: "clientIdentity",
    names: ["عميلهوية"],
    labelAr: "هوية العميل",
  },
  {
    type: "text",
    field: "valuationBasis",
    names: ["اساس"],
    labelAr: "أساس القيمة",
  },
  {
    type: "text",
    field: "valuationPurpose",
    names: ["الغرض", "غرضالتقييم"],
    labelAr: "الغرض من التقييم",
  },
  {
    type: "text",
    field: "agreementDate",
    names: [
      "تاريخاتفاق",
      "تاريخالاتفاق",
      "تاريخاتفاقية",
      "تاريخالاتفاقية",
      "تاريخالتعاقد",
      "تاريخاتفاقتاريخاصدار",
    ],
    labelAr: "تاريخ الاتفاقية (نطاق العمل)",
  },
  {
    type: "text",
    field: "reportIssueDate",
    names: ["تاريخاصدار", "تاريخالإصدار", "تاريخاصدارالتقرير", "تاريخإصدارالتقرير", "تاريخالتقرير"],
    labelAr: "تاريخ إصدار التقرير",
  },
  {
    type: "text",
    field: "valuationDate",
    names: ["تاريختقييم", "تاريختقييمت", "تاريختقييمق", "تاريخالتقييم"],
    labelAr: "تاريخ التقييم",
  },
  {
    type: "text",
    field: "inspectionDate",
    names: ["تاريخمعاين", "تاريخمعاينة", "تاريخالمعاين", "تاريخالمعاينة", "تاريخفحص", "تاريخالفحص"],
    labelAr: "تاريخ المعاينة",
  },
  {
    type: "text",
    field: "valuePremise",
    names: ["فرضية", "فرضية1"],
    labelAr: "فرضية القيمة",
  },
  {
    type: "text",
    field: "finalValue",
    names: ["قيمةنهائية", "قيمة", "القيمة", "رأيالقيمة", "رايالقيمة"],
    labelAr: "القيمة النهائية",
  },
  {
    type: "text",
    field: "finalValueAmount",
    names: ["قيمةرقم", "رقمالقيمة", "قيمةعدد", "رأيالقيمةرقم"],
    labelAr: "القيمة النهائية (أرقام فقط)",
  },
  {
    type: "text",
    field: "finalValueWords",
    names: ["قيمةاحرف"],
    labelAr: "القيمة كتابةً",
  },
  {
    type: "text",
    field: "inspectionLocation",
    names: ["موقع"],
    labelAr: "موقع المعاينة",
  },
  {
    type: "text",
    field: "inspectionMapUrl",
    names: ["قوقل"],
    labelAr: "رابط الخريطة",
  },
];

export const MV_WORD_IMAGE_BOOKMARKS: MvWordImageBookmarkDef[] = [
  {
    type: "images",
    field: "assetImages",
    names: ["صوراصول"],
    labelAr: "صور الأصول",
    layout: "grid3",
  },
  {
    type: "images",
    field: "valuationImages",
    names: ["صورحسابات"],
    labelAr: "صور حسابات القيمة",
    layout: "stack",
  },
  {
    type: "images",
    field: "clientImages",
    names: ["مستنداتعميل"],
    labelAr: "مستندات العميل (مرفق 3)",
    layout: "grid3",
  },
];

export const MV_WORD_ALL_BOOKMARKS: MvWordBookmarkDef[] = [
  ...MV_WORD_TEXT_BOOKMARKS,
  ...MV_WORD_IMAGE_BOOKMARKS,
];

export function normalizeBookmarkName(name: string): string {
  return name
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[\s_\-.،؛:\u060C\u061B\u0640]+/g, "")
    .trim()
    .toLowerCase();
}

const TEXT_BOOKMARK_LOOKUP = new Map<string, MvWordTextBookmarkDef>();
const IMAGE_BOOKMARK_LOOKUP = new Map<string, MvWordImageBookmarkDef>();

for (const def of MV_WORD_TEXT_BOOKMARKS) {
  for (const name of def.names) {
    TEXT_BOOKMARK_LOOKUP.set(normalizeBookmarkName(name), def);
  }
}

for (const def of MV_WORD_IMAGE_BOOKMARKS) {
  for (const name of def.names) {
    IMAGE_BOOKMARK_LOOKUP.set(normalizeBookmarkName(name), def);
  }
}

export function resolveTextBookmarkDef(name: string): MvWordTextBookmarkDef | undefined {
  return TEXT_BOOKMARK_LOOKUP.get(normalizeBookmarkName(name));
}

export function resolveImageBookmarkDef(name: string): MvWordImageBookmarkDef | undefined {
  return IMAGE_BOOKMARK_LOOKUP.get(normalizeBookmarkName(name));
}

export function listKnownBookmarkNames(): string[] {
  return MV_WORD_ALL_BOOKMARKS.flatMap((def) => def.names);
}
