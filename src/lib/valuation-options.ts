// lib/valuation-options.ts — option lists used by the Default values page.
export type Opt = { value: string; ar: string; en: string };
const o = (value: string, ar: string, en: string): Opt => ({ value, ar, en });

export const VALUATION_PURPOSES: Opt[] = [
  o("1", "التمويل", "Financing"), o("2", "الشراء", "Purchase"), o("3", "البيع", "Sale"),
  o("4", "الرهن", "Mortgage"), o("5", "محاسبة", "Accounting"), o("6", "إفلاس", "Bankruptcy"),
  o("7", "استحواذ", "Acquisition"), o("8", "التقرير المالي", "Financial Reporting"),
  o("9", "الضرائب", "Taxes"), o("10", "الأغراض التأمينية", "Insurance Purposes"),
  o("11", "تقاضي", "Litigation"), o("12", "أغراض داخلية", "Internal Purposes"),
  o("13", "نزع الملكية", "Expropriation"), o("14", "نقل", "Transfer"), o("15", "ورث", "Inheritance"),
  o("16", "اخرى", "Other"), o("17", "توزيع تركه", "Estate Distribution"),
  o("18", "البيع القسري", "Forced Sale"), o("19", "معرفة القيمة السوقية", "Market Value Assessment"),
  o("20", "معرفة القيمة الإيجارية", "Rental Value Assessment"), o("21", "التصفية", "Liquidation"),
  o("50", "أغراض إستثمارية", "Investment Purposes"), o("54", "التعويض", "Compensation"),
  o("56", "البيع بالمزاد", "Auction Sale"),
];

export const VALUATION_BASES: Opt[] = [
  o("1", "القيمة السوقية", "Market Value"), o("2", "القيمة الاستثمارية", "Investment Value"),
  o("3", "القيمة المنصفة", "Fair Value"), o("4", "قيمة التصفية", "Liquidation Value"),
  o("5", "القيمة التكاملية", "Integrated Value"), o("6", "الايجار السوقي", "Market Rent"),
  o("7", "القيمة السوقية / قيمة الايجار السوقي", "Market Value / Market Rent"),
  o("8", "القيمة العادلة", "Fair Market Value"),
  o("10", "الإدراج في القوائم المالية", "Inclusion in Financial Statements"),
];

export const OWNERSHIP_TYPES: Opt[] = [
  o("1", "الملكية المطلقة", "Freehold"), o("2", "الملكية المشروطة", "Conditional Ownership"),
  o("3", "الملكية المقيدة", "Restricted Ownership"), o("4", "ملكية مدى الحياة", "Life Estate"),
  o("5", "منفعة", "Usufruct"), o("6", "مشاع", "Shared"), o("7", "ملكية مرهونة", "Mortgaged Ownership"),
];

export const VALUATION_HYPOTHESES: Opt[] = [
  o("1", "الاستخدام الحالي", "Current Use"), o("2", "الاستخدام الأعلى والأفضل", "Highest and Best Use"),
  o("3", "التصفية المنظمة", "Orderly Liquidation"), o("4", "البيع القسري", "Forced Sale"),
];

export const BRANCHES: Opt[] = [
  o("1", "تقييم العقارات", "Real Estate Valuation"),
  o("3", "تقييم الآلات والمعدات", "Machinery & Equipment Valuation"),
];

export const ASSET_CATEGORIES: Opt[] = [o("1", "أراضي", "Land"), o("2", "مباني", "Buildings")];

export const ELEVATIONS: Opt[] = [
  o("مرتفع", "مرتفع", "High"), o("مستوي", "مستوي", "Level"), o("منخفض", "منخفض", "Low"),
];

export const INSPECTION_BOUNDARIES: Opt[] = [
  o("معاينة خارجية", "معاينة خارجية", "External Inspection"),
  o("معاينة داخلية", "معاينة داخلية", "Internal Inspection"),
  o("معاينة داخلية وخارجية", "معاينة داخلية وخارجية", "Internal & External Inspection"),
];

export const STREET_FRONTS: Opt[] = [
  o("0", "لا يوجد شارع", "No Street"), o("1", "شارع واحد", "1 Street"), o("2", "شارعين", "2 Streets"),
  o("3", "3 شوارع", "3 Streets"), o("4", "4 شوارع", "4 Streets"),
];

export const BUILDING_CONDITIONS: Opt[] = [
  o("10001", "جديد", "New"), o("10002", "مستخدم", "Used"),
  o("10003", "تحت الإنشاء", "Under Construction"), o("10004", "اخرى", "Other"),
];

export const FINISH_LEVELS: Opt[] = [
  o("23", "تشطيب فاخر", "Luxury Finish"), o("24", "تشطيب متوسط", "Medium Finish"),
  o("25", "تشطيب عادي", "Basic Finish"), o("10006", "بدون تشطيب", "No Finish"),
];

export const BUILD_QUALITIES: Opt[] = [
  o("44", "ممتاز", "Excellent"), o("45", "جيد جداً", "Very Good"),
  o("46", "ردئ", "Poor"), o("10058", "جيد", "Good"),
];

export const SURROUNDINGS: Opt[] = [
  o("mosque", "مسجد", "Mosque"), o("commercialMarket", "سوق تجاري", "Commercial Market"),
  o("park", "حديقة", "Park"), o("governmentFacility", "مرفق حكومي", "Government Facility"),
  o("highSpeedRoad", "طريق سريع", "High-Speed Road"), o("otherServices", "خدمات أخرى", "Other Services"),
  o("educationalFacility", "مرفق تعليمي", "Educational Facility"),
  o("securityFacility", "مرفق أمني", "Security Facility"),
  o("medicalFacility", "مرفق طبي", "Medical Facility"),
];
