"use client";

import { useEffect, useState, useContext } from "react";
import { toApiUrl } from "@/lib/api-url";
import { SettlementRow } from "./SettlementComparison";
import { SettlementComparison } from "./SettlementComparison";
import React from "react";
import { DEFAULT_SECTION1_TITLES } from "./SettlementComparison";
import { LanguageContext } from "@/components/layout-provider";

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  ar: {
    loading: "جاري تحميل بيانات المعاملة...",
    errorPrefix: "خطأ في تحميل البيانات:",
    noId: "لم يتم تحديد معرف المعاملة",
    back: "← العودة",
    saving: "جاري الحفظ...",
    save: "💾 حفظ في قاعدة البيانات",
    download: "⬇ تحميل",
    savedOk: "✓ تم الحفظ بنجاح",
    saveError: "✗ فشل الحفظ. يرجى المحاولة مجدداً.",
    pageTitle: "تفاصيل المعاملة",
    // section titles
    secRequest: "معلومات الطلب",
    secLinks: "🔗 الروابط الهامة (استعلامات ومخططات)",
    secAssetDetails: "تفاصيل الأصول",
    secAssetInfo: "معلومات الأصل",
    secLocation: "الموقع وتصنيف الأصل",
    secBasic: "البيانات الأساسية",
    secBoundaries: "الحدود والأطوال",
    secFinishing: "بيانات التشطيب",
    secServices: "خدمات العقار",
    secMap: "الموقع على الخارطة",
    secComparison: "المقارنة",
    secReplacement: "تكلفة الإحلال",
    secMethods: "طرق التقييم",
    secAppraiser: "رأي المقيم",
    secReport: "بنود التقرير",
    secAuthors: "معدي التقرير",
    // request info labels
    refNo: "الرقم المرجعي",
    assignmentNo: "رقم التكليف",
    assignmentDate: "تاريخ التكليف",
    valuationPurpose: "الغرض من التقييم",
    valuationBasis: "أساس القيمة",
    ownershipType: "نوع الملكية",
    valuationHypothesis: "فرضية التقييم",
    assetCount: "عدد الأصول",
    client: "العميل",
    template: "النموذج",
    notes: "ملاحظات",
    // asset info labels
    address: "العنوان",
    assetType: "نوع الأصل",
    assetArea: "مساحة الأصل",
    usage: "الاستخدام",
    inspector: "المعاين",
    contactNo: "رقم التواصل",
    reviewer: "المراجع",
    // action buttons
    btnImages: "📷 الصور",
    btnAttachments: "📎 المرفقات",
    btnEdit: "✏️ تعديل",
    btnNearComps: "🗺 المقارنات القريبة",
    btnCopyComps: "📌 نسخ المقارنات",
    btnView: "🖨 عرض",
    btnPdf: "📄 تحميل PDF",
    btnMessages: "💬 ملاحظات",
    // location
    region: "المنطقة",
    city: "المدينة",
    neighborhood: "الحي",
    assetCategory: "تصنيف الأصل",
    selectRegion: "الرجاء اختيار المنطقة",
    enterCity: "الرجاء إدخال المدينة",
    enterNeighborhood: "الرجاء إدخال الحي",
    selectCategory: "الرجاء اختيار التصنيف",
    selectPropertyType: "الرجاء اختيار نوع العقار",
    land: "أراضي",
    buildings: "مباني",
    // basic
    propertyCode: "رمز العقار",
    clientName: "اسم العميل",
    authorizedName: "اسم المفوض بطلب التقييم",
    ownerName: "اسم المالك",
    deedNumber: "رقم الصك",
    deedDate: "تاريخ الصك",
    // boundaries
    northBoundary: "الحد الشمالي",
    northLength: "طول الحد الشمالي",
    southBoundary: "الحد الجنوبي",
    southLength: "طول الحد الجنوبي",
    eastBoundary: "الحد الشرقي",
    eastLength: "طول الحد الشرقي",
    westBoundary: "الحد الغربي",
    westLength: "طول الحد الغربي",
    // finishing
    buildingState: "حالة المبنى",
    floorsCount: "عدد الادوار",
    propertyAge: "عمر العقار",
    finishLevel: "مستوى التشطيب",
    buildQuality: "حالة البناء",
    selectValue: "الرجاء اختيار قيمة",
    stateNew: "جديد",
    stateUsed: "مستخدم",
    stateUnderConstruction: "تحت الإنشاء",
    stateOther: "اخرى",
    finishLuxury: "تشطيب فاخر",
    finishMedium: "تشطيب متوسط",
    finishBasic: "تشطيب عادي",
    finishNone: "بدون تشطيب",
    qualityExcellent: "ممتاز",
    qualityVeryGood: "جيد جداً",
    qualityPoor: "ردئ",
    qualityGood: "جيد",
    // services
    street: "الشارع",
    electricity: "الكهرباء",
    water: "المياه",
    phone: "الهاتف",
    drainage: "التصريف",
    pavedStreets: "الشوارع مسفلته",
    lighting: "الإنارة",
    internet: "الإنترنت",
    // map
    coords: "الاحداثيات",
    lat: "خط العرض",
    lng: "خط الطول",
    zoomMap: "الزوم (الخارطة)",
    zoomAerial: "الزوم (الصورة الجوية)",
    zoomComparisons: "الزوم (خريطة المقارنات)",
    // replacement
    meterPriceLand: "سعر المتر للأرض",
    landSpace: "مساحة الأرض",
    landValueCalc: "قيمة الأرض (محسوبة)",
    managementPct: "نسبة الرسوم الإدارية %",
    professionalPct: "نسبة الرسوم المهنية %",
    utilityNetworkPct: "نسبة شبكة المرافق %",
    emergencyPct: "نسبة التكاليف الطارئة %",
    financePct: "نسبة التمويل %",
    yearDev: "مدة التطوير (سنوات)",
    earningsRate: "هامش ربح المطور %",
    buildAge: "عمر الأصل الفعلي",
    defaultAge: "عمر الأصل الافتراضي",
    depreciationPct: "التقادم المادي %",
    economicPct: "التقادم الاقتصادي %",
    careerPct: "التقادم الوظيفي %",
    maintenancePrice: "تكاليف الصيانة",
    finishesPrice: "تكاليف التشطيبات المتبقية",
    completionPct: "نسبة إكتمال البناء %",
    // valuation methods
    vmMarket: "المقارنة",
    vmCost: "تكلفة الإحلال",
    vmIncome: "الاستثمار",
    vmResidual: "القيمة المتبقية",
    vmDcf: "DCF",
    vmRental: "القيمة الإيجارية",
    comingSoon: "هذا القسم قيد التطوير.",
    marketMeterPrice: "سعر المتر (جدول)",
    marketWeightPct: "النسبة الموزونة",
    propertyAreaMethod: "مساحة العقار",
    total: "المجموع",
    usageReason: "سبب الإستخدام",
    costNetBuildings: "صافي تكلفة المباني",
    costNetLandPrice: "صافي سعر الأرض",
    costLandBuildTotal: "صافي قيمة الأرض والمباني",
    incomeTotal: "إجمالي الدخل",
    // appraiser
    evalDate: "تاريخ المعاينة",
    completedDate: "تاريخ التقييم",
    reportDate: "تاريخ التقرير",
    finalAssetValue: "القيمة النهائية للأصل",
    appraiserDesc: "وصف المقيم ورأيه حول الأصل",
    appraiserNotes: "الملاحظات أو النواقص",
    // report
    standards: "معايير التقييم المتبعة",
    scope: "نطاق البحث والاستقصاء",
    assumptions: "الافتراضات",
    risks: "المخاطر أو عدم اليقين",
    // authors
    authorId: "معد %n — معرف/اسم",
    authorTitle: "معد %n — المنصب",
    // comparison table
    compDate: "التاريخ",
    compType: "النوع",
    compKind: "نوع المقارنة",
    compArea: "المساحة",
    compMeterPrice: "سعر المتر",
    compTotalPrice: "الإجمالي",
    compBaad: "البَعد",
    compRoads: "عدد الشوارع",
    compStreet: "عرض الشارع",
    compSource: "المصدر",
    compNotes: "ملاحظات",
    compCoords: "الإحداثيات",
    compDelete: "حذف",
    addComparison: "＋ مقارنة جديدة",
    // settlement table
    settlementItem: "البند",
    settlementSubject: "محل التقييم",
    settlementComp: "المقارنة",
    settlementDesc: "وصف",
    settlementAdj: "تعديل",
    meterPrice: "سعر المتر",
    totalAdjustments: "مجموع التسويات",
    priceAfterAdj: "سعر المقارن بعد التسوية",
    addSettlement: "＋ بند تسوية",
    // replacement table
    repTitle: "العنوان",
    repArea: "المساحة",
    repPrice: "السعر",
    repTotal: "الإجمالي",
    repNotes: "ملاحظات",
    repUseArea: "يُحتسب بالمساحة",
    repDelete: "حذف",
    addRepLine: "＋ بند جديد",
    // misc
    close: "إغلاق",
    assetCountVal: "1",
  },
  en: {
    loading: "Loading transaction data...",
    errorPrefix: "Error loading data:",
    noId: "No transaction ID specified",
    back: "← Back",
    saving: "Saving...",
    save: "💾 Save to Database",
    download: "⬇ Download",
    savedOk: "✓ Saved successfully",
    saveError: "✗ Save failed. Please try again.",
    pageTitle: "Transaction Details",
    // section titles
    secRequest: "Request Information",
    secLinks: "🔗 Important Links (Queries & Maps)",
    secAssetDetails: "Asset Details",
    secAssetInfo: "Asset Information",
    secLocation: "Location & Asset Classification",
    secBasic: "Basic Data",
    secBoundaries: "Boundaries & Dimensions",
    secFinishing: "Finishing Data",
    secServices: "Property Services",
    secMap: "Map Location",
    secComparison: "Comparison",
    secReplacement: "Replacement Cost",
    secMethods: "Valuation Methods",
    secAppraiser: "Appraiser Opinion",
    secReport: "Report Items",
    secAuthors: "Report Authors",
    // request info labels
    refNo: "Reference Number",
    assignmentNo: "Assignment Number",
    assignmentDate: "Assignment Date",
    valuationPurpose: "Valuation Purpose",
    valuationBasis: "Valuation Basis",
    ownershipType: "Ownership Type",
    valuationHypothesis: "Valuation Hypothesis",
    assetCount: "Asset Count",
    client: "Client",
    template: "Template",
    notes: "Notes",
    // asset info labels
    address: "Address",
    assetType: "Asset Type",
    assetArea: "Asset Area",
    usage: "Usage",
    inspector: "Inspector",
    contactNo: "Contact Number",
    reviewer: "Reviewer",
    // action buttons
    btnImages: "📷 Images",
    btnAttachments: "📎 Attachments",
    btnEdit: "✏️ Edit",
    btnNearComps: "🗺 Nearby Comparisons",
    btnCopyComps: "📌 Copy Comparisons",
    btnView: "🖨 View",
    btnPdf: "📄 Download PDF",
    btnMessages: "💬 Notes",
    // location
    region: "Region",
    city: "City",
    neighborhood: "Neighborhood",
    assetCategory: "Asset Category",
    selectRegion: "Please select region",
    enterCity: "Please enter city",
    enterNeighborhood: "Please enter neighborhood",
    selectCategory: "Please select category",
    selectPropertyType: "Please select property type",
    land: "Land",
    buildings: "Buildings",
    // basic
    propertyCode: "Property Code",
    clientName: "Client Name",
    authorizedName: "Authorized Requester Name",
    ownerName: "Owner Name",
    deedNumber: "Deed Number",
    deedDate: "Deed Date",
    // boundaries
    northBoundary: "North Boundary",
    northLength: "North Length",
    southBoundary: "South Boundary",
    southLength: "South Length",
    eastBoundary: "East Boundary",
    eastLength: "East Length",
    westBoundary: "West Boundary",
    westLength: "West Length",
    // finishing
    buildingState: "Building State",
    floorsCount: "Floors Count",
    propertyAge: "Property Age",
    finishLevel: "Finish Level",
    buildQuality: "Build Quality",
    selectValue: "Please select a value",
    stateNew: "New",
    stateUsed: "Used",
    stateUnderConstruction: "Under Construction",
    stateOther: "Other",
    finishLuxury: "Luxury Finish",
    finishMedium: "Medium Finish",
    finishBasic: "Basic Finish",
    finishNone: "No Finish",
    qualityExcellent: "Excellent",
    qualityVeryGood: "Very Good",
    qualityPoor: "Poor",
    qualityGood: "Good",
    // services
    street: "Street",
    electricity: "Electricity",
    water: "Water",
    phone: "Phone",
    drainage: "Drainage",
    pavedStreets: "Paved Streets",
    lighting: "Lighting",
    internet: "Internet",
    // map
    coords: "Coordinates",
    lat: "Latitude",
    lng: "Longitude",
    zoomMap: "Zoom (Map)",
    zoomAerial: "Zoom (Aerial)",
    zoomComparisons: "Zoom (Comparisons Map)",
    // replacement
    meterPriceLand: "Land Meter Price",
    landSpace: "Land Area",
    landValueCalc: "Land Value (Calculated)",
    managementPct: "Management Fees %",
    professionalPct: "Professional Fees %",
    utilityNetworkPct: "Utility Network %",
    emergencyPct: "Contingency Costs %",
    financePct: "Finance %",
    yearDev: "Development Period (years)",
    earningsRate: "Developer Profit Margin %",
    buildAge: "Actual Asset Age",
    defaultAge: "Assumed Asset Age",
    depreciationPct: "Physical Depreciation %",
    economicPct: "Economic Obsolescence %",
    careerPct: "Functional Obsolescence %",
    maintenancePrice: "Maintenance Costs",
    finishesPrice: "Remaining Finish Costs",
    completionPct: "Construction Completion %",
    // valuation methods
    vmMarket: "Comparison",
    vmCost: "Replacement Cost",
    vmIncome: "Investment",
    vmResidual: "Residual Value",
    vmDcf: "DCF",
    vmRental: "Rental Value",
    comingSoon: "This section is under development.",
    marketMeterPrice: "Meter Price (Table)",
    marketWeightPct: "Weighted Ratio",
    propertyAreaMethod: "Property Area",
    total: "Total",
    usageReason: "Reason for Use",
    costNetBuildings: "Net Building Cost",
    costNetLandPrice: "Net Land Price",
    costLandBuildTotal: "Net Land + Buildings Value",
    incomeTotal: "Total Income",
    // appraiser
    evalDate: "Inspection Date",
    completedDate: "Valuation Date",
    reportDate: "Report Date",
    finalAssetValue: "Final Asset Value",
    appraiserDesc: "Appraiser Description & Opinion",
    appraiserNotes: "Notes or Deficiencies",
    // report
    standards: "Applied Valuation Standards",
    scope: "Scope of Investigation",
    assumptions: "Assumptions",
    risks: "Risks or Uncertainty",
    // authors
    authorId: "Author %n — ID/Name",
    authorTitle: "Author %n — Title",
    // comparison table
    compDate: "Date",
    compType: "Type",
    compKind: "Comparison Kind",
    compArea: "Area",
    compMeterPrice: "Meter Price",
    compTotalPrice: "Total",
    compBaad: "Distance",
    compRoads: "Road Count",
    compStreet: "Street Width",
    compSource: "Source",
    compNotes: "Notes",
    compCoords: "Coordinates",
    compDelete: "Delete",
    addComparison: "＋ New Comparison",
    // settlement table
    settlementItem: "Item",
    settlementSubject: "Subject Property",
    settlementComp: "Comparison",
    settlementDesc: "Description",
    settlementAdj: "Adjustment",
    meterPrice: "Meter Price",
    totalAdjustments: "Total Adjustments",
    priceAfterAdj: "Price After Adjustment",
    addSettlement: "＋ New Settlement Item",
    // replacement table
    repTitle: "Title",
    repArea: "Area",
    repPrice: "Price",
    repTotal: "Total",
    repNotes: "Notes",
    repUseArea: "Calculate by Area",
    repDelete: "Delete",
    addRepLine: "＋ New Line",
    // misc
    close: "Close",
    assetCountVal: "1",
  },
} as const;

type TKeys = keyof (typeof T)["ar"];
type Lang = "ar" | "en";

// ─── constants ────────────────────────────────────────────────────────────────

const VALUATION_PURPOSES: Record<Lang, Record<string, string>> = {
  ar: {
    "1": "التمويل",
    "2": "الشراء",
    "3": "البيع",
    "4": "الرهن",
    "5": "محاسبة",
    "6": "إفلاس",
    "7": "استحواذ",
    "8": "التقرير المالي",
    "9": "الضرائب",
    "10": "الأغراض التأمينية",
    "11": "تقاضي",
    "12": "أغراض داخلية",
    "13": "نزع الملكية",
    "14": "نقل",
    "15": "ورث",
    "16": "اخرى",
    "17": "توزيع تركه",
    "18": "البيع القسري",
    "19": "معرفة القيمة السوقية",
    "20": "معرفة القيمة الإيجارية",
    "21": "التصفية",
    "50": "أغراض إستثمارية",
    "54": "التعويض",
  },
  en: {
    "1": "Financing",
    "2": "Purchase",
    "3": "Sale",
    "4": "Mortgage",
    "5": "Accounting",
    "6": "Bankruptcy",
    "7": "Acquisition",
    "8": "Financial Reporting",
    "9": "Taxation",
    "10": "Insurance Purposes",
    "11": "Litigation",
    "12": "Internal Purposes",
    "13": "Expropriation",
    "14": "Transfer",
    "15": "Inheritance",
    "16": "Other",
    "17": "Estate Distribution",
    "18": "Forced Sale",
    "19": "Market Value Assessment",
    "20": "Rental Value Assessment",
    "21": "Liquidation",
    "50": "Investment Purposes",
    "54": "Compensation",
  },
};

const VALUATION_BASES: Record<Lang, Record<string, string>> = {
  ar: {
    "1": "القيمة السوقية",
    "2": "القيمة الاستثمارية",
    "3": "القيمة المنصفة",
    "4": "قيمة التصفية",
    "5": "القيمة التكاملية",
    "6": "الايجار السوقي",
    "7": "القيمة السوقية / قيمة الايجار السوقي",
    "8": "القيمة العادلة",
    "10": "الإدراج في القوائم المالية",
  },
  en: {
    "1": "Market Value",
    "2": "Investment Value",
    "3": "Fair Value",
    "4": "Liquidation Value",
    "5": "Synergistic Value",
    "6": "Market Rent",
    "7": "Market Value / Market Rent",
    "8": "Fair Value",
    "10": "Financial Statement Recognition",
  },
};

const OWNERSHIP_TYPES: Record<Lang, Record<string, string>> = {
  ar: {
    "1": "الملكية المطلقة",
    "2": "الملكية المشروطة",
    "3": "الملكية المقيدة",
    "4": "ملكية مدى الحياة",
    "5": "منفعة",
    "6": "مشاع",
    "7": "ملكية مرهونة",
  },
  en: {
    "1": "Freehold",
    "2": "Conditional Ownership",
    "3": "Restricted Ownership",
    "4": "Life Interest",
    "5": "Usufruct",
    "6": "Common Ownership",
    "7": "Mortgaged",
  },
};

const VALUATION_HYPOTHESES: Record<Lang, Record<string, string>> = {
  ar: {
    "1": "الاستخدام الحالي",
    "2": "الاستخدام الأعلى والأفضل",
    "3": "التصفية المنظمة",
    "4": "البيع القسري",
  },
  en: {
    "1": "Current Use",
    "2": "Highest and Best Use",
    "3": "Orderly Liquidation",
    "4": "Forced Sale",
  },
};

const WORKFLOW_STATUSES: Record<Lang, { value: string; label: string }[]> = {
  ar: [
    { value: "new", label: "جديدة" },
    { value: "inspection", label: "معاينة" },
    { value: "review", label: "مراجعة" },
    { value: "audit", label: "تدقيق" },
    { value: "approved", label: "معتمدة" },
    { value: "sent", label: "مرسلة" },
    { value: "cancelled", label: "ملغية" },
    { value: "pending", label: "معلقة" },
  ],
  en: [
    { value: "new", label: "New" },
    { value: "inspection", label: "Inspection" },
    { value: "review", label: "Review" },
    { value: "audit", label: "Audit" },
    { value: "approved", label: "Approved" },
    { value: "sent", label: "Sent" },
    { value: "cancelled", label: "Cancelled" },
    { value: "pending", label: "Pending" },
  ],
};

const USE_LABELS: Record<Lang, Record<string, string>> = {
  ar: { "1": "أراضي", "2": "مباني" },
  en: { "1": "Land", "2": "Buildings" },
};

const PROPERTY_TYPES_OPTIONS: Record<Lang, { value: string; label: string }[]> =
  {
    ar: [
      { value: "1", label: "أرض" },
      { value: "2", label: "شقة" },
      { value: "3", label: "فيلا سكنية" },
      { value: "4", label: "عمارة" },
      { value: "5", label: "إستراحة" },
      { value: "6", label: "مزرعة" },
      { value: "7", label: "مستودع" },
      { value: "9", label: "محل تجاري" },
      { value: "10", label: "دور" },
      { value: "21", label: "أرض سكنية" },
      { value: "22", label: "أرض تجارية" },
      { value: "24", label: "فندق" },
      { value: "28", label: "مبنى تجاري" },
      { value: "67", label: "عمارة سكنية" },
    ],
    en: [
      { value: "1", label: "Land" },
      { value: "2", label: "Apartment" },
      { value: "3", label: "Residential Villa" },
      { value: "4", label: "Building" },
      { value: "5", label: "Rest House" },
      { value: "6", label: "Farm" },
      { value: "7", label: "Warehouse" },
      { value: "9", label: "Shop" },
      { value: "10", label: "Floor" },
      { value: "21", label: "Residential Land" },
      { value: "22", label: "Commercial Land" },
      { value: "24", label: "Hotel" },
      { value: "28", label: "Commercial Building" },
      { value: "67", label: "Residential Building" },
    ],
  };

const COMPARISON_KINDS: Record<Lang, string[]> = {
  ar: ["حد", "تنفيذ", "سوم", "عرض", "ايجار", "مزاد"],
  en: ["Boundary", "Executed", "Asking", "Offer", "Rental", "Auction"],
};

const REGIONS: Record<Lang, { value: string; label: string }[]> = {
  ar: [
    { value: "1", label: "منطقة الرياض" },
    { value: "2", label: "منطقة مكة المكرمة" },
    { value: "3", label: "منطقة المدينة المنورة" },
    { value: "4", label: "منطقة القصيم" },
    { value: "5", label: "المنطقة الشرقية" },
    { value: "6", label: "منطقة عسير" },
    { value: "7", label: "منطقة تبوك" },
    { value: "8", label: "منطقة حائل" },
    { value: "9", label: "منطقة الحدود الشمالية" },
    { value: "10", label: "منطقة جازان" },
    { value: "11", label: "منطقة نجران" },
    { value: "12", label: "منطقة الباحة" },
    { value: "13", label: "منطقة الجوف" },
  ],
  en: [
    { value: "1", label: "Riyadh Region" },
    { value: "2", label: "Makkah Region" },
    { value: "3", label: "Madinah Region" },
    { value: "4", label: "Qassim Region" },
    { value: "5", label: "Eastern Region" },
    { value: "6", label: "Asir Region" },
    { value: "7", label: "Tabuk Region" },
    { value: "8", label: "Hail Region" },
    { value: "9", label: "Northern Borders Region" },
    { value: "10", label: "Jazan Region" },
    { value: "11", label: "Najran Region" },
    { value: "12", label: "Al-Baha Region" },
    { value: "13", label: "Al-Jouf Region" },
  ],
};

const IMPORTANT_LINKS = [
  {
    href: "https://srem.moj.gov.sa/deed-inquiry",
    labelAr: "استعلام عن الصك",
    labelEn: "Deed Inquiry",
  },
  {
    href: "https://apps.balady.gov.sa/Eservices/Inquiries/inquiry",
    labelAr: "استعلام عن الرخصة (بلدي)",
    labelEn: "License Inquiry (Balady)",
  },
  {
    href: "https://umaps.balady.gov.sa/",
    labelAr: "يو ماب (مخططات)",
    labelEn: "U-Maps (Plans)",
  },
  {
    href: "https://mapservice.alriyadh.gov.sa/geoportal/geomap",
    labelAr: "البوابة المكانية الرياض",
    labelEn: "Riyadh Spatial Portal",
  },
  {
    href: "https://gis.qassim.gov.sa/QMENEW/",
    labelAr: "المستكشف الجغرافي - القصيم",
    labelEn: "Geo Explorer - Qassim",
  },
  {
    href: "https://smartmap.jeddah.gov.sa/",
    labelAr: "المستكشف الجغرافي-جدة",
    labelEn: "Geo Explorer - Jeddah",
  },
  {
    href: "https://maps.holymakkah.gov.sa/",
    labelAr: "المستكشف الجغرافي-مكة",
    labelEn: "Geo Explorer - Makkah",
  },
  {
    href: "https://geomed.amana-md.gov.sa/madinah-explorer/#/ar",
    labelAr: "المستكشف الجغرافي-المدينة",
    labelEn: "Geo Explorer - Madinah",
  },
  {
    href: "https://srem.moj.gov.sa/transactions-info",
    labelAr: "البورصة العقارية",
    labelEn: "Real Estate Exchange",
  },
  {
    href: "https://sa.aqar.fm/map/",
    labelAr: "عقار (عروض مقارنة)",
    labelEn: "Aqar (Comparison Listings)",
  },
  {
    href: "https://aqarsas.sa/ulanding/",
    labelAr: "عقار ساس",
    labelEn: "Aqar SAS",
  },
  {
    href: "https://qaren.ai/comparisons",
    labelAr: "منصة قارن",
    labelEn: "Qaren Platform",
  },
  { href: "https://paseetah.com/", labelAr: "موقع بسيطة", labelEn: "Paseetah" },
  {
    href: "https://earth.google.com/web/",
    labelAr: "رابط قوقل ايرث",
    labelEn: "Google Earth",
  },
  {
    href: "https://eservices.rer.sa/#/title-verification",
    labelAr: "استعلام عن صك (السجل العقاري)",
    labelEn: "Deed Inquiry (Real Estate Registry)",
  },
  {
    href: "https://webgis.eamana.gov.sa/eexplorer/",
    labelAr: "المستكشف الجغرافي-الشرقية",
    labelEn: "Geo Explorer - Eastern Region",
  },
];

// ─── helper: build label→value map ───────────────────────────────────────────

function buildByLabel(
  templateFieldValues:
    | Record<string, { label: string; value: string }>
    | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!templateFieldValues) return map;
  Object.values(templateFieldValues).forEach((entry) => {
    if (entry?.label) map[entry.label] = entry.value ?? "";
  });
  return map;
}

function resolveRegionId(nameOrId: string, lang: Lang): string {
  if (!nameOrId) return "";
  const match = REGIONS[lang].find((r) => r.label === nameOrId);
  return match ? match.value : nameOrId;
}

// ─── read-only display ────────────────────────────────────────────────────────

function ReadOnlyGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "16px 24px",
      }}
    >
      {children}
    </div>
  );
}

function ReadOnlyItem({
  label,
  value,
  full = false,
}: {
  label: string;
  value?: string;
  full?: boolean;
}) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <div
        style={{
          fontSize: 11,
          color: "#888",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: value ? "#1a1a1a" : "#bbb",
          fontWeight: value ? 500 : 400,
          lineHeight: 1.4,
          paddingBottom: 8,
          borderBottom: "1px solid #eee",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

// ─── shared sub-components ────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  defaultOpen = false,
  accentColor,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const headBg = accentColor ?? "#fafbfc";
  const headColor = accentColor ? "#fff" : "#222";
  return (
    <div style={styles.sectionCard}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ ...styles.sectionHead, background: headBg, color: headColor }}
      >
        <span>{title}</span>
        <span
          style={{
            transition: "transform 0.2s",
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>
      {open && <div style={styles.sectionBody}>{children}</div>}
    </div>
  );
}

function GridFields({
  children,
  tight = false,
}: {
  children: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <div style={{ ...styles.gridFields, gap: tight ? "8px" : "14px" }}>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function Input({
  type = "text",
  readOnly = false,
  value,
  onChange,
  placeholder,
  dir,
}: {
  type?: string;
  readOnly?: boolean;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  dir?: string;
}) {
  return (
    <input
      type={type}
      readOnly={readOnly}
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      dir={dir}
      style={{ ...styles.input, background: readOnly ? "#f8f9fa" : "#fff" }}
    />
  );
}

function Textarea({
  readOnly = false,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  readOnly?: boolean;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      readOnly={readOnly}
      value={value ?? ""}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      style={{
        ...styles.input,
        resize: "vertical",
        minHeight: `${rows * 24}px`,
      }}
    />
  );
}

function Select({
  value,
  onChange,
  children,
  disabled = false,
}: {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={onChange}
      disabled={disabled}
      style={styles.input}
    >
      {children}
    </select>
  );
}

function StatusMsg({
  type,
  children,
}: {
  type: "ok" | "error" | "info";
  children: React.ReactNode;
}) {
  const bg =
    type === "ok" ? "#d4edda" : type === "error" ? "#f8d7da" : "#fff3cd";
  const color =
    type === "ok" ? "#155724" : type === "error" ? "#721c24" : "#856404";
  return (
    <div
      style={{
        padding: "6px 12px",
        borderRadius: 4,
        background: bg,
        color,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

// ─── comparison table ─────────────────────────────────────────────────────────

function emptyComparisonRow() {
  return {
    evalDate: "",
    propertyTypeId: "",
    comparisonKind: "حد",
    landSpace: "",
    price: "",
    total: "",
    description: "",
    roads: "",
    street: "",
    source: "",
    notes: "",
    coords: "",
  };
}

function ComparisonTable({
  rows,
  onChange,
  lang,
}: {
  rows: any[];
  onChange: (rows: any[]) => void;
  lang: Lang;
}) {
  const t = T[lang];
  const addRow = () => onChange([...rows, emptyComparisonRow()]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, val: string) => {
    onChange(
      rows.map((r, idx) => {
        if (idx !== i) return r;
        const updated = { ...r, [field]: val };
        if (field === "landSpace" || field === "price") {
          const area =
            parseFloat(field === "landSpace" ? val : r.landSpace) || 0;
          const price = parseFloat(field === "price" ? val : r.price) || 0;
          updated.total =
            area && price ? (area * price).toLocaleString("ar-SA") : "";
        }
        return updated;
      }),
    );
  };

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {[
                t.compDate,
                t.compType,
                t.compKind,
                t.compArea,
                t.compMeterPrice,
                t.compTotalPrice,
                t.compBaad,
                t.compRoads,
                t.compStreet,
                t.compSource,
                t.compNotes,
                t.compCoords,
                t.compDelete,
              ].map((h) => (
                <th key={h} style={styles.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={styles.td}>
                  <input
                    type="date"
                    value={row.evalDate}
                    onChange={(e) => updateRow(i, "evalDate", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <select
                    value={row.propertyTypeId}
                    onChange={(e) =>
                      updateRow(i, "propertyTypeId", e.target.value)
                    }
                    style={styles.cellInput}
                  >
                    <option value="" disabled>
                      {lang === "ar" ? "نوع" : "Type"}
                    </option>
                    {PROPERTY_TYPES_OPTIONS[lang].map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={styles.td}>
                  <select
                    value={row.comparisonKind}
                    onChange={(e) =>
                      updateRow(i, "comparisonKind", e.target.value)
                    }
                    style={styles.cellInput}
                  >
                    {COMPARISON_KINDS[lang].map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={styles.td}>
                  <input
                    dir="ltr"
                    value={row.landSpace}
                    onChange={(e) => updateRow(i, "landSpace", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    dir="ltr"
                    value={row.price}
                    onChange={(e) => updateRow(i, "price", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    dir="ltr"
                    value={row.total}
                    readOnly
                    style={{ ...styles.cellInput, background: "#f0f0f0" }}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    value={row.description}
                    onChange={(e) =>
                      updateRow(i, "description", e.target.value)
                    }
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    value={row.roads}
                    onChange={(e) => updateRow(i, "roads", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    value={row.street}
                    onChange={(e) => updateRow(i, "street", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    value={row.notes}
                    onChange={(e) => updateRow(i, "notes", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    value={row.services}
                    onChange={(e) => updateRow(i, "services", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <input
                    placeholder="lat,lng"
                    value={row.coords}
                    onChange={(e) => updateRow(i, "coords", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                <td style={styles.td}>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    style={styles.iconBtn}
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addRow} style={styles.linkBtn}>
        {t.addComparison}
      </button>
    </div>
  );
}

// ─── settlement table ─────────────────────────────────────────────────────────

function emptySettlementRow() {
  return {
    inReport: true,
    title: "",
    valueM: "",
    cols: ["", "", ""],
    colAdj: ["", "", ""],
  };
}

function SettlementTable({
  rows,
  onChange,
  bases,
  numCols,
  lang,
}: {
  rows: any[];
  onChange: (rows: any[]) => void;
  bases: string[];
  numCols: number;
  lang: Lang;
}) {
  const t = T[lang];
  const n = Math.min(numCols, 8);
  const addRow = () => onChange([...rows, emptySettlementRow()]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, val: any) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  const updateCol = (i: number, c: number, field: string, val: string) =>
    onChange(
      rows.map((r, idx) => {
        if (idx !== i) return r;
        const arr = [...(r[field] || [])];
        arr[c] = val;
        return { ...r, [field]: arr };
      }),
    );
  const colTotals = Array.from({ length: n }, (_, c) =>
    rows.reduce((sum, r) => sum + (parseFloat((r.colAdj || [])[c]) || 0), 0),
  );
  const colAfter = Array.from({ length: n }, (_, c) =>
    ((parseFloat(bases[c]) || 0) + colTotals[c]).toFixed(2),
  );

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.settlementItem}</th>
              <th style={styles.th}>{t.settlementSubject}</th>
              {Array.from({ length: n }, (_, c) => (
                <th key={c} colSpan={2} style={styles.th}>
                  {t.settlementComp} {c + 1}
                </th>
              ))}
            </tr>
            <tr>
              <th style={styles.th}>—</th>
              <th style={styles.th}>—</th>
              {Array.from({ length: n }, (_, c) => (
                <React.Fragment key={c}>
                  <th style={styles.th}>{t.settlementDesc}</th>
                  <th style={styles.th}>{t.settlementAdj}</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#e8f4fd" }}>
              <td colSpan={2} style={styles.td}>
                <strong>{t.meterPrice}</strong>
              </td>
              {Array.from({ length: n }, (_, c) => (
                <td key={c} colSpan={2} style={styles.td}>
                  <input
                    dir="ltr"
                    value={bases[c] || ""}
                    readOnly
                    style={styles.cellInput}
                  />
                </td>
              ))}
            </tr>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={styles.td}>
                  <div
                    style={{ display: "flex", gap: 4, alignItems: "center" }}
                  >
                    <input
                      type="checkbox"
                      checked={!!row.inReport}
                      onChange={(e) =>
                        updateRow(i, "inReport", e.target.checked)
                      }
                    />
                    <input
                      value={row.title}
                      onChange={(e) => updateRow(i, "title", e.target.value)}
                      placeholder={
                        lang === "ar" ? "بند التسوية" : "Settlement Item"
                      }
                      style={{ ...styles.cellInput, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      style={styles.iconBtn}
                    >
                      🗑
                    </button>
                  </div>
                </td>
                <td style={styles.td}>
                  <input
                    value={row.valueM}
                    onChange={(e) => updateRow(i, "valueM", e.target.value)}
                    style={styles.cellInput}
                  />
                </td>
                {Array.from({ length: n }, (_, c) => (
                  <React.Fragment key={c}>
                    <td style={styles.td}>
                      <input
                        value={(row.cols || [])[c] || ""}
                        onChange={(e) =>
                          updateCol(i, c, "cols", e.target.value)
                        }
                        style={styles.cellInput}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        dir="ltr"
                        value={(row.colAdj || [])[c] || ""}
                        onChange={(e) =>
                          updateCol(i, c, "colAdj", e.target.value)
                        }
                        style={styles.cellInput}
                      />
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))}
            <tr style={{ background: "#f5f5f5" }}>
              <td colSpan={2} style={styles.td}>
                <strong>{t.totalAdjustments}</strong>
              </td>
              {Array.from({ length: n }, (_, c) => (
                <td key={c} colSpan={2} style={styles.td}>
                  <input
                    dir="ltr"
                    readOnly
                    value={colTotals[c].toFixed(2)}
                    style={{ ...styles.cellInput, background: "#eee" }}
                  />
                </td>
              ))}
            </tr>
            <tr style={{ background: "#f5f5f5" }}>
              <td colSpan={2} style={styles.td}>
                <strong>{t.priceAfterAdj}</strong>
              </td>
              {Array.from({ length: n }, (_, c) => (
                <td key={c} colSpan={2} style={styles.td}>
                  <input
                    dir="ltr"
                    readOnly
                    value={colAfter[c]}
                    style={{ ...styles.cellInput, background: "#eee" }}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addRow} style={styles.linkBtn}>
        {t.addSettlement}
      </button>
    </div>
  );
}

// ─── replacement table ────────────────────────────────────────────────────────

function emptyReplacementLine() {
  return {
    title: "",
    space: "",
    unitPrice: "",
    notes: "",
    useSpace: true,
    total: "",
  };
}

function ReplacementTable({
  lines,
  onChange,
  lang,
}: {
  lines: any[];
  onChange: (lines: any[]) => void;
  lang: Lang;
}) {
  const t = T[lang];
  const addLine = () => onChange([...lines, emptyReplacementLine()]);
  const removeLine = (i: number) =>
    onChange(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, val: any) =>
    onChange(
      lines.map((l, idx) => {
        if (idx !== i) return l;
        const updated = { ...l, [field]: val };
        if (field === "space" || field === "unitPrice") {
          const s = parseFloat(field === "space" ? val : l.space) || 0;
          const p = parseFloat(field === "unitPrice" ? val : l.unitPrice) || 0;
          updated.total =
            updated.useSpace && s && p ? (s * p).toFixed(2) : p.toFixed(2);
        }
        return updated;
      }),
    );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {[
              t.repTitle,
              t.repArea,
              t.repPrice,
              t.repTotal,
              t.repNotes,
              t.repUseArea,
              t.repDelete,
            ].map((h) => (
              <th key={h} style={styles.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td style={styles.td}>
                <input
                  value={line.title}
                  onChange={(e) => updateLine(i, "title", e.target.value)}
                  style={styles.cellInput}
                />
              </td>
              <td style={styles.td}>
                <input
                  dir="ltr"
                  value={line.space}
                  onChange={(e) => updateLine(i, "space", e.target.value)}
                  style={styles.cellInput}
                />
              </td>
              <td style={styles.td}>
                <input
                  dir="ltr"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                  style={styles.cellInput}
                />
              </td>
              <td style={styles.td}>
                <input
                  dir="ltr"
                  readOnly
                  value={line.total || ""}
                  style={{ ...styles.cellInput, background: "#eee" }}
                />
              </td>
              <td style={styles.td}>
                <input
                  value={line.notes}
                  onChange={(e) => updateLine(i, "notes", e.target.value)}
                  style={styles.cellInput}
                />
              </td>
              <td style={styles.td}>
                <input
                  type="checkbox"
                  checked={!!line.useSpace}
                  onChange={(e) => updateLine(i, "useSpace", e.target.checked)}
                />
              </td>
              <td style={styles.td}>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  style={styles.iconBtn}
                >
                  🗑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addLine} style={styles.linkBtn}>
        {t.addRepLine}
      </button>
    </div>
  );
}

// ─── empty evalData default ───────────────────────────────────────────────────

function emptyEval() {
  return {
    status: "new",
    location: {
      regionId: "",
      cityName: "",
      neighborhoodName: "",
      assetCategoryId: "",
      propertyTypeId: "",
    },
    basic: {
      propertyCode: "",
      deedNumber: "",
      deedDate: "",
      ownerName: "",
      clientName: "",
      authorizedName: "",
    },
    boundaries: {
      northBoundary: "",
      northLength: "",
      southBoundary: "",
      southLength: "",
      eastBoundary: "",
      eastLength: "",
      westBoundary: "",
      westLength: "",
    },
    finishing: {
      buildingState: "",
      floorsCount: "",
      propertyAge: "",
      finishLevel: "",
      buildQuality: "",
    },
    services: { street: "" },
    map: {
      coords: "",
      lat: "",
      lng: "",
      zoomMap: "",
      zoomAerial: "",
      zoomComparisons: "",
    },
    appraiser: {
      evalDate: "",
      completedDate: "",
      reportDate: "",
      finalAssetValue: "",
      appraiserDesc: "",
      appraiserNotes: "",
    },
    methodsMarket: {
      marketMeterPrice: "",
      marketWeightPct: "",
      marketMethodTotal: "",
      marketReason: "",
      propertyAreaMethod: "",
    },
    methodsCost: {
      costNetBuildings: "",
      costNetLandPrice: "",
      costLandBuildTotal: "",
      costReason: "",
    },
    settlementWeights: ["", "", ""] as string[],
    section1Rows: [] as { title: string; colAdj: string[] }[],
    methodsIncome: { incomeTotal: "", incomeReason: "" },
    reportItems: { standards: "", scope: "", assumptions: "", risks: "" },
    authors: {
      author1Id: "",
      author1Title: "",
      author2Id: "",
      author2Title: "",
      author3Id: "",
      author3Title: "",
      author4Id: "",
      author4Title: "",
    },
    comparisonRows: [emptyComparisonRow(), emptyComparisonRow()],
    settlementRows: [] as SettlementRow[],
    settlementBases: ["", "", ""],
    replacementLines: [
      emptyReplacementLine(),
      emptyReplacementLine(),
      emptyReplacementLine(),
    ],
    meterPriceLand: "",
    landSpace: "",
    replacementFields: {
      managementPct: "",
      professionalPct: "",
      utilityNetworkPct: "",
      emergencyPct: "",
      financePct: "",
      yearDev: "",
      earningsRate: "",
      buildAge: "",
      defaultAge: "",
      depreciationPct: "",
      economicPct: "",
      careerPct: "",
      maintenancePrice: "",
      finishesPrice: "",
      completionPct: "",
    },
  };
}

// ─── main page ────────────────────────────────────────────────────────────────

export function TransactionEvaluationPage({
  transactionId,
  onBack,
}: {
  transactionId: string;
  onBack: () => void;
}) {
  // ── language ──────────────────────────────────────────────────────────────
  const langContext = useContext(LanguageContext);
  const lang: Lang = (langContext?.language === "en" ? "en" : "ar") as Lang;
  const isRtl = lang === "ar";
  const t = T[lang];

  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) {
      setLoading(false);
      setFetchError(t.noId);
      return;
    }
    setLoading(true);
    setFetchError(null);
    fetch(toApiUrl(`/api/transactions/${transactionId}`), {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then((data) => setTx(data))
      .catch((e) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, [transactionId]);

  const [statusMsg, setStatusMsg] = useState<{
    type: "ok" | "error" | "info";
    text: string;
  }>({ type: "ok", text: "" });
  const [saving, setSaving] = useState(false);
  const [ev, setEv] = useState(emptyEval());
  const [settlementNumCols] = useState(3);
  const [settlementNotes, setSettlementNotes] = useState(
    lang === "ar"
      ? "-تم اجراء عملية التسويات و التعديلات حسب ما هو متعارف في السوق واستنادا على ما هو معروض بالسوق.\n-بعد معاينة المنطقة المحيطة بالعقار تم الوصول إلى صفقات منفذة وعروض قائمة."
      : "-Adjustments were made in accordance with market norms and based on available market listings.\n-After inspecting the surrounding area, executed transactions and active listings were identified.",
  );
  const [activeVmTab, setActiveVmTab] = useState("vm-m");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const setField = (section: string, field: string, val: string) =>
    setEv((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof typeof prev] as any),
        [field]: val,
      },
    }));

  useEffect(() => {
    if (!tx) return;
    const e: Record<string, any> = tx.evalData ?? {};
    const bl = buildByLabel(tx.templateFieldValues);
    const pick = (...candidates: (string | undefined)[]): string =>
      candidates.find((v) => v !== undefined && v !== "") ?? "";

    setEv({
      status: pick(e.status, "new"),
      section1Rows:
        Array.isArray(e.section1Rows) && e.section1Rows.length > 0
          ? e.section1Rows
          : DEFAULT_SECTION1_TITLES[lang].map((title) => ({
              title,
              colAdj: [],
            })),
      settlementWeights: Array.isArray(e.settlementWeights)
        ? e.settlementWeights
        : ["", "", ""],
      location: {
        regionId: pick(e.regionId, resolveRegionId(bl["المنطقة"] ?? "", lang)),
        cityName: pick(e.cityName, bl["المدينة"]),
        neighborhoodName: pick(e.neighborhoodName, bl["الحي"]),
        assetCategoryId: pick(e.assetCategoryId),
        propertyTypeId: pick(e.propertyTypeId),
      },
      basic: {
        propertyCode: pick(e.propertyCode, bl["رمز العقار"]),
        deedNumber: pick(e.deedNumber, bl["رقم الصك"]),
        deedDate: pick(e.deedDate, bl["تاريخ الصك"]),
        ownerName: pick(e.ownerName, bl["اسم المالك"]),
        clientName: pick(e.clientName, bl["اسم العميل"]),
        authorizedName: pick(e.authorizedName, bl["اسم المفوض بطلب التقييم"]),
      },
      boundaries: {
        northBoundary: pick(e.northBoundary, bl["الحد الشمالي"]),
        northLength: pick(e.northLength, bl["طول الحد الشمالي"]),
        southBoundary: pick(e.southBoundary, bl["الحد الجنوبي"]),
        southLength: pick(e.southLength, bl["طول الحد الجنوبي"]),
        eastBoundary: pick(e.eastBoundary, bl["الحد الشرقي"]),
        eastLength: pick(e.eastLength, bl["طول الحد الشرقي"]),
        westBoundary: pick(e.westBoundary, bl["الحد الغربي"]),
        westLength: pick(e.westLength, bl["طول الحد الغربي"]),
      },
      finishing: {
        buildingState: pick(e.buildingState),
        floorsCount: pick(e.floorsCount),
        propertyAge: pick(e.propertyAge),
        finishLevel: pick(e.finishLevel),
        buildQuality: pick(e.buildQuality),
      },
      services: { street: pick(e.street) },
      map: {
        coords: pick(e.coords),
        lat: pick(e.lat),
        lng: pick(e.lng),
        zoomMap: pick(e.zoomMap),
        zoomAerial: pick(e.zoomAerial),
        zoomComparisons: pick(e.zoomComparisons),
      },
      appraiser: {
        evalDate: pick(e.evalDate),
        completedDate: pick(e.completedDate),
        reportDate: pick(e.reportDate),
        finalAssetValue: pick(e.finalAssetValue),
        appraiserDesc: pick(e.appraiserDesc),
        appraiserNotes: pick(e.appraiserNotes),
      },
      methodsMarket: {
        marketMeterPrice: pick(e.marketMeterPrice),
        marketWeightPct: pick(e.marketWeightPct),
        marketMethodTotal: pick(e.marketMethodTotal),
        marketReason: pick(e.marketReason),
        propertyAreaMethod: pick(e.propertyAreaMethod),
      },
      methodsCost: {
        costNetBuildings: pick(e.costNetBuildings),
        costNetLandPrice: pick(e.costNetLandPrice),
        costLandBuildTotal: pick(e.costLandBuildTotal),
        costReason: pick(e.costReason),
      },
      methodsIncome: {
        incomeTotal: pick(e.incomeTotal),
        incomeReason: pick(e.incomeReason),
      },
      reportItems: {
        standards: pick(e.standards),
        scope: pick(e.scope),
        assumptions: pick(e.assumptions),
        risks: pick(e.risks),
      },
      authors: {
        author1Id: pick(e.author1Id),
        author1Title: pick(e.author1Title),
        author2Id: pick(e.author2Id),
        author2Title: pick(e.author2Title),
        author3Id: pick(e.author3Id),
        author3Title: pick(e.author3Title),
        author4Id: pick(e.author4Id),
        author4Title: pick(e.author4Title),
      },
      comparisonRows: e.comparisonRows?.length
        ? e.comparisonRows
        : [emptyComparisonRow(), emptyComparisonRow()],
      settlementRows: e.settlementRows?.length ? e.settlementRows : [],
      settlementBases: e.settlementBases?.length
        ? e.settlementBases
        : ["", "", ""],
      replacementLines: e.replacementLines?.length
        ? e.replacementLines
        : [
            emptyReplacementLine(),
            emptyReplacementLine(),
            emptyReplacementLine(),
          ],
      meterPriceLand: pick(e.meterPriceLand),
      landSpace: pick(e.landSpace, bl["مساحة الأصل"]),
      replacementFields: {
        managementPct: pick(e.managementPct),
        professionalPct: pick(e.professionalPct),
        utilityNetworkPct: pick(e.utilityNetworkPct),
        emergencyPct: pick(e.emergencyPct),
        financePct: pick(e.financePct),
        yearDev: pick(e.yearDev),
        earningsRate: pick(e.earningsRate),
        buildAge: pick(e.buildAge),
        defaultAge: pick(e.defaultAge),
        depreciationPct: pick(e.depreciationPct),
        economicPct: pick(e.economicPct),
        careerPct: pick(e.careerPct),
        maintenancePrice: pick(e.maintenancePrice),
        finishesPrice: pick(e.finishesPrice),
        completionPct: pick(e.completionPct),
      },
    });
  }, [tx]);

  const landValue = (
    (parseFloat(ev.meterPriceLand) || 0) * (parseFloat(ev.landSpace) || 0)
  ).toFixed(2);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg({ type: "info", text: t.saving });
    try {
      const evalData = {
        status: ev.status,
        ...ev.location,
        ...ev.basic,
        ...ev.boundaries,
        ...ev.finishing,
        ...ev.services,
        ...ev.map,
        ...ev.appraiser,
        ...ev.methodsMarket,
        ...ev.methodsCost,
        ...ev.methodsIncome,
        ...ev.reportItems,
        ...ev.authors,
        comparisonRows: ev.comparisonRows,
        section1Rows: ev.section1Rows,
        settlementRows: ev.settlementRows,
        settlementBases: ev.settlementBases,
        settlementWeights: ev.settlementWeights,
        replacementLines: ev.replacementLines,
        meterPriceLand: ev.meterPriceLand,
        landSpace: ev.landSpace,
        ...ev.replacementFields,
      };
      const res = await fetch(toApiUrl(`/api/transactions/${transactionId}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evalData }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const updated = await res.json();
      setTx(updated);
      setStatusMsg({ type: "ok", text: t.savedOk });
    } catch {
      setStatusMsg({ type: "error", text: t.saveError });
    } finally {
      setSaving(false);
    }
  };

  const VM_TABS = [
    { id: "vm-m", label: t.vmMarket },
    { id: "vm-c", label: t.vmCost },
    { id: "vm-i", label: t.vmIncome },
    { id: "vm-r", label: t.vmResidual },
    { id: "vm-d", label: t.vmDcf },
    { id: "vm-e", label: t.vmRental },
  ];

  const bl = buildByLabel(tx?.templateFieldValues);

  if (loading)
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        style={{
          ...styles.shell,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 16, color: "#555" }}>{t.loading}</div>
      </div>
    );
  if (fetchError)
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        style={{
          ...styles.shell,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 16, color: "#c00" }}>
          {t.errorPrefix} {fetchError}
        </div>
      </div>
    );

  const replacementFieldLabels: Record<string, TKeys> = {
    managementPct: "managementPct",
    professionalPct: "professionalPct",
    utilityNetworkPct: "utilityNetworkPct",
    emergencyPct: "emergencyPct",
    financePct: "financePct",
    yearDev: "yearDev",
    earningsRate: "earningsRate",
    buildAge: "buildAge",
    defaultAge: "defaultAge",
    depreciationPct: "depreciationPct",
    economicPct: "economicPct",
    careerPct: "careerPct",
    maintenancePrice: "maintenancePrice",
    finishesPrice: "finishesPrice",
    completionPct: "completionPct",
  };

  const boundaryFields: { key: keyof typeof ev.boundaries; labelKey: TKeys }[] =
    [
      { key: "northBoundary", labelKey: "northBoundary" },
      { key: "northLength", labelKey: "northLength" },
      { key: "southBoundary", labelKey: "southBoundary" },
      { key: "southLength", labelKey: "southLength" },
      { key: "eastBoundary", labelKey: "eastBoundary" },
      { key: "eastLength", labelKey: "eastLength" },
      { key: "westBoundary", labelKey: "westBoundary" },
      { key: "westLength", labelKey: "westLength" },
    ];

  const mapFields: { key: keyof typeof ev.map; labelKey: TKeys }[] = [
    { key: "coords", labelKey: "coords" },
    { key: "lat", labelKey: "lat" },
    { key: "lng", labelKey: "lng" },
    { key: "zoomMap", labelKey: "zoomMap" },
    { key: "zoomAerial", labelKey: "zoomAerial" },
    { key: "zoomComparisons", labelKey: "zoomComparisons" },
  ];

  const serviceCheckboxes: { key: string; labelKey: TKeys }[] = [
    { key: "electricity", labelKey: "electricity" },
    { key: "water", labelKey: "water" },
    { key: "phone", labelKey: "phone" },
    { key: "drainage", labelKey: "drainage" },
    { key: "pavedStreets", labelKey: "pavedStreets" },
    { key: "lighting", labelKey: "lighting" },
    { key: "internet", labelKey: "internet" },
  ];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} style={styles.shell}>
      {/* ── Sticky save bar ──────────────────────────────────────────────── */}
      <div style={styles.stickyBar}>
        <button type="button" onClick={onBack} style={styles.btnSecondary}>
          {t.back}
        </button>
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}
        >
          <Select
            value={ev.status}
            onChange={(e) => setEv((p) => ({ ...p, status: e.target.value }))}
          >
            {WORKFLOW_STATUSES[lang].map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          {statusMsg.text && (
            <StatusMsg type={statusMsg.type}>{statusMsg.text}</StatusMsg>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            ...styles.btnPrimary,
            opacity: saving ? 0.7 : 1,
            minWidth: 130,
          }}
        >
          {saving ? t.saving : t.save}
        </button>
        <button type="button" style={styles.btnSecondary}>
          {t.download}
        </button>
      </div>

      <h1 style={{ ...styles.pageTitle, marginTop: 8 }}>{t.pageTitle}</h1>

      {/* معلومات الطلب */}
      <SectionCard title={t.secRequest} defaultOpen={true}>
        <ReadOnlyGrid>
          <ReadOnlyItem label={t.refNo} value={transactionId} />
          <ReadOnlyItem label={t.assignmentNo} value={tx?.assignmentNumber} />
          <ReadOnlyItem label={t.assignmentDate} value={tx?.assignmentDate} />
          <ReadOnlyItem
            label={t.valuationPurpose}
            value={
              VALUATION_PURPOSES[lang][tx?.valuationPurpose] ??
              tx?.valuationPurpose
            }
          />
          <ReadOnlyItem
            label={t.valuationBasis}
            value={
              VALUATION_BASES[lang][tx?.valuationBasis] ?? tx?.valuationBasis
            }
          />
          <ReadOnlyItem
            label={t.ownershipType}
            value={
              OWNERSHIP_TYPES[lang][tx?.ownershipType] ?? tx?.ownershipType
            }
          />
          <ReadOnlyItem
            label={t.valuationHypothesis}
            value={
              VALUATION_HYPOTHESES[lang][tx?.valuationHypothesis] ??
              tx?.valuationHypothesis
            }
          />
          <ReadOnlyItem label={t.assetCount} value={t.assetCountVal} />
          <ReadOnlyItem
            label={t.client}
            value={tx?.clientName ?? tx?.clientId}
          />
          <ReadOnlyItem label={t.template} value={tx?.templateId} />
          <ReadOnlyItem label={t.notes} value={tx?.intendedUse} full />
        </ReadOnlyGrid>
      </SectionCard>

      {/* important links */}
      <details style={styles.sectionCard}>
        <summary
          style={{
            ...styles.sectionHead,
            cursor: "pointer",
            listStyle: "none",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {t.secLinks}
        </summary>
        <div style={styles.sectionBody}>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              columns: 2,
              gap: 8,
            }}
          >
            {IMPORTANT_LINKS.map((l) => (
              <li key={l.href} style={{ marginBottom: 6 }}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0066cc", fontSize: 13 }}
                >
                  {lang === "ar" ? l.labelAr : l.labelEn}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* asset details header + action buttons */}
      <div style={{ marginBottom: 8, marginTop: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>
          {t.secAssetDetails}
        </h2>
        <div
          style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}
        >
          {[
            t.btnImages,
            t.btnAttachments,
            t.btnEdit,
            t.btnNearComps,
            t.btnCopyComps,
          ].map((btn) => (
            <button key={btn} type="button" style={styles.actionBtn}>
              {btn}
            </button>
          ))}
          <button
            type="button"
            style={styles.actionBtn}
            onClick={() =>
              window.open(
                toApiUrl(`/api/transactions/${transactionId}/pdf`),
                "_blank",
              )
            }
          >
            {t.btnView}
          </button>
          <button
            type="button"
            style={styles.actionBtn}
            onClick={() => {
              const a = document.createElement("a");
              a.href = toApiUrl(`/api/transactions/${transactionId}/pdf`);
              a.download = `valuation-${transactionId}.pdf`;
              a.click();
            }}
          >
            {t.btnPdf}
          </button>
          <button key={t.btnMessages} type="button" style={styles.actionBtn}>
            {t.btnMessages}
          </button>
        </div>
      </div>

      {/* معلومات الأصل */}
      <SectionCard title={t.secAssetInfo}>
        <ReadOnlyGrid>
          <ReadOnlyItem label={t.address} value={bl["العنوان"]} full />
          <ReadOnlyItem label={t.assetType} value={bl["نوع الأصل"]} />
          <ReadOnlyItem label={t.assetArea} value={bl["مساحة الأصل"]} />
          <ReadOnlyItem label={t.usage} value={bl["الاستخدام"]} />
          <ReadOnlyItem label={t.inspector} value={bl["المعاين"]} />
          <ReadOnlyItem label={t.contactNo} value={bl["رقم التواصل"]} />
          <ReadOnlyItem label={t.reviewer} value={bl["المراجع"]} />
        </ReadOnlyGrid>
      </SectionCard>

      {/* الموقع وتصنيف الأصل */}
      <SectionCard title={t.secLocation}>
        <GridFields>
          <Field label={t.region}>
            <Select
              value={ev.location.regionId}
              onChange={(e) => setField("location", "regionId", e.target.value)}
            >
              <option value="" disabled>
                {t.selectRegion}
              </option>
              {REGIONS[lang].map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.city}>
            <Input
              value={ev.location.cityName}
              onChange={(e) => setField("location", "cityName", e.target.value)}
              placeholder={t.enterCity}
            />
          </Field>
          <Field label={t.neighborhood}>
            <Input
              value={ev.location.neighborhoodName}
              onChange={(e) =>
                setField("location", "neighborhoodName", e.target.value)
              }
              placeholder={t.enterNeighborhood}
            />
          </Field>
          <Field label={t.assetCategory}>
            <Select
              value={ev.location.assetCategoryId}
              onChange={(e) =>
                setField("location", "assetCategoryId", e.target.value)
              }
            >
              <option value="" disabled>
                {t.selectCategory}
              </option>
              <option value="1">{t.land}</option>
              <option value="2">{t.buildings}</option>
            </Select>
          </Field>
          <Field label={t.assetType}>
            <Select
              value={ev.location.propertyTypeId}
              onChange={(e) =>
                setField("location", "propertyTypeId", e.target.value)
              }
            >
              <option value="" disabled>
                {t.selectPropertyType}
              </option>
              {PROPERTY_TYPES_OPTIONS[lang].map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </GridFields>
      </SectionCard>

      {/* البيانات الأساسية */}
      <SectionCard title={t.secBasic}>
        <GridFields>
          <Field label={t.propertyCode}>
            <Input
              value={ev.basic.propertyCode}
              onChange={(e) =>
                setField("basic", "propertyCode", e.target.value)
              }
            />
          </Field>
          <Field label={t.clientName}>
            <Input
              value={ev.basic.clientName}
              onChange={(e) => setField("basic", "clientName", e.target.value)}
            />
          </Field>
          <Field label={t.authorizedName}>
            <Input
              value={ev.basic.authorizedName}
              onChange={(e) =>
                setField("basic", "authorizedName", e.target.value)
              }
            />
          </Field>
          <Field label={t.ownerName}>
            <Input
              value={ev.basic.ownerName}
              onChange={(e) => setField("basic", "ownerName", e.target.value)}
            />
          </Field>
          <Field label={t.deedNumber}>
            <Input
              value={ev.basic.deedNumber}
              onChange={(e) => setField("basic", "deedNumber", e.target.value)}
            />
          </Field>
          <Field label={t.deedDate}>
            <Input
              value={ev.basic.deedDate}
              onChange={(e) => setField("basic", "deedDate", e.target.value)}
            />
          </Field>
        </GridFields>
      </SectionCard>

      {/* الحدود والأطوال */}
      <SectionCard title={t.secBoundaries}>
        <GridFields>
          {boundaryFields.map(({ key, labelKey }) => (
            <Field key={key} label={t[labelKey] as string}>
              <Input
                value={(ev.boundaries as any)[key]}
                onChange={(e) => setField("boundaries", key, e.target.value)}
              />
            </Field>
          ))}
        </GridFields>
      </SectionCard>

      {/* بيانات التشطيب */}
      <SectionCard title={t.secFinishing}>
        <GridFields>
          <Field label={t.buildingState}>
            <Select
              value={ev.finishing.buildingState}
              onChange={(e) =>
                setField("finishing", "buildingState", e.target.value)
              }
            >
              <option value="">{t.selectValue}</option>
              <option value="10001">{t.stateNew}</option>
              <option value="10002">{t.stateUsed}</option>
              <option value="10003">{t.stateUnderConstruction}</option>
              <option value="10004">{t.stateOther}</option>
            </Select>
          </Field>
          <Field label={t.floorsCount}>
            <Input
              value={ev.finishing.floorsCount}
              onChange={(e) =>
                setField("finishing", "floorsCount", e.target.value)
              }
            />
          </Field>
          <Field label={t.propertyAge}>
            <Input
              value={ev.finishing.propertyAge}
              onChange={(e) =>
                setField("finishing", "propertyAge", e.target.value)
              }
            />
          </Field>
          <Field label={t.finishLevel}>
            <Select
              value={ev.finishing.finishLevel}
              onChange={(e) =>
                setField("finishing", "finishLevel", e.target.value)
              }
            >
              <option value="">{t.selectValue}</option>
              <option value="23">{t.finishLuxury}</option>
              <option value="24">{t.finishMedium}</option>
              <option value="25">{t.finishBasic}</option>
              <option value="10006">{t.finishNone}</option>
            </Select>
          </Field>
          <Field label={t.buildQuality}>
            <Select
              value={ev.finishing.buildQuality}
              onChange={(e) =>
                setField("finishing", "buildQuality", e.target.value)
              }
            >
              <option value="">{t.selectValue}</option>
              <option value="44">{t.qualityExcellent}</option>
              <option value="45">{t.qualityVeryGood}</option>
              <option value="46">{t.qualityPoor}</option>
              <option value="10058">{t.qualityGood}</option>
            </Select>
          </Field>
        </GridFields>
      </SectionCard>

      {/* خدمات العقار */}
      <SectionCard title={t.secServices}>
        <GridFields>
          <Field label={t.street}>
            <Input
              value={ev.services.street}
              onChange={(e) => setField("services", "street", e.target.value)}
            />
          </Field>
          {serviceCheckboxes.map(({ key, labelKey }) => (
            <div
              key={key}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <input type="checkbox" id={`svc-${key}`} />
              <label htmlFor={`svc-${key}`} style={{ fontSize: 13 }}>
                {t[labelKey] as string}
              </label>
            </div>
          ))}
        </GridFields>
      </SectionCard>

      {/* الموقع على الخارطة */}
      <SectionCard title={t.secMap}>
        <GridFields>
          {mapFields.map(({ key, labelKey }) => (
            <Field key={key} label={t[labelKey] as string}>
              <Input
                value={(ev.map as any)[key]}
                onChange={(e) => setField("map", key, e.target.value)}
              />
            </Field>
          ))}
        </GridFields>
      </SectionCard>

      {/* المقارنة */}
      <SectionCard title={t.secComparison} accentColor="#1a6fc4">
        <SettlementComparison
          useLabel={
            USE_LABELS[lang][ev.location.assetCategoryId] ??
            (lang === "ar" ? "عام" : "General")
          }
          subjectArea={ev.landSpace}
          settlementWeights={ev.settlementWeights}
          onSettlementWeightsChange={(w) =>
            setEv((p) => ({ ...p, settlementWeights: w }))
          }
          section1Rows={ev.section1Rows}
          onSection1RowsChange={(rows) =>
            setEv((p) => ({ ...p, section1Rows: rows }))
          }
          comparisonRows={ev.comparisonRows}
          onComparisonRowsChange={(rows) =>
            setEv((p) => ({ ...p, comparisonRows: rows }))
          }
          settlementRows={ev.settlementRows}
          onSettlementRowsChange={(rows) =>
            setEv((p) => ({ ...p, settlementRows: rows }))
          }
          settlementBases={ev.settlementBases}
          onSettlementBasesChange={(bases) =>
            setEv((p) => ({ ...p, settlementBases: bases }))
          }
          settlementNotes={settlementNotes}
          onSettlementNotesChange={setSettlementNotes}
        />
      </SectionCard>

      {/* تكلفة الإحلال */}
      <SectionCard title={t.secReplacement} accentColor="#1a6fc4">
        <GridFields tight>
          <Field label={t.meterPriceLand}>
            <Input
              dir="ltr"
              value={ev.meterPriceLand}
              onChange={(e) =>
                setEv((p) => ({ ...p, meterPriceLand: e.target.value }))
              }
            />
          </Field>
          <Field label={t.landSpace}>
            <Input
              dir="ltr"
              value={ev.landSpace}
              onChange={(e) =>
                setEv((p) => ({ ...p, landSpace: e.target.value }))
              }
            />
          </Field>
          <Field label={t.landValueCalc}>
            <Input dir="ltr" value={landValue} readOnly />
          </Field>
        </GridFields>
        <div style={{ marginTop: 12 }}>
          <ReplacementTable
            lines={ev.replacementLines}
            onChange={(lines) =>
              setEv((p) => ({ ...p, replacementLines: lines }))
            }
            lang={lang}
          />
        </div>
        <GridFields tight>
          {(
            Object.keys(ev.replacementFields) as Array<
              keyof typeof ev.replacementFields
            >
          ).map((f) => (
            <Field key={f} label={t[replacementFieldLabels[f]] as string}>
              <Input
                dir="ltr"
                value={ev.replacementFields[f]}
                onChange={(e) =>
                  setEv((p) => ({
                    ...p,
                    replacementFields: {
                      ...p.replacementFields,
                      [f]: e.target.value,
                    },
                  }))
                }
              />
            </Field>
          ))}
        </GridFields>
      </SectionCard>

      {/* طرق التقييم */}
      <SectionCard title={t.secMethods}>
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          {VM_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveVmTab(tab.id)}
              style={{
                ...styles.vmTab,
                ...(activeVmTab === tab.id ? styles.vmTabActive : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeVmTab === "vm-m" && (
          <GridFields tight>
            <Field label={t.marketMeterPrice}>
              <Input
                value={ev.methodsMarket.marketMeterPrice}
                onChange={(e) =>
                  setField("methodsMarket", "marketMeterPrice", e.target.value)
                }
              />
            </Field>
            <Field label={t.marketWeightPct}>
              <Input
                value={ev.methodsMarket.marketWeightPct}
                onChange={(e) =>
                  setField("methodsMarket", "marketWeightPct", e.target.value)
                }
              />
            </Field>
            <Field label={t.propertyAreaMethod}>
              <Input
                value={ev.methodsMarket.propertyAreaMethod}
                onChange={(e) =>
                  setField(
                    "methodsMarket",
                    "propertyAreaMethod",
                    e.target.value,
                  )
                }
              />
            </Field>
            <Field label={t.total}>
              <Input
                value={ev.methodsMarket.marketMethodTotal}
                onChange={(e) =>
                  setField("methodsMarket", "marketMethodTotal", e.target.value)
                }
              />
            </Field>
            <Field label={t.usageReason} full>
              <Textarea
                value={ev.methodsMarket.marketReason}
                onChange={(e) =>
                  setField("methodsMarket", "marketReason", e.target.value)
                }
                rows={4}
              />
            </Field>
          </GridFields>
        )}
        {activeVmTab === "vm-c" && (
          <GridFields tight>
            <Field label={t.costNetBuildings}>
              <Input
                value={ev.methodsCost.costNetBuildings}
                onChange={(e) =>
                  setField("methodsCost", "costNetBuildings", e.target.value)
                }
              />
            </Field>
            <Field label={t.costNetLandPrice}>
              <Input
                value={ev.methodsCost.costNetLandPrice}
                onChange={(e) =>
                  setField("methodsCost", "costNetLandPrice", e.target.value)
                }
              />
            </Field>
            <Field label={t.costLandBuildTotal}>
              <Input
                value={ev.methodsCost.costLandBuildTotal}
                onChange={(e) =>
                  setField("methodsCost", "costLandBuildTotal", e.target.value)
                }
              />
            </Field>
            <Field label={t.usageReason} full>
              <Textarea
                value={ev.methodsCost.costReason}
                onChange={(e) =>
                  setField("methodsCost", "costReason", e.target.value)
                }
                rows={4}
              />
            </Field>
          </GridFields>
        )}
        {activeVmTab === "vm-i" && (
          <GridFields tight>
            <Field label={t.incomeTotal}>
              <Input
                value={ev.methodsIncome.incomeTotal}
                onChange={(e) =>
                  setField("methodsIncome", "incomeTotal", e.target.value)
                }
              />
            </Field>
            <Field label={t.usageReason} full>
              <Textarea
                value={ev.methodsIncome.incomeReason}
                onChange={(e) =>
                  setField("methodsIncome", "incomeReason", e.target.value)
                }
                rows={4}
              />
            </Field>
          </GridFields>
        )}
        {(activeVmTab === "vm-r" ||
          activeVmTab === "vm-d" ||
          activeVmTab === "vm-e") && (
          <p style={{ color: "#888", fontSize: 13 }}>{t.comingSoon}</p>
        )}
      </SectionCard>

      {/* رأي المقيم */}
      <SectionCard title={t.secAppraiser}>
        <GridFields>
          <Field label={t.evalDate}>
            <Input
              type="date"
              value={ev.appraiser.evalDate}
              onChange={(e) =>
                setField("appraiser", "evalDate", e.target.value)
              }
            />
          </Field>
          <Field label={t.completedDate}>
            <Input
              type="date"
              value={ev.appraiser.completedDate}
              onChange={(e) =>
                setField("appraiser", "completedDate", e.target.value)
              }
            />
          </Field>
          <Field label={t.reportDate}>
            <Input
              type="date"
              value={ev.appraiser.reportDate}
              onChange={(e) =>
                setField("appraiser", "reportDate", e.target.value)
              }
            />
          </Field>
          <Field label={t.finalAssetValue}>
            <Input
              dir="ltr"
              value={ev.appraiser.finalAssetValue}
              onChange={(e) =>
                setField("appraiser", "finalAssetValue", e.target.value)
              }
            />
          </Field>
          <Field label={t.appraiserDesc} full>
            <Textarea
              value={ev.appraiser.appraiserDesc}
              onChange={(e) =>
                setField("appraiser", "appraiserDesc", e.target.value)
              }
              rows={4}
            />
          </Field>
          <Field label={t.appraiserNotes} full>
            <Textarea
              value={ev.appraiser.appraiserNotes}
              onChange={(e) =>
                setField("appraiser", "appraiserNotes", e.target.value)
              }
              rows={3}
            />
          </Field>
        </GridFields>
      </SectionCard>

      {/* بنود التقرير */}
      <SectionCard title={t.secReport}>
        <GridFields>
          <Field label={t.standards} full>
            <Textarea
              value={ev.reportItems.standards}
              onChange={(e) =>
                setField("reportItems", "standards", e.target.value)
              }
              rows={3}
            />
          </Field>
          <Field label={t.scope} full>
            <Textarea
              value={ev.reportItems.scope}
              onChange={(e) => setField("reportItems", "scope", e.target.value)}
              rows={6}
            />
          </Field>
          <Field label={t.assumptions} full>
            <Textarea
              value={ev.reportItems.assumptions}
              onChange={(e) =>
                setField("reportItems", "assumptions", e.target.value)
              }
              rows={4}
            />
          </Field>
          <Field label={t.risks} full>
            <Textarea
              value={ev.reportItems.risks}
              onChange={(e) => setField("reportItems", "risks", e.target.value)}
              rows={2}
            />
          </Field>
        </GridFields>
      </SectionCard>

      {/* معدي التقرير */}
      <SectionCard title={t.secAuthors}>
        <GridFields>
          {[1, 2, 3, 4].map((n) => (
            <React.Fragment key={n}>
              <Field label={t.authorId.replace("%n", String(n))}>
                <Input
                  value={(ev.authors as any)[`author${n}Id`] ?? ""}
                  onChange={(e) =>
                    setField("authors", `author${n}Id`, e.target.value)
                  }
                />
              </Field>
              <Field label={t.authorTitle.replace("%n", String(n))}>
                <Input
                  value={(ev.authors as any)[`author${n}Title`] ?? ""}
                  onChange={(e) =>
                    setField("authors", `author${n}Title`, e.target.value)
                  }
                />
              </Field>
            </React.Fragment>
          ))}
        </GridFields>
      </SectionCard>

      {/* side rail */}
      <div style={styles.sideRail}>
        <button
          type="button"
          onClick={() => setDrawerOpen((o) => !o)}
          style={styles.railBtn}
          title={lang === "ar" ? "الملخص المالي" : "Financial Summary"}
        >
          💰
        </button>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={styles.railBtn}
          title={lang === "ar" ? "للأعلى" : "To top"}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  shell: {
    fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif",
    fontSize: 14,
    color: "#222",
    background: "#f4f6f9",
    minHeight: "100vh",
    padding: "16px",
    paddingTop: 68,
    position: "relative",
  },
  stickyBar: {
    position: "fixed",
    top: 0,
    right: 0,
    left: 0,
    zIndex: 300,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 16px",
    background: "#fff",
    borderBottom: "1px solid #dde",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    flexWrap: "wrap",
  },
  pageTitle: { fontSize: 20, fontWeight: 700, margin: "0 0 14px" },
  sectionCard: {
    background: "#fff",
    border: "1px solid #dde",
    borderRadius: 6,
    marginBottom: 10,
    overflow: "hidden",
  },
  sectionHead: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "#fafbfc",
    border: "none",
    borderBottom: "1px solid #eee",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    color: "#222",
    textAlign: "right",
  },
  sectionBody: { padding: "14px 16px" },
  gridFields: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
    gap: 14,
  },
  fieldLabel: {
    display: "block",
    fontSize: 12,
    color: "#555",
    marginBottom: 4,
    fontWeight: 500,
  },
  input: {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontSize: 13,
    color: "#222",
    background: "#fff",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    marginBottom: 8,
  },
  th: {
    background: "#f0f4f8",
    border: "1px solid #ddd",
    padding: "6px 8px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  td: { border: "1px solid #ddd", padding: "4px", verticalAlign: "middle" },
  cellInput: {
    width: "100%",
    padding: "4px 6px",
    border: "1px solid #ddd",
    borderRadius: 3,
    fontSize: 12,
    background: "#fff",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#0066cc",
    cursor: "pointer",
    fontSize: 13,
    padding: "4px 0",
    textDecoration: "underline",
  },
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 4px",
    color: "#c00",
  },
  btnPrimary: {
    background: "#1a6fc4",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  btnSecondary: {
    background: "#fff",
    color: "#444",
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  actionBtn: {
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: "5px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
  },
  vmTab: {
    padding: "6px 14px",
    border: "1px solid #ccc",
    borderRadius: 4,
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    color: "#444",
  },
  vmTabActive: { background: "#1a6fc4", color: "#fff", borderColor: "#1a6fc4" },
  sideRail: {
    position: "fixed",
    left: 0,
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    zIndex: 201,
  },
  railBtn: {
    width: 36,
    height: 36,
    background: "#1a6fc4",
    color: "#fff",
    border: "none",
    borderRadius: "0 4px 4px 0",
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
