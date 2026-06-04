"use client";

import { useEffect, useState, useContext } from "react";
import { toApiUrl } from "@/lib/api-url";
import { SettlementRow } from "./SettlementComparison";
import { SettlementComparison } from "./SettlementComparison";
import React from "react";
import { DEFAULT_SECTION1_TITLES } from "./SettlementComparison";
import { LanguageContext } from "@/components/layout-provider";
import {
  ReplacementCostSection,
  type ReplacementFields,
  type ReplacementLine,
} from "./ReplacementCostSection";
import dynamic from "next/dynamic";

// ─── Lucide Icons ─────────────────────────────────────────────────────────────
import {
  ArrowRight,
  ArrowLeft,
  Save,
  Download,
  Image,
  Paperclip,
  Pencil,
  Map,
  Pin,
  Printer,
  FileText,
  MessageSquare,
  ChevronDown,
  CheckCircle2,
  XCircle,
  MapPin,
  Loader2,
  X,
  Check,
  ClipboardList,
  Link2,
  Layers,
  Info,
  LayoutGrid,
  Database,
  Compass,
  Wrench,
  Zap,
  BarChart2,
  UserCheck,
  ScrollText,
  Users,
  Building2,
  Scale,
} from "lucide-react";

// ─── Map Picker (lazy-loaded, same as SettlementComparison) ──────────────────
const MapPickerComponent = dynamic(() => import("./MapPickerComponent"), {
  ssr: false,
});

// ─── i18n ─────────────────────────────────────────────────────────────────────

// Defined locally to avoid cross-project imports
type AvailableServices = {
  electricity: boolean | null;
  electricityUnits: number | null;
  sanitaryDrainage: boolean | null;
  telephoneLine: boolean | null;
  waterMetersCount: number | null;
  electricityMetersCount: number | null;
};

const T = {
  ar: {
    loading: "جاري تحميل بيانات المعاملة...",
    errorPrefix: "خطأ في تحميل البيانات:",
    noId: "لم يتم تحديد معرف المعاملة",
    back: "العودة",
    saving: "جاري الحفظ...",
    subDivisionRecordNumber: "رقم محضر التجزئة",
    otherUsers: "المستخدمين الأخرين",
    deedSource: "مصدر الصك",
    buildingLicense: "رخصة البناء",
    buildingLicenseDate: "تاريخ رخصة البناء",
    elevation: "المنسوب",
    inspectionBoundaries: "حدود المعاينة",
    save: "حفظ في قاعدة البيانات",
    download: "تحميل",
    savedOk: "تم الحفظ بنجاح",
    saveError: "فشل الحفظ. يرجى المحاولة مجدداً.",
    pageTitle: "تفاصيل المعاملة",
    secRequest: "معلومات الطلب",
    secLinks: "الروابط الهامة",
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
    address: "العنوان",
    propertyType: "نوع الأصل",
    propertyArea: "مساحة الأصل",
    landUse: "الاستخدام",
    inspector: "المعاين",
    contactNo: "رقم التواصل",
    reviewer: "المراجع",
    btnImages: "الصور",
    btnAttachments: "المرفقات",
    btnEdit: "تعديل",
    btnNearComps: "المقارنات القريبة",
    btnCopyComps: "نسخ المقارنات",
    btnView: "عرض",
    btnPdf: "تحميل PDF",
    btnMessages: "ملاحظات",
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
    propertyCode: "رمز العقار",
    clientName: "اسم العميل",
    authorizedName: "اسم المفوض بطلب التقييم",
    ownerName: "اسم المالك",
    deedNumber: "رقم الصك",
    deedDate: "تاريخ الصك",
    northBoundary: "الحد الشمالي",
    northLength: "طول الحد الشمالي",
    southBoundary: "الحد الجنوبي",
    southLength: "طول الحد الجنوبي",
    eastBoundary: "الحد الشرقي",
    eastLength: "طول الحد الشرقي",
    westBoundary: "الحد الغربي",
    westLength: "طول الحد الغربي",
    buildingState: "حالة المبنى",
    floorsCount: "عدد الادوار",
    propertyAge: "عمر العقار",
    finishLevel: "مستوى التشطيب",
    buildQuality: "حالة البناء",
    selectValue: "الرجاء اختيار قيمة",
    parcelNumber: "رقم القطعة",
    planNumber: "رقم المخطط",
    blockNumber: "رقم البلوك",
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
    street: "الشارع",
    electricity: "الكهرباء",
    sanitaryDrainage: "الصرف الصحي",
    telephoneLine: "خط الهاتف",
    electricityUnits: "وحدات الكهرباء",
    waterMetersCount: "عدادات المياه",
    electricityMetersCount: "عدادات الكهرباء",
    coords: "الاحداثيات",
    lat: "خط العرض",
    lng: "خط الطول",
    zoomMap: "الزوم (الخارطة)",
    zoomAerial: "الزوم (الصورة الجوية)",
    zoomComparisons: "الزوم (خريطة المقارنات)",
    pickFromMap: "اختيار من الخريطة",
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
    evalDate: "تاريخ المعاينة",
    completedDate: "تاريخ التقييم",
    reportDate: "تاريخ التقرير",
    finalAssetValue: "القيمة النهائية للأصل",
    appraiserDesc: "وصف المقيم ورأيه حول الأصل",
    appraiserNotes: "الملاحظات أو النواقص",
    standards: "معايير التقييم المتبعة",
    scope: "نطاق البحث والاستقصاء",
    assumptions: "الافتراضات",
    risks: "المخاطر أو عدم اليقين",
    authorId: "معد %n — معرف/اسم",
    authorTitle: "معد %n — المنصب",
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
    addComparison: "مقارنة جديدة",
    settlementItem: "البند",
    settlementSubject: "محل التقييم",
    settlementComp: "المقارنة",
    settlementDesc: "وصف",
    settlementAdj: "تعديل",
    meterPrice: "سعر المتر",
    totalAdjustments: "مجموع التسويات",
    priceAfterAdj: "سعر المقارن بعد التسوية",
    addSettlement: "بند تسوية",
    repTitle: "العنوان",
    repArea: "المساحة",
    repPrice: "السعر",
    repTotal: "الإجمالي",
    repNotes: "ملاحظات",
    repUseArea: "يُحتسب بالمساحة",
    repDelete: "حذف",
    addRepLine: "بند جديد",
    close: "إغلاق",
    assetCountVal: "1",
  },
  en: {
    loading: "Loading transaction data...",
    errorPrefix: "Error loading data:",
    noId: "No transaction ID specified",
    back: "Back",
    saving: "Saving...",
    save: "Save to Database",
    download: "Download",
    parcelNumber: "Parcel Number",
    planNumber: "Plan Number",
    blockNumber: "Block Number",
    savedOk: "Saved successfully",
    saveError: "Save failed. Please try again.",
    pageTitle: "Transaction Details",
    secRequest: "Request Information",
    secLinks: "Important Links",
    secAssetDetails: "Asset Details",
    subDivisionRecordNumber: "Sub-Division Record Number",
    otherUsers: "Other Users",
    deedSource: "Deed Source",
    buildingLicense: "Building License",
    buildingLicenseDate: "Building License Date",
    elevation: "Elevation",
    inspectionBoundaries: "Inspection Boundaries",
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
    address: "Address",
    propertyType: "Property Type",
    propertyArea: "Property Area",
    landUse: "Land Use",
    inspector: "Inspector",
    contactNo: "Contact Number",
    reviewer: "Reviewer",
    btnImages: "Images",
    btnAttachments: "Attachments",
    btnEdit: "Edit",
    btnNearComps: "Nearby Comparisons",
    btnCopyComps: "Copy Comparisons",
    btnView: "View",
    btnPdf: "Download PDF",
    btnMessages: "Notes",
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
    propertyCode: "Property Code",
    clientName: "Client Name",
    authorizedName: "Authorized Requester Name",
    ownerName: "Owner Name",
    deedNumber: "Deed Number",
    deedDate: "Deed Date",
    northBoundary: "North Boundary",
    northLength: "North Length",
    southBoundary: "South Boundary",
    southLength: "South Length",
    eastBoundary: "East Boundary",
    eastLength: "East Length",
    westBoundary: "West Boundary",
    westLength: "West Length",
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
    street: "Street",
    electricity: "Electricity",
    sanitaryDrainage: "Sanitary Drainage",
    telephoneLine: "Telephone Line",
    electricityUnits: "Electricity Units",
    waterMetersCount: "Water Meters",
    electricityMetersCount: "Electricity Meters",
    coords: "Coordinates",
    lat: "Latitude",
    lng: "Longitude",
    zoomMap: "Zoom (Map)",
    zoomAerial: "Zoom (Aerial)",
    zoomComparisons: "Zoom (Comparisons Map)",
    pickFromMap: "Pick from Map",
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
    evalDate: "Inspection Date",
    completedDate: "Valuation Date",
    reportDate: "Report Date",
    finalAssetValue: "Final Asset Value",
    appraiserDesc: "Appraiser Description & Opinion",
    appraiserNotes: "Notes or Deficiencies",
    standards: "Applied Valuation Standards",
    scope: "Scope of Investigation",
    assumptions: "Assumptions",
    risks: "Risks or Uncertainty",
    authorId: "Author %n — ID/Name",
    authorTitle: "Author %n — Title",
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
    addComparison: "New Comparison",
    settlementItem: "Item",
    settlementSubject: "Subject Property",
    settlementComp: "Comparison",
    settlementDesc: "Description",
    settlementAdj: "Adjustment",
    meterPrice: "Meter Price",
    totalAdjustments: "Total Adjustments",
    priceAfterAdj: "Price After Adjustment",
    addSettlement: "New Settlement Item",
    repTitle: "Title",
    repArea: "Area",
    repPrice: "Price",
    repTotal: "Total",
    repNotes: "Notes",
    repUseArea: "Calculate by Area",
    repDelete: "Delete",
    addRepLine: "New Line",
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

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  new: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  inspection: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  review: { bg: "#fefce8", text: "#a16207", border: "#fde68a" },
  audit: { bg: "#faf5ff", text: "#7c3aed", border: "#ddd6fe" },
  approved: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  sent: { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" },
  cancelled: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  pending: { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
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

// ─── Design System ────────────────────────────────────────────────────────────

const DS = {
  // Colors
  primary: "#0e7490",
  primaryLight: "#f0f9ff",
  primaryMid: "#cffafe",
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  text: "#0f172a",
  textMuted: "#64748b",
  textLight: "#94a3b8",
  green: "#059669",
  greenLight: "#f0fdf4",
  red: "#dc2626",
  amber: "#d97706",
  // Spacing
  radius: { sm: 6, md: 10, lg: 14, xl: 18 },
  shadow: {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)",
    lg: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)",
  },
};

// ─── Helper functions ─────────────────────────────────────────────────────────

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

function emptyAvailableServices(): AvailableServices {
  return {
    electricity: null,
    electricityUnits: null,
    sanitaryDrainage: null,
    telephoneLine: null,
    waterMetersCount: null,
    electricityMetersCount: null,
  };
}
// ─── Read-only grid ───────────────────────────────────────────────────────────

function ReadOnlyGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "12px 20px",
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
          fontSize: 10,
          color: DS.textLight,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: value ? DS.text : DS.textLight,
          fontWeight: value ? 500 : 400,
          lineHeight: 1.5,
          padding: "7px 10px",
          background: DS.surfaceAlt,
          borderRadius: DS.radius.md,
          border: `1px solid ${DS.border}`,
          minHeight: 34,
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  defaultOpen = false,
  accentColor,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasAccent = !!accentColor;

  return (
    <div
      style={{
        background: DS.surface,
        border: `1px solid ${DS.border}`,
        borderRadius: DS.radius.xl,
        marginBottom: 8,
        overflow: "hidden",
        boxShadow: DS.shadow.sm,
        transition: "box-shadow 0.2s",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "13px 18px",
          background: hasAccent ? accentColor : DS.surfaceAlt,
          border: "none",
          borderBottom: open ? `1px solid ${DS.border}` : "none",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13,
          color: hasAccent ? "#fff" : DS.text,
          textAlign: "inherit" as const,
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1 }}>
          {icon && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: DS.radius.sm,
                background: hasAccent
                  ? "rgba(255,255,255,0.18)"
                  : `${DS.primary}15`,
                color: hasAccent ? "#fff" : DS.primary,
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
          )}
          <span>{title}</span>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: DS.radius.sm,
            background: hasAccent ? "rgba(255,255,255,0.2)" : DS.border,
            color: hasAccent ? "#fff" : DS.textMuted,
            transition: "transform 0.25s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        >
          <ChevronDown size={13} />
        </span>
      </button>
      {open && <div style={{ padding: "18px 20px" }}>{children}</div>}
    </div>
  );
}

// ─── Grid + Field ─────────────────────────────────────────────────────────────

function GridFields({
  children,
  tight = false,
}: {
  children: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
        gap: tight ? "8px" : "14px",
      }}
    >
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
      <label
        style={{
          display: "block",
          fontSize: 11,
          color: DS.textMuted,
          marginBottom: 5,
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Input primitives ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  border: `1px solid ${DS.border}`,
  borderRadius: DS.radius.md,
  fontSize: 13,
  color: DS.text,
  background: DS.surface,
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

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
      style={{
        ...inputStyle,
        background: readOnly ? DS.surfaceAlt : DS.surface,
      }}
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
      style={{ ...inputStyle, resize: "vertical", minHeight: `${rows * 24}px` }}
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
      style={inputStyle}
    >
      {children}
    </select>
  );
}

// ─── Comparison + Settlement tables (unchanged logic) ─────────────────────────

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
      <div
        style={{
          overflowX: "auto",
          borderRadius: DS.radius.md,
          border: `1px solid ${DS.border}`,
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr>
              <th style={thS}>{t.settlementItem}</th>
              <th style={thS}>{t.settlementSubject}</th>
              {Array.from({ length: n }, (_, c) => (
                <th key={c} colSpan={2} style={thS}>
                  {t.settlementComp} {c + 1}
                </th>
              ))}
            </tr>
            <tr>
              <th style={thS}>—</th>
              <th style={thS}>—</th>
              {Array.from({ length: n }, (_, c) => (
                <React.Fragment key={c}>
                  <th style={thS}>{t.settlementDesc}</th>
                  <th style={thS}>{t.settlementAdj}</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#eff6ff" }}>
              <td colSpan={2} style={tdS}>
                <strong>{t.meterPrice}</strong>
              </td>
              {Array.from({ length: n }, (_, c) => (
                <td key={c} colSpan={2} style={tdS}>
                  <input
                    dir="ltr"
                    value={bases[c] || ""}
                    readOnly
                    style={cellInputS}
                  />
                </td>
              ))}
            </tr>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={tdS}>
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
                      style={{ ...cellInputS, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: DS.red,
                        padding: "2px 4px",
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </td>
                <td style={tdS}>
                  <input
                    value={row.valueM}
                    onChange={(e) => updateRow(i, "valueM", e.target.value)}
                    style={cellInputS}
                  />
                </td>
                {Array.from({ length: n }, (_, c) => (
                  <React.Fragment key={c}>
                    <td style={tdS}>
                      <input
                        value={(row.cols || [])[c] || ""}
                        onChange={(e) =>
                          updateCol(i, c, "cols", e.target.value)
                        }
                        style={cellInputS}
                      />
                    </td>
                    <td style={tdS}>
                      <input
                        dir="ltr"
                        value={(row.colAdj || [])[c] || ""}
                        onChange={(e) =>
                          updateCol(i, c, "colAdj", e.target.value)
                        }
                        style={cellInputS}
                      />
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))}
            <tr style={{ background: DS.surfaceAlt }}>
              <td colSpan={2} style={tdS}>
                <strong>{t.totalAdjustments}</strong>
              </td>
              {Array.from({ length: n }, (_, c) => (
                <td key={c} colSpan={2} style={tdS}>
                  <input
                    dir="ltr"
                    readOnly
                    value={colTotals[c].toFixed(2)}
                    style={{ ...cellInputS, background: "#eee" }}
                  />
                </td>
              ))}
            </tr>
            <tr style={{ background: DS.surfaceAlt }}>
              <td colSpan={2} style={tdS}>
                <strong>{t.priceAfterAdj}</strong>
              </td>
              {Array.from({ length: n }, (_, c) => (
                <td key={c} colSpan={2} style={tdS}>
                  <input
                    dir="ltr"
                    readOnly
                    value={colAfter[c]}
                    style={{ ...cellInputS, background: "#eee" }}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addRow} style={linkBtnS}>
        + {t.addSettlement}
      </button>
    </div>
  );
}

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

// ─── Empty eval ───────────────────────────────────────────────────────────────

function emptyEval() {
  return {
    status: "new",
    assetInfo: {
      address: "",
      propertyType: "",
      propertyArea: "",
      landUse: "",
      subDivisionRecordNumber: "",
      otherUsers: "",
      deedSource: "",
      buildingLicense: "",
      buildingLicenseDate: "",
      elevation: "",
      inspectionBoundaries: "",
      inspector: "",
      contactNo: "",
      reviewer: "",
    },
    location: {
      regionId: "",
      regionName: "",
      cityId: "",
      cityName: "",
      neighborhoodId: "",
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
      subDivisionRecordNumber: "",
      otherUsers: "",
      deedSource: "",
      buildingLicense: "",
      buildingLicenseDate: "",
      parcelNumber: "",
      planNumber: "",
      blockNumber: "",
      elevation: "",
      inspectionBoundaries: "",
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
      buildingCondition: {
        status: "",
        completionPct: null as number | null,
        otherText: "",
      },
      floorsCount: "",
      propertyAge: "",
      finishLevel: "",
      buildQuality: "",
    },
    services: {
      street: "",
      availableServices: emptyAvailableServices(),
      surroundingEnvironment: [] as string[],
    },
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
    section1Rows: [] as {
      inReport?: boolean;
      title: string;
      colAdj: string[];
      cols?: string[];
      valueM?: string;
    }[],

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
      maintenanceDesc: "",
      finishesDesc: "",
      landTitle: "",
      landSpace: "",
      meterPriceLand: "",
      completionPct: "",
      replacementNotes: "",
    },
  };
}

// ─── Table style helpers ──────────────────────────────────────────────────────

const thS: React.CSSProperties = {
  background: DS.surfaceAlt,
  border: `1px solid ${DS.border}`,
  padding: "8px 10px",
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
  textAlign: "center" as const,
  fontSize: 10,
  color: DS.textMuted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const tdS: React.CSSProperties = {
  border: `1px solid ${DS.border}`,
  padding: "5px",
  verticalAlign: "middle" as const,
};

const cellInputS: React.CSSProperties = {
  width: "100%",
  padding: "5px 8px",
  border: `1px solid ${DS.border}`,
  borderRadius: DS.radius.sm,
  fontSize: 12,
  background: DS.surface,
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  color: DS.text,
};

const linkBtnS: React.CSSProperties = {
  background: "none",
  border: "none",
  color: DS.primary,
  cursor: "pointer",
  fontSize: 12,
  padding: "6px 0",
  fontWeight: 700,
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  gap: 4,
  marginTop: 8,
};

// ─── Action Button (toolbar) ──────────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        border: `1px solid ${accent ? accent + "40" : DS.border}`,
        borderRadius: DS.radius.md,
        background: accent ? accent + "10" : DS.surfaceAlt,
        color: accent ?? DS.textMuted,
        fontSize: 12,
        fontWeight: 600,
        cursor: onClick ? "pointer" : "default",
        fontFamily: "inherit",
        opacity: onClick ? 1 : 0.5,
        transition: "all 0.15s",
        whiteSpace: "nowrap" as const,
        boxShadow: DS.shadow.sm,
      }}
    >
      <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TransactionEvaluationPage({
  transactionId,
  onBack,
  onOpenAttachments,
  onOpenNotes,
  onOpenImages,
  onOpenEdit,
  onStatusSaved,
}: {
  transactionId: string;
  onBack: () => void;
  onOpenAttachments?: (transactionId: string, requester: string) => void;
  onOpenNotes?: (transactionId: string, requester: string) => void;
  onOpenImages?: (transactionId: string, requester: string) => void;
  onOpenEdit?: (transactionId: string, requester: string) => void;
  onStatusSaved?: () => void;
}) {
  const langContext = useContext(LanguageContext);
  const lang: Lang = (langContext?.language === "en" ? "en" : "ar") as Lang;
  const isRtl = lang === "ar";
  const t = T[lang];

  // ── InlineSelectField (unchanged logic, restyled) ──────────────────────────
  function InlineSelectField({
    displayValue,
    selectValue,
    onSelectChange,
    placeholder,
    children,
    hint,
  }: {
    displayValue: string;
    selectValue: string;
    onSelectChange: (val: string) => void;
    placeholder: string;
    children: React.ReactNode;
    hint?: string;
  }) {
    const [open, setOpen] = useState(false);
    return (
      <div>
        {displayValue && !open ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                ...inputStyle,
                background: DS.surfaceAlt,
                flex: 1,
                color: DS.text,
              }}
            >
              {displayValue}
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              style={{
                fontSize: 11,
                color: DS.primary,
                background: `${DS.primary}10`,
                border: `1px solid ${DS.primary}30`,
                borderRadius: DS.radius.sm,
                padding: "5px 10px",
                cursor: "pointer",
                whiteSpace: "nowrap" as const,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              {lang === "ar" ? "تغيير" : "Change"}
            </button>
          </div>
        ) : (
          <div>
            <select
              value={selectValue}
              onChange={(e) => {
                onSelectChange(e.target.value);
                setOpen(false);
              }}
              style={inputStyle}
              autoFocus={open}
            >
              <option value="" disabled>
                {placeholder}
              </option>
              {children}
            </select>
            {displayValue && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  fontSize: 11,
                  color: DS.textMuted,
                  background: "none",
                  border: "none",
                  padding: "2px 0",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
            )}
          </div>
        )}
        {hint && (
          <p style={{ fontSize: 11, color: DS.textLight, marginTop: 3 }}>
            {hint}
          </p>
        )}
      </div>
    );
  }

  // ── State ──────────────────────────────────────────────────────────────────
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    type: "ok" | "error" | "info";
    text: string;
  }>({ type: "ok", text: "" });
  const [saving, setSaving] = useState(false);
  const [ev, setEv] = useState(emptyEval());
  const [settlementNumCols] = useState(3);
  const [settlementNotes, setSettlementNotes] = useState(
    lang === "ar"
      ? "-تم اجراء عملية التسويات و التعديلات حسب ما هو متعارف في السوق.\n-بعد معاينة المنطقة المحيطة بالعقار تم الوصول إلى صفقات منفذة وعروض قائمة."
      : "-Adjustments were made in accordance with market norms.\n-After inspecting the surrounding area, executed transactions and active listings were identified.",
  );
  const [activeVmTab, setActiveVmTab] = useState("vm-m");

  // ── Map picker state for Map Location section ──────────────────────────────
  const [showMapPicker, setShowMapPicker] = useState(false);

  // ── Locations ──────────────────────────────────────────────────────────────
  const [regions, setRegions] = useState<
    { id: string; titleAr: string; titleEn: string }[]
  >([]);
  const [cities, setCities] = useState<
    { id: string; titleAr: string; titleEn: string; regionId: string }[]
  >([]);
  const [neighborhoods, setNeighborhoods] = useState<
    { id: string; titleAr: string; titleEn: string; cityId: string }[]
  >([]);

  const setField = (section: string, field: string, val: string) =>
    setEv((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof typeof prev] as any),
        [field]: val,
      },
    }));

  const setAvailableService = (
    key: keyof AvailableServices,
    val: boolean | number | null,
  ) =>
    setEv((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        availableServices: { ...prev.services.availableServices, [key]: val },
      },
    }));

  const setSurroundingEnv = (key: string, checked: boolean) =>
    setEv((prev) => {
      const current = prev.services.surroundingEnvironment ?? [];
      const next = checked
        ? current.includes(key)
          ? current
          : [...current, key]
        : current.filter((k) => k !== key);
      return {
        ...prev,
        services: { ...prev.services, surroundingEnvironment: next },
      };
    });

  const requester = (tx?.clientName ?? tx?.clientId ?? transactionId) as string;

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

  useEffect(() => {
    Promise.all([
      fetch(toApiUrl("/api/locations/regions"), {
        credentials: "include",
      }).then((r) => r.json()),
      fetch(toApiUrl("/api/locations/cities"), { credentials: "include" }).then(
        (r) => r.json(),
      ),
      fetch(toApiUrl("/api/locations/neighborhoods"), {
        credentials: "include",
      }).then((r) => r.json()),
    ])
      .then(([regs, cts, nbs]) => {
        setRegions(regs);
        setCities(cts);
        setNeighborhoods(nbs);
      })
      .catch(console.error);
  }, []);

  const citiesForRegion = ev.location.regionId
    ? cities.filter((c) => c.regionId === ev.location.regionId)
    : cities;
  const neighborhoodsForCity = ev.location.cityId
    ? neighborhoods.filter((n) => n.cityId === ev.location.cityId)
    : neighborhoods;

  useEffect(() => {
    if (!tx) return;
    const e: Record<string, any> = tx.evalData ?? {};
    const bl = buildByLabel(tx.templateFieldValues);
    const pick = (...candidates: (string | undefined)[]): string =>
      candidates.find((v) => v !== undefined && v !== "") ?? "";
    const resolvedPropertyArea = pick(
      e.propertyArea,
      e.landSpace,
      e.assetArea,
      bl["مساحة الأصل"],
    );
    const rawSvc: AvailableServices = {
      electricity: e.availableServices?.electricity ?? e.electricity ?? null,
      electricityUnits:
        e.availableServices?.electricityUnits ?? e.electricityUnits ?? null,
      sanitaryDrainage:
        e.availableServices?.sanitaryDrainage ?? e.sanitaryDrainage ?? null,
      telephoneLine:
        e.availableServices?.telephoneLine ?? e.telephoneLine ?? null,
      waterMetersCount:
        e.availableServices?.waterMetersCount ?? e.waterMetersCount ?? null,
      electricityMetersCount:
        e.availableServices?.electricityMetersCount ??
        e.electricityMetersCount ??
        null,
    };
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
        regionId: pick(e.regionId),
        regionName: pick(e.regionName),
        cityId: pick(e.cityId),
        cityName: pick(e.cityName, bl["المدينة"]),
        neighborhoodId: pick(e.neighborhoodId),
        neighborhoodName: pick(e.neighborhoodName, bl["الحي"]),
        assetCategoryId: pick(e.assetCategoryId),
        propertyTypeId: pick(e.propertyTypeId),
      },
      assetInfo: {
        address: pick(e.address, bl["العنوان"]),
        propertyType: pick(e.propertyType, bl["نوع الأصل"]),
        propertyArea: resolvedPropertyArea,
        landUse: pick(e.landUse, e.usage, bl["الاستخدام"]),
        subDivisionRecordNumber: pick(e.subDivisionRecordNumber),
        otherUsers: pick(e.otherUsers),
        deedSource: pick(e.deedSource),
        buildingLicense: pick(e.buildingLicense),
        buildingLicenseDate: pick(e.buildingLicenseDate),
        elevation: pick(e.elevation),
        inspectionBoundaries: pick(e.inspectionBoundaries),
        inspector: pick(e.inspector, bl["المعاين"]),
        contactNo: pick(e.contactNo, bl["رقم التواصل"]),
        reviewer: pick(e.reviewer, bl["المراجع"]),
      },
      basic: {
        propertyCode: pick(e.propertyCode, bl["رمز العقار"]),
        deedNumber: pick(e.deedNumber, bl["رقم الصك"]),
        deedDate: pick(e.deedDate, bl["تاريخ الصك"]),
        subDivisionRecordNumber: pick(e.subDivisionRecordNumber),
        otherUsers: pick(e.otherUsers),
        deedSource: pick(e.deedSource),
        buildingLicense: pick(e.buildingLicense),
        buildingLicenseDate: pick(e.buildingLicenseDate),
        parcelNumber: pick(e.parcelNumber),
        planNumber: pick(e.planNumber),
        blockNumber: pick(e.blockNumber),
        elevation: pick(e.elevation),
        inspectionBoundaries: pick(e.inspectionBoundaries),
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
        buildingCondition:
          e.buildingCondition && typeof e.buildingCondition === "object"
            ? {
                status: e.buildingCondition.status ?? "",
                completionPct: e.buildingCondition.completionPct ?? null,
                otherText: e.buildingCondition.otherText ?? "",
              }
            : // legacy fallback: old data stored flat buildingState
              {
                status: e.buildingState ?? "",
                completionPct: null,
                otherText: "",
              },
        floorsCount: pick(e.floorsCount),
        propertyAge: pick(e.propertyAge),
        finishLevel: pick(e.finishLevel),
        buildQuality: pick(e.buildQuality),
      },
      services: {
        street: pick(e.street),
        availableServices: rawSvc,
        surroundingEnvironment: Array.isArray(e.surroundingEnvironment)
          ? e.surroundingEnvironment
          : [],
      },
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
        ? e.comparisonRows.map((r: any) => ({
            ...r,
            landSpace: r.landSpace ?? r.propertyArea ?? "",
          }))
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
      replacementFields: {
        managementPct: pick(e.managementPct),
        professionalPct: pick(e.professionalPct),
        utilityNetworkPct: pick(e.utilityNetworkPct),
        emergencyPct: pick(e.emergencyPct),
        maintenanceDesc: pick(e.maintenanceDesc),
        finishesDesc: pick(e.finishesDesc),
        replacementNotes: pick(e.replacementNotes),
        financePct: pick(e.financePct),
        landTitle: pick(e.landTitle, e.address),
        landSpace: pick(e.landSpace, resolvedPropertyArea),
        meterPriceLand: pick(e.meterPriceLand),
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

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg({ type: "info", text: t.saving });
    try {
      const evalData = {
        status: ev.status,
        ...ev.location,
        ...ev.assetInfo, // read-only display values — lower priority
        ...ev.basic, // editable fields win
        ...ev.boundaries,
        buildingCondition: ev.finishing.buildingCondition,
        floorsCount: ev.finishing.floorsCount,
        propertyAge: ev.finishing.propertyAge,
        finishLevel: ev.finishing.finishLevel,
        buildQuality: ev.finishing.buildQuality,
        street: ev.services.street,
        availableServices: ev.services.availableServices,
        surroundingEnvironment: ev.services.surroundingEnvironment,
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
      onStatusSaved?.();
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

  const svc = ev.services.availableServices;
  const statusColor = STATUS_COLORS[ev.status] ?? STATUS_COLORS.new;

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading)
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        style={{
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          minHeight: "100vh",
          background: "#f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{ color: DS.primary, animation: "spin 1s linear infinite" }}
        >
          <Loader2 size={28} />
        </div>
        <div style={{ fontSize: 14, color: DS.textMuted }}>{t.loading}</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    );

  if (fetchError)
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        style={{
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          minHeight: "100vh",
          background: "#f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: DS.radius.xl,
            padding: "24px 32px",
            border: `1px solid ${DS.border}`,
            boxShadow: DS.shadow.md,
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: DS.red,
            fontSize: 14,
          }}
        >
          <XCircle size={20} /> {t.errorPrefix} {fetchError}
        </div>
      </div>
    );

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: 14,
        color: DS.text,
        background: "#f1f5f9",
        minHeight: "100vh",
        padding: "20px 20px 100px",
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
          background: DS.surface,
          borderRadius: DS.radius.xl,
          padding: "12px 16px",
          border: `1px solid ${DS.border}`,
          boxShadow: DS.shadow.sm,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            background: DS.surfaceAlt,
            border: `1px solid ${DS.border}`,
            borderRadius: DS.radius.md,
            color: DS.textMuted,
            cursor: "pointer",
            boxShadow: DS.shadow.sm,
            flexShrink: 0,
            transition: "all 0.15s",
          }}
          title={t.back}
        >
          {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
        </button>

        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: 17,
              fontWeight: 700,
              margin: 0,
              color: DS.text,
              letterSpacing: "-0.2px",
            }}
          >
            {t.pageTitle}
          </h1>
          <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 2 }}>
            #{transactionId}
          </div>
        </div>

        {/* Status badge-select */}
        <div style={{ position: "relative" }}>
          <select
            value={ev.status}
            onChange={(e) => setEv((p) => ({ ...p, status: e.target.value }))}
            style={{
              appearance: "none" as const,
              padding: "6px 32px 6px 14px",
              borderRadius: 999,
              border: `1.5px solid ${statusColor.border}`,
              background: statusColor.bg,
              color: statusColor.text,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              outline: "none",
              minWidth: 120,
            }}
          >
            {WORKFLOW_STATUSES[lang].map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            style={{
              position: "absolute",
              top: "50%",
              [isRtl ? "left" : "right"]: 10,
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: statusColor.text,
            }}
          />
        </div>
      </div>

      {/* ── Request Information ─────────────────────────────────────────────── */}
      <SectionCard
        title={t.secRequest}
        defaultOpen={true}
        icon={<ClipboardList size={14} />}
      >
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
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${DS.border}`,
            flexWrap: "wrap",
          }}
        >
          {/* Replace the two static badge divs with these */}

          {/* isOpened — still read-only, no change */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 11px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${tx?.isOpened ? "#bbf7d0" : DS.border}`,
              background: tx?.isOpened ? "#f0fdf4" : DS.surfaceAlt,
              color: tx?.isOpened ? "#15803d" : DS.textMuted,
            }}
          >
            {tx?.isOpened ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {lang === "ar"
              ? tx?.isOpened
                ? "تم الفتح"
                : "لم يُفتح"
              : tx?.isOpened
                ? "Opened"
                : "Not opened"}
          </div>

          {/* isCompleted — now a clickable toggle */}
          <button
            type="button"
            onClick={async () => {
              const next = !tx?.isCompleted;
              // Optimistic update
              setTx((prev: any) => ({ ...prev, isCompleted: next }));
              try {
                const res = await fetch(
                  toApiUrl(`/api/transactions/${transactionId}/completed`),
                  {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isCompleted: next }),
                  },
                );
                if (!res.ok) throw new Error();
                const updated = await res.json();
                setTx(updated);
                onStatusSaved?.();
              } catch {
                // Revert on failure
                setTx((prev: any) => ({ ...prev, isCompleted: !next }));
                setStatusMsg({ type: "error", text: t.saveError });
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 11px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              border: `1.5px solid ${tx?.isCompleted ? "#bfdbfe" : DS.border}`,
              background: tx?.isCompleted ? "#eff6ff" : DS.surfaceAlt,
              color: tx?.isCompleted ? "#2563eb" : DS.textMuted,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {tx?.isCompleted ? (
              <CheckCircle2 size={13} />
            ) : (
              <XCircle size={13} />
            )}
            {lang === "ar"
              ? tx?.isCompleted
                ? "مكتملة "
                : "غير مكتملة"
              : tx?.isCompleted
                ? "Completed"
                : "Not completed"}
          </button>
        </div>
      </SectionCard>

      {/* ── Important Links ─────────────────────────────────────────────────── */}
      <details
        style={{
          background: DS.surface,
          border: `1px solid ${DS.border}`,
          borderRadius: DS.radius.xl,
          marginBottom: 8,
          overflow: "hidden",
          boxShadow: DS.shadow.sm,
        }}
      >
        <summary
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "13px 18px",
            background: DS.surfaceAlt,
            cursor: "pointer",
            listStyle: "none",
            fontWeight: 600,
            fontSize: 13,
            color: DS.text,
            gap: 9,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: DS.radius.sm,
                background: `${DS.primary}15`,
                color: DS.primary,
              }}
            >
              <Map size={14} />
            </span>
            {t.secLinks}
          </div>
          <ChevronDown
            size={13}
            style={{ color: DS.textMuted, flexShrink: 0 }}
          />
        </summary>
        <div style={{ padding: "16px 18px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "6px 10px",
            }}
          >
            {IMPORTANT_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 12px",
                  borderRadius: DS.radius.md,
                  border: `1px solid ${DS.border}`,
                  background: DS.surface,
                  color: DS.primary,
                  fontSize: 12,
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                <MapPin size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
                {lang === "ar" ? l.labelAr : l.labelEn}
              </a>
            ))}
          </div>
        </div>
      </details>

      {/* ── Asset Details toolbar ────────────────────────────────────────────── */}
      <div
        style={{
          background: DS.surface,
          border: `1px solid ${DS.border}`,
          borderRadius: DS.radius.xl,
          marginBottom: 8,
          padding: "14px 18px",
          boxShadow: DS.shadow.sm,
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: DS.textLight,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: "0 0 10px",
          }}
        >
          {t.secAssetDetails}
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <ActionButton
            icon={<Image size={14} />}
            label={t.btnImages}
            accent="#7c3aed"
            onClick={() => onOpenImages?.(transactionId, requester)}
          />
          <ActionButton
            icon={<Paperclip size={14} />}
            label={t.btnAttachments}
            accent="#0891b2"
            onClick={() => onOpenAttachments?.(transactionId, requester)}
          />
          <ActionButton
            icon={<Pencil size={14} />}
            label={t.btnEdit}
            accent="#d97706"
            onClick={() => onOpenEdit?.(transactionId, requester)}
          />
          <ActionButton icon={<Map size={14} />} label={t.btnNearComps} />
          <ActionButton icon={<Pin size={14} />} label={t.btnCopyComps} />
          <ActionButton
            icon={<Printer size={14} />}
            label={t.btnView}
            onClick={() =>
              window.open(`/api/transactions/${transactionId}/pdf`, "_blank")
            }
          />
          <ActionButton
            icon={<FileText size={14} />}
            label={t.btnPdf}
            onClick={() => {
              const a = document.createElement("a");
              a.href = `/api/transactions/${transactionId}/pdf`;
              a.download = `valuation-${transactionId}.pdf`;
              a.click();
            }}
          />
          <ActionButton
            icon={<MessageSquare size={14} />}
            label={t.btnMessages}
            accent="#0891b2"
            onClick={() => onOpenNotes?.(transactionId, requester)}
          />
        </div>
      </div>

      {/* ── Asset Info ──────────────────────────────────────────────────────── */}
      <SectionCard title={t.secAssetInfo} icon={<Building2 size={14} />}>
        <ReadOnlyGrid>
          <ReadOnlyItem label={t.address} value={ev.assetInfo.address} full />
          <ReadOnlyItem
            label={t.propertyType}
            value={ev.assetInfo.propertyType}
          />
          <ReadOnlyItem
            label={t.propertyArea}
            value={ev.assetInfo.propertyArea}
          />
          <ReadOnlyItem label={t.landUse} value={ev.assetInfo.landUse} />
          <ReadOnlyItem label={t.inspector} value={ev.assetInfo.inspector} />
          <ReadOnlyItem label={t.contactNo} value={ev.assetInfo.contactNo} />
          <ReadOnlyItem label={t.reviewer} value={ev.assetInfo.reviewer} />
        </ReadOnlyGrid>
      </SectionCard>

      {/* ── Location ────────────────────────────────────────────────────────── */}
      <SectionCard title={t.secLocation} icon={<MapPin size={14} />}>
        <GridFields>
          <Field label={t.region}>
            <InlineSelectField
              displayValue={
                ev.location.regionId
                  ? (regions.find((r) => r.id === ev.location.regionId)?.[
                      isRtl ? "titleAr" : "titleEn"
                    ] ?? ev.location.regionName)
                  : ev.location.regionName
              }
              selectValue={ev.location.regionId}
              onSelectChange={(val) => {
                setField("location", "regionId", val);
                setField("location", "cityId", "");
                setField("location", "neighborhoodId", "");
              }}
              placeholder={t.selectRegion}
              hint={
                ev.location.regionName && ev.location.regionId
                  ? `${isRtl ? "من الصك:" : "From deed:"} ${ev.location.regionName}`
                  : undefined
              }
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {isRtl ? r.titleAr : r.titleEn}
                </option>
              ))}
            </InlineSelectField>
          </Field>
          <Field label={t.city}>
            <InlineSelectField
              displayValue={
                ev.location.cityId
                  ? (cities.find((c) => c.id === ev.location.cityId)?.[
                      isRtl ? "titleAr" : "titleEn"
                    ] ?? ev.location.cityName)
                  : ev.location.cityName
              }
              selectValue={ev.location.cityId}
              onSelectChange={(val) => {
                setField("location", "cityId", val);
                setField("location", "neighborhoodId", "");
              }}
              placeholder={t.enterCity}
              hint={
                ev.location.cityName && ev.location.cityId
                  ? `${isRtl ? "من الصك:" : "From deed:"} ${ev.location.cityName}`
                  : undefined
              }
            >
              {citiesForRegion.map((c) => (
                <option key={c.id} value={c.id}>
                  {isRtl ? c.titleAr : c.titleEn}
                </option>
              ))}
            </InlineSelectField>
          </Field>
          <Field label={t.neighborhood}>
            <InlineSelectField
              displayValue={
                ev.location.neighborhoodId
                  ? (neighborhoods.find(
                      (n) => n.id === ev.location.neighborhoodId,
                    )?.[isRtl ? "titleAr" : "titleEn"] ??
                    ev.location.neighborhoodName)
                  : ev.location.neighborhoodName
              }
              selectValue={ev.location.neighborhoodId}
              onSelectChange={(val) =>
                setField("location", "neighborhoodId", val)
              }
              placeholder={t.enterNeighborhood}
              hint={
                ev.location.neighborhoodName && ev.location.neighborhoodId
                  ? `${isRtl ? "من الصك:" : "From deed:"} ${ev.location.neighborhoodName}`
                  : undefined
              }
            >
              {neighborhoodsForCity.map((n) => (
                <option key={n.id} value={n.id}>
                  {isRtl ? n.titleAr : n.titleEn}
                </option>
              ))}
            </InlineSelectField>
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
          <Field label={t.propertyType}>
            <InlineSelectField
              displayValue={
                ev.location.propertyTypeId
                  ? (PROPERTY_TYPES_OPTIONS[lang].find(
                      (o) => o.value === ev.location.propertyTypeId,
                    )?.label ?? ev.assetInfo.propertyType)
                  : ev.assetInfo.propertyType
              }
              selectValue={ev.location.propertyTypeId}
              onSelectChange={(val) =>
                setField("location", "propertyTypeId", val)
              }
              placeholder={t.selectPropertyType}
              hint={
                ev.assetInfo.propertyType && ev.location.propertyTypeId
                  ? `${isRtl ? "من الصك:" : "From deed:"} ${ev.assetInfo.propertyType}`
                  : undefined
              }
            >
              {PROPERTY_TYPES_OPTIONS[lang].map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </InlineSelectField>
          </Field>
        </GridFields>
      </SectionCard>

      {/* ── Basic Data ──────────────────────────────────────────────────────── */}
      <SectionCard title={t.secBasic} icon={<Database size={14} />}>
        <GridFields>
          {(
            [
              ["propertyCode", "propertyCode"],
              ["subDivisionRecordNumber", "subDivisionRecordNumber"],
              ["clientName", "clientName"],
              ["authorizedName", "authorizedName"],
              ["ownerName", "ownerName"],
              ["otherUsers", "otherUsers"],
              ["deedNumber", "deedNumber"],
              ["deedDate", "deedDate"],
              ["deedSource", "deedSource"],
              ["buildingLicense", "buildingLicense"],
              ["buildingLicenseDate", "buildingLicenseDate"],
              ["parcelNumber", "parcelNumber"],
              ["planNumber", "planNumber"],
              ["blockNumber", "blockNumber"],
              ["elevation", "elevation"],
            ] as [keyof typeof ev.basic, TKeys][]
          ).map(([key, labelKey]) => (
            <Field key={key} label={t[labelKey] as string}>
              <Input
                value={(ev.basic as any)[key]}
                onChange={(e) => setField("basic", key, e.target.value)}
              />
            </Field>
          ))}
          <Field label={t.inspectionBoundaries} full>
            <Input
              value={ev.basic.inspectionBoundaries}
              onChange={(e) =>
                setField("basic", "inspectionBoundaries", e.target.value)
              }
            />
          </Field>
        </GridFields>
      </SectionCard>

      {/* ── Boundaries ──────────────────────────────────────────────────────── */}
      <SectionCard title={t.secBoundaries} icon={<Compass size={14} />}>
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

      {/* ── Finishing ───────────────────────────────────────────────────────── */}
      <SectionCard title={t.secFinishing} icon={<Layers size={14} />}>
        <GridFields>
          <Field label={t.buildingState}>
            <Select
              value={ev.finishing.buildingCondition?.status ?? ""}
              onChange={(e) =>
                setEv((p) => ({
                  ...p,
                  finishing: {
                    ...p.finishing,
                    buildingCondition: {
                      ...p.finishing.buildingCondition,
                      status: e.target.value,
                      // reset completionPct when switching away from under construction
                      completionPct:
                        e.target.value === "10003"
                          ? p.finishing.buildingCondition.completionPct
                          : null,
                    },
                  },
                }))
              }
            >
              <option value="">{t.selectValue}</option>
              <option value="10001">{t.stateNew}</option>
              <option value="10002">{t.stateUsed}</option>
              <option value="10003">{t.stateUnderConstruction}</option>
              <option value="10004">{t.stateOther}</option>
            </Select>
          </Field>

          {ev.finishing.buildingCondition?.status === "10003" && (
            <Field label={t.completionPct}>
              <input
                type="number"
                dir="ltr"
                min={0}
                max={100}
                step={0.1}
                value={
                  ev.finishing.buildingCondition?.completionPct != null
                    ? String(ev.finishing.buildingCondition.completionPct)
                    : ""
                }
                onChange={(e) =>
                  setEv((p) => ({
                    ...p,
                    finishing: {
                      ...p.finishing,
                      buildingCondition: {
                        ...(p.finishing.buildingCondition ?? {
                          status: "",
                          completionPct: null,
                          otherText: "",
                        }),
                        completionPct:
                          e.target.value === ""
                            ? null
                            : parseFloat(e.target.value),
                      },
                    },
                  }))
                }
                placeholder="0.0"
                style={{ ...inputStyle, background: DS.surface }}
              />
            </Field>
          )}

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

      {/* ── Services ────────────────────────────────────────────────────────── */}
      <SectionCard title={t.secServices} icon={<Zap size={14} />}>
        <GridFields>
          <Field label={t.street} full>
            <Input
              value={ev.services.street}
              onChange={(e) =>
                setEv((p) => ({
                  ...p,
                  services: { ...p.services, street: e.target.value },
                }))
              }
            />
          </Field>
        </GridFields>

        <div style={{ marginTop: 16 }}>
          {/* Boolean toggle checkboxes — electricity, drainage, telephone */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginBottom: 12,
            }}
          >
            {(
              [
                {
                  key: "electricity" as const,
                  labelKey: "electricity" as TKeys,
                },
                {
                  key: "sanitaryDrainage" as const,
                  labelKey: "sanitaryDrainage" as TKeys,
                },
                {
                  key: "telephoneLine" as const,
                  labelKey: "telephoneLine" as TKeys,
                },
              ] as { key: keyof AvailableServices; labelKey: TKeys }[]
            ).map(({ key, labelKey }) => {
              const val = svc[key];
              const isChecked = val === true;
              const isUnchecked = val === false;
              return (
                <label
                  key={key}
                  htmlFor={`svc-${key}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 14px",
                    border: `1.5px solid ${isChecked ? "#16a34a" : isUnchecked ? "#dc262620" : DS.border}`,
                    borderRadius: DS.radius.md,
                    background: isChecked
                      ? "#f0fdf4"
                      : isUnchecked
                        ? "#fef2f2"
                        : DS.surfaceAlt,
                    cursor: "pointer",
                    userSelect: "none" as const,
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      border: `2px solid ${isChecked ? "#16a34a" : isUnchecked ? "#dc2626" : DS.borderStrong}`,
                      background: isChecked
                        ? "#16a34a"
                        : isUnchecked
                          ? "#dc2626"
                          : "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.15s",
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      const next =
                        val === null ? true : val === true ? false : null;
                      setAvailableService(key, next);
                    }}
                  >
                    {isChecked && (
                      <Check size={12} color="#fff" strokeWidth={3} />
                    )}
                    {isUnchecked && (
                      <X size={12} color="#fff" strokeWidth={3} />
                    )}
                  </div>
                  <input
                    id={`svc-${key}`}
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const next =
                        val === null ? true : val === true ? false : null;
                      setAvailableService(key, next);
                    }}
                    style={{ display: "none" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: isChecked
                          ? "#15803d"
                          : isUnchecked
                            ? "#b91c1c"
                            : DS.text,
                      }}
                    >
                      {t[labelKey] as string}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: DS.textLight,
                        marginTop: 1,
                      }}
                    >
                      {val === null
                        ? lang === "ar"
                          ? "غير محدد"
                          : "Not set"
                        : isChecked
                          ? lang === "ar"
                            ? "متوفر"
                            : "Available"
                          : lang === "ar"
                            ? "غير متوفر"
                            : "Not available"}
                    </div>
                  </div>
                  {isChecked && (
                    <CheckCircle2
                      size={15}
                      color="#16a34a"
                      style={{ flexShrink: 0 }}
                    />
                  )}
                  {isUnchecked && (
                    <XCircle
                      size={15}
                      color="#dc2626"
                      style={{ flexShrink: 0 }}
                    />
                  )}
                </label>
              );
            })}
          </div>

          {/* Numeric fields */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {(
              [
                {
                  key: "electricityUnits" as const,
                  labelKey: "electricityUnits" as TKeys,
                },
                {
                  key: "waterMetersCount" as const,
                  labelKey: "waterMetersCount" as TKeys,
                },
                {
                  key: "electricityMetersCount" as const,
                  labelKey: "electricityMetersCount" as TKeys,
                },
              ] as { key: keyof AvailableServices; labelKey: TKeys }[]
            ).map(({ key, labelKey }) => (
              <div
                key={key}
                style={{
                  padding: "11px 14px",
                  border: `1px solid ${DS.border}`,
                  borderRadius: DS.radius.md,
                  background: DS.surfaceAlt,
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: DS.textMuted,
                    fontWeight: 700,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                  }}
                >
                  {t[labelKey] as string}
                </label>
                <input
                  type="number"
                  dir="ltr"
                  value={
                    svc[key] !== null && svc[key] !== undefined
                      ? String(svc[key])
                      : ""
                  }
                  onChange={(e) =>
                    setAvailableService(
                      key,
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  placeholder="—"
                  style={{ ...inputStyle, background: DS.surface }}
                />
              </div>
            ))}
          </div>

          {/* Surrounding Environment */}
          <div>
            <div
              style={{
                fontSize: 11,
                color: DS.textMuted,
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              {lang === "ar" ? "البيئة المحيطة" : "Surrounding Environment"}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 8,
              }}
            >
              {(
                [
                  { key: "mosque", labelAr: "مسجد", labelEn: "Mosque" },
                  {
                    key: "commercialMarket",
                    labelAr: "سوق تجاري",
                    labelEn: "Commercial Market",
                  },
                  { key: "park", labelAr: "حديقة", labelEn: "Park" },
                  {
                    key: "governmentFacility",
                    labelAr: "مرفق حكومي",
                    labelEn: "Government Facility",
                  },
                  {
                    key: "highSpeedRoad",
                    labelAr: "طريق سريع",
                    labelEn: "High-Speed Road",
                  },
                  {
                    key: "otherServices",
                    labelAr: "خدمات أخرى",
                    labelEn: "Other Services",
                  },
                  {
                    key: "educationalFacility",
                    labelAr: "مرفق تعليمي",
                    labelEn: "Educational Facility",
                  },
                  {
                    key: "securityFacility",
                    labelAr: "مرفق أمني",
                    labelEn: "Security Facility",
                  },
                  {
                    key: "medicalFacility",
                    labelAr: "مرفق طبي",
                    labelEn: "Medical Facility",
                  },
                ] as { key: string; labelAr: string; labelEn: string }[]
              ).map(({ key, labelAr, labelEn }) => {
                const checked = (
                  ev.services.surroundingEnvironment ?? []
                ).includes(key);
                return (
                  <label
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 13px",
                      border: `1.5px solid ${checked ? DS.primary + "60" : DS.border}`,
                      borderRadius: DS.radius.md,
                      background: checked ? DS.primaryLight : DS.surfaceAlt,
                      cursor: "pointer",
                      userSelect: "none" as const,
                      transition: "all 0.15s",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `2px solid ${checked ? DS.primary : DS.borderStrong}`,
                        background: checked ? DS.primary : "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.15s",
                      }}
                    >
                      {checked && (
                        <Check size={11} color="#fff" strokeWidth={3} />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setSurroundingEnv(key, e.target.checked)}
                      style={{ display: "none" }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: checked ? 600 : 500,
                        color: checked ? DS.primary : DS.text,
                        lineHeight: 1.3,
                      }}
                    >
                      {lang === "ar" ? labelAr : labelEn}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Map Location ────────────────────────────────────────────────────── */}
      <SectionCard title={t.secMap} icon={<MapPin size={14} />}>
        {/* Map picker button */}
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setShowMapPicker(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 16px",
              background: `${DS.primary}12`,
              border: `1.5px solid ${DS.primary}35`,
              borderRadius: DS.radius.md,
              color: DS.primary,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            <Map size={15} />
            {t.pickFromMap}
          </button>

          {ev.map.coords && (
            <span
              style={{
                marginInlineStart: 10,
                fontSize: 12,
                color: DS.textMuted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              📍 {ev.map.coords}
            </span>
          )}
        </div>

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

        {/* Map Picker Modal */}
        {showMapPicker && (
          <MapPickerComponent
            value={ev.map.coords}
            onChange={(coords) => {
              // Parse "lat,lng" back into individual fields
              const [latStr, lngStr] = coords.split(",").map((s) => s.trim());
              setField("map", "coords", coords);
              if (latStr) setField("map", "lat", latStr);
              if (lngStr) setField("map", "lng", lngStr);
              setShowMapPicker(false);
            }}
            onClose={() => setShowMapPicker(false)}
            lang={lang}
          />
        )}
      </SectionCard>

      {/* ── Comparison ──────────────────────────────────────────────────────── */}
      <SectionCard
        title={t.secComparison}
        accentColor="#0e7490"
        icon={<Map size={14} />}
      >
        <SettlementComparison
          useLabel={
            USE_LABELS[lang][ev.location.assetCategoryId] ??
            (lang === "ar" ? "عام" : "General")
          }
          subjectArea={ev.assetInfo.propertyArea}
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

      {/* ── Replacement Cost ─────────────────────────────────────────────────── */}
      <SectionCard
        title={t.secReplacement}
        accentColor="#0e7490"
        icon={<Wrench size={14} />}
      >
        <ReplacementCostSection
          lang={lang}
          lines={ev.replacementLines}
          onLinesChange={(lines) =>
            setEv((p) => ({ ...p, replacementLines: lines }))
          }
          fields={ev.replacementFields as ReplacementFields}
          onFieldsChange={(fields) =>
            setEv((p) => ({ ...p, replacementFields: fields }))
          }
        />
      </SectionCard>

      {/* ── Valuation Methods ────────────────────────────────────────────────────── */}
      <SectionCard title={t.secMethods} icon={<BarChart2 size={14} />}>
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 16,
            flexWrap: "wrap",
            borderBottom: `1px solid ${DS.border}`,
            paddingBottom: 12,
          }}
        >
          {VM_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveVmTab(tab.id)}
              style={{
                padding: "6px 14px",
                border:
                  activeVmTab === tab.id
                    ? `1.5px solid ${DS.primary}`
                    : `1px solid ${DS.border}`,
                borderRadius: DS.radius.md,
                background: activeVmTab === tab.id ? DS.primary : DS.surface,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                color: activeVmTab === tab.id ? "#fff" : DS.textMuted,
                fontWeight: activeVmTab === tab.id ? 700 : 500,
                boxShadow:
                  activeVmTab === tab.id ? `0 2px 8px ${DS.primary}35` : "none",
                transition: "all 0.15s",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "currentColor",
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: المقارنة ── */}
        {activeVmTab === "vm-m" && (
          <div>
            {/* Data table */}
            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {t.vmMarket}:
            </h4>
            <div
              style={{
                overflowX: "auto",
                borderRadius: DS.radius.md,
                border: `1px solid ${DS.border}`,
                marginBottom: 20,
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: DS.surfaceAlt }}>
                    {[
                      "#",
                      t.landUse,
                      t.marketMeterPrice,
                      t.marketWeightPct,
                      t.marketMeterPrice,
                      t.total,
                      lang === "ar" ? "عرض بالتقرير" : "Show in Report",
                    ].map((h, i) => (
                      <th key={i} style={thS}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ev.comparisonRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          ...tdS,
                          textAlign: "center",
                          color: DS.textLight,
                          padding: 20,
                        }}
                      >
                        {lang === "ar" ? "لا توجد بيانات" : "No data"}
                      </td>
                    </tr>
                  ) : (
                    /* Group by usage type and compute weighted meter prices */
                    (() => {
                      type GroupAcc = {
                        count: number;
                        totalPrice: number;
                        totalArea: number;
                      };
                      const groups: Record<string, GroupAcc> = {};
                      ev.comparisonRows.forEach((row: any) => {
                        const key =
                          row.propertyTypeId ||
                          (lang === "ar" ? "عام" : "General");
                        if (!groups[key])
                          groups[key] = {
                            count: 0,
                            totalPrice: 0,
                            totalArea: 0,
                          };
                        const price = parseFloat(row.price) || 0;
                        const area = parseFloat(row.landSpace) || 0;
                        if (price > 0) {
                          groups[key].count += 1;
                          groups[key].totalPrice += price;
                          groups[key].totalArea += area;
                        }
                      });
                      return Object.entries(groups).map(([key, g], idx) => {
                        const avgMeter =
                          g.count > 0 ? g.totalPrice / g.count : 0;
                        const weightPct = 100;
                        const weightedMeter = avgMeter * (weightPct / 100);
                        const propertyArea =
                          parseFloat(ev.assetInfo.propertyArea) || 0;
                        const total = weightedMeter * propertyArea;
                        return (
                          <tr key={key}>
                            <td style={tdS}>{idx + 1}</td>
                            <td style={tdS}>{key}</td>
                            <td
                              style={{
                                ...tdS,
                                fontWeight: 600,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {avgMeter.toFixed(2)}
                            </td>
                            <td style={tdS}>{weightPct}</td>
                            <td style={{ ...tdS, fontWeight: 600 }}>
                              {weightedMeter.toFixed(2)}
                            </td>
                            <td style={{ ...tdS, fontWeight: 600 }}>
                              {total > 0
                                ? total.toLocaleString(
                                    lang === "ar" ? "ar-SA" : "en-US",
                                    { maximumFractionDigits: 2 },
                                  )
                                : "—"}
                            </td>
                            <td style={tdS}>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <label
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 11,
                                    color: DS.textMuted,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    style={{ accentColor: DS.primary }}
                                  />
                                  {lang === "ar" ? "المقارنات" : "Comparisons"}
                                </label>
                                <span
                                  style={{
                                    color: DS.borderStrong,
                                    fontSize: 11,
                                  }}
                                >
                                  |
                                </span>
                                <label
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 11,
                                    color: DS.textMuted,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    style={{ accentColor: DS.primary }}
                                  />
                                  {lang === "ar" ? "التسويات" : "Settlements"}
                                </label>
                                <span
                                  style={{
                                    color: DS.borderStrong,
                                    fontSize: 11,
                                  }}
                                >
                                  |
                                </span>
                                <label
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 11,
                                    color: DS.textMuted,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    style={{ accentColor: DS.primary }}
                                  />
                                  {lang === "ar" ? "وحدات" : "Units"}
                                </label>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculator */}
            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {lang === "ar" ? "الحاسبة:" : "Calculator:"}
            </h4>

            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: DS.textMuted,
                  cursor: "pointer",
                  padding: "9px 13px",
                  border: `1px solid ${DS.border}`,
                  borderRadius: DS.radius.md,
                  background: DS.surfaceAlt,
                  width: "fit-content",
                }}
              >
                <input type="checkbox" style={{ accentColor: DS.primary }} />
                {lang === "ar" ? "مساحة المسطحات" : "Built-up Area"}
                <span
                  title={
                    lang === "ar"
                      ? "يركز على المساحة المبنية بدلاً من مساحة الأرض"
                      : "Focus on built-up area instead of land area"
                  }
                >
                  <Info size={12} style={{ color: DS.textLight }} />
                </span>
              </label>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  fontSize: 11,
                  color: DS.textMuted,
                  fontWeight: 700,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.06em",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                {lang === "ar" ? "طريقة الحساب:" : "Calculation Method:"}
              </label>
              <select style={{ ...inputStyle, width: "auto", minWidth: 200 }}>
                <option value="meter">
                  {lang === "ar" ? "سعر المتر" : "Meter Price"}
                </option>
                <option value="unit">
                  {lang === "ar"
                    ? "الإجمالي (التسويات)"
                    : "Total (Settlements)"}
                </option>
              </select>
            </div>

            <GridFields tight>
              <Field label={t.marketMeterPrice}>
                <Input
                  value={ev.methodsMarket.marketMeterPrice}
                  onChange={(e) =>
                    setField(
                      "methodsMarket",
                      "marketMeterPrice",
                      e.target.value,
                    )
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
                  readOnly
                  value={
                    ev.methodsMarket.marketMeterPrice &&
                    ev.methodsMarket.propertyAreaMethod
                      ? (
                          (parseFloat(ev.methodsMarket.marketMeterPrice) || 0) *
                          (parseFloat(ev.methodsMarket.propertyAreaMethod) || 0)
                        ).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
                          maximumFractionDigits: 2,
                        })
                      : ev.methodsMarket.marketMethodTotal
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
          </div>
        )}

        {/* ── Tab: تكلفة الإحلال ── */}
        {activeVmTab === "vm-c" && (
          <div>
            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {t.vmCost}:
            </h4>
            <div
              style={{
                overflowX: "auto",
                borderRadius: DS.radius.md,
                border: `1px solid ${DS.border}`,
                marginBottom: 20,
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: DS.surfaceAlt }}>
                    {[
                      lang === "ar" ? "الاسم" : "Name",
                      lang === "ar" ? "قيمة المبنى" : "Building Value",
                      lang === "ar" ? "عرض بالتقرير" : "Show in Report",
                    ].map((h, i) => (
                      <th key={i} style={thS}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ev.replacementLines.filter((l: any) => l.title || l.total)
                    .length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          ...tdS,
                          textAlign: "center",
                          color: DS.textLight,
                          padding: 20,
                        }}
                      >
                        {lang === "ar" ? "لا توجد بيانات" : "No data"}
                      </td>
                    </tr>
                  ) : (
                    ev.replacementLines
                      .filter((l: any) => l.title || l.total)
                      .map((line: any, idx: number) => (
                        <tr key={idx}>
                          <td style={tdS}>
                            {line.title ||
                              `${lang === "ar" ? "بند" : "Line"} ${idx + 1}`}
                          </td>
                          <td
                            style={{
                              ...tdS,
                              fontWeight: 600,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {line.total
                              ? parseFloat(line.total).toLocaleString(
                                  lang === "ar" ? "ar-SA" : "en-US",
                                  { maximumFractionDigits: 2 },
                                )
                              : line.space && line.unitPrice
                                ? (
                                    (parseFloat(line.space) || 0) *
                                    (parseFloat(line.unitPrice) || 0)
                                  ).toLocaleString(
                                    lang === "ar" ? "ar-SA" : "en-US",
                                    { maximumFractionDigits: 2 },
                                  )
                                : "—"}
                          </td>
                          <td style={tdS}>
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                alignItems: "center",
                                justifyContent: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              <label
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  color: DS.textMuted,
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  style={{ accentColor: DS.primary }}
                                />
                                {lang === "ar" ? "المسطحات" : "Areas"}
                              </label>
                              <span
                                style={{ color: DS.borderStrong, fontSize: 11 }}
                              >
                                |
                              </span>
                              <label
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  color: DS.textMuted,
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  style={{ accentColor: DS.primary }}
                                />
                                {lang === "ar" ? "الإحلال" : "Replacement"}
                              </label>
                              <span
                                style={{ color: DS.borderStrong, fontSize: 11 }}
                              >
                                |
                              </span>
                              <label
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  color: DS.textMuted,
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  style={{ accentColor: DS.primary }}
                                />
                                {lang === "ar" ? "أعداد" : "Count"}
                              </label>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {lang === "ar" ? "الحاسبة:" : "Calculator:"}
            </h4>
            <GridFields tight>
              <Field label={t.costNetBuildings}>
                <Input readOnly value={ev.methodsCost.costNetBuildings} />
              </Field>
              <Field label={t.costNetLandPrice}>
                <Input readOnly value={ev.methodsCost.costNetLandPrice} />
              </Field>
              <Field label={t.costLandBuildTotal}>
                <Input readOnly value={ev.methodsCost.costLandBuildTotal} />
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
          </div>
        )}

        {/* ── Tab: الاستثمار ── */}
        {activeVmTab === "vm-i" && (
          <div>
            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {t.vmIncome}:
            </h4>
            <div
              style={{
                overflowX: "auto",
                borderRadius: DS.radius.md,
                border: `1px solid ${DS.border}`,
                marginBottom: 20,
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: DS.surfaceAlt }}>
                    {[
                      lang === "ar" ? "الاسم" : "Name",
                      lang === "ar" ? "اجمالي الدخل" : "Total Income",
                      lang === "ar" ? "عرض بالتقرير" : "Show in Report",
                    ].map((h, i) => (
                      <th key={i} style={thS}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ev.methodsIncome.incomeTotal ? (
                    <tr>
                      <td style={tdS}>
                        {lang === "ar"
                          ? "رسملة المبنى الرئيسي"
                          : "Main Building Capitalization"}
                      </td>
                      <td
                        style={{
                          ...tdS,
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {parseFloat(
                          ev.methodsIncome.incomeTotal,
                        ).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
                          maximumFractionDigits: 3,
                        })}
                      </td>
                      <td style={tdS}>
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11,
                            color: DS.textMuted,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            style={{ accentColor: DS.primary }}
                          />
                          {lang === "ar" ? "عرض" : "Show"}
                        </label>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          ...tdS,
                          textAlign: "center",
                          color: DS.textLight,
                          padding: 20,
                        }}
                      >
                        {lang === "ar" ? "لا توجد بيانات" : "No data"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {lang === "ar" ? "الحاسبة:" : "Calculator:"}
            </h4>
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
          </div>
        )}

        {/* ── Tab: القيمة المتبقية ── */}
        {activeVmTab === "vm-r" && (
          <div>
            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {t.vmResidual}:
            </h4>
            <div
              style={{
                overflowX: "auto",
                borderRadius: DS.radius.md,
                border: `1px solid ${DS.border}`,
                marginBottom: 20,
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: DS.surfaceAlt }}>
                    {[
                      lang === "ar" ? "الاسم" : "Name",
                      lang === "ar"
                        ? "اجمالي قيمة العقار"
                        : "Total Property Value",
                      lang === "ar" ? "عرض بالتقرير" : "Show in Report",
                    ].map((h, i) => (
                      <th key={i} style={thS}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        ...tdS,
                        textAlign: "center",
                        color: DS.textLight,
                        padding: 20,
                      }}
                    >
                      {lang === "ar" ? "لا توجد بيانات" : "No data"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {lang === "ar" ? "الحاسبة:" : "Calculator:"}
            </h4>
            <GridFields tight>
              <Field
                label={
                  lang === "ar" ? "إجمالي قيمة الأصل" : "Total Asset Value"
                }
              >
                <Input readOnly value="" />
              </Field>
              <Field label={t.usageReason} full>
                <Textarea
                  rows={4}
                  placeholder={
                    lang === "ar"
                      ? "أدخل سبب الاستخدام..."
                      : "Enter reason for use..."
                  }
                />
              </Field>
            </GridFields>
          </div>
        )}

        {/* ── Tab: DCF ── */}
        {activeVmTab === "vm-d" && (
          <div>
            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {t.vmDcf}:
            </h4>
            <div
              style={{
                overflowX: "auto",
                borderRadius: DS.radius.md,
                border: `1px solid ${DS.border}`,
                marginBottom: 20,
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: DS.surfaceAlt }}>
                    {[
                      lang === "ar" ? "الاسم" : "Name",
                      lang === "ar" ? "اجمالي الدخل" : "Total Income",
                      lang === "ar" ? "عرض بالتقرير" : "Show in Report",
                    ].map((h, i) => (
                      <th key={i} style={thS}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        ...tdS,
                        textAlign: "center",
                        color: DS.textLight,
                        padding: 20,
                      }}
                    >
                      {lang === "ar" ? "لا توجد بيانات" : "No data"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {lang === "ar" ? "الحاسبة:" : "Calculator:"}
            </h4>
            <GridFields tight>
              <Field label={t.incomeTotal}>
                <Input readOnly value="" />
              </Field>
              <Field label={t.usageReason} full>
                <Textarea
                  rows={4}
                  placeholder={
                    lang === "ar"
                      ? "أدخل سبب الاستخدام..."
                      : "Enter reason for use..."
                  }
                />
              </Field>
            </GridFields>
          </div>
        )}

        {/* ── Tab: القيمة الإيجارية ── */}
        {activeVmTab === "vm-e" && (
          <div>
            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {t.vmRental}:
            </h4>
            <div
              style={{
                overflowX: "auto",
                borderRadius: DS.radius.md,
                border: `1px solid ${DS.border}`,
                marginBottom: 20,
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: DS.surfaceAlt }}>
                    {[
                      lang === "ar" ? "الاسم" : "Name",
                      lang === "ar" ? "بداية المدة" : "Start Date",
                      lang === "ar" ? "نهاية المدة" : "End Date",
                      lang === "ar" ? "الفترة المحددة" : "Period",
                      lang === "ar" ? "تقدير اجرة المثل" : "Rent Estimate",
                      lang === "ar" ? "عرض بالتقرير" : "Show in Report",
                    ].map((h, i) => (
                      <th key={i} style={thS}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        ...tdS,
                        textAlign: "center",
                        color: DS.textLight,
                        padding: 20,
                      }}
                    >
                      {lang === "ar"
                        ? "لا توجد بيانات إيجارية"
                        : "No rental data"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h4
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DS.primary,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 14,
                  background: DS.primary,
                  borderRadius: 2,
                }}
              />
              {lang === "ar" ? "الحاسبة:" : "Calculator:"}
            </h4>
            <GridFields tight>
              <Field
                label={lang === "ar" ? "إجمالي الإيجارات" : "Total Rentals"}
              >
                <Input readOnly value="" />
              </Field>
              <Field label={t.usageReason} full>
                <Textarea
                  rows={4}
                  placeholder={
                    lang === "ar"
                      ? "أدخل سبب الاستخدام..."
                      : "Enter reason for use..."
                  }
                />
              </Field>
            </GridFields>
          </div>
        )}
      </SectionCard>

      {/* ── Appraiser Opinion ────────────────────────────────────────────────── */}
      <SectionCard title={t.secAppraiser} icon={<UserCheck size={14} />}>
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

      {/* ── Report Items ─────────────────────────────────────────────────────── */}
      <SectionCard title={t.secReport} icon={<ScrollText size={14} />}>
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

      {/* ── Authors ──────────────────────────────────────────────────────────── */}
      <SectionCard title={t.secAuthors} icon={<Users size={14} />}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                padding: "12px 14px",
                background: DS.surfaceAlt,
                border: `1px solid ${DS.border}`,
                borderRadius: DS.radius.md,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: DS.textLight,
                    fontWeight: 700,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.06em",
                    marginBottom: 4,
                  }}
                >
                  {lang === "ar"
                    ? `معد ${n} — معرف / اسم`
                    : `Author ${n} — ID / Name`}
                </label>
                <Input
                  value={(ev.authors as any)[`author${n}Id`] ?? ""}
                  onChange={(e) =>
                    setField("authors", `author${n}Id`, e.target.value)
                  }
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: DS.textLight,
                    fontWeight: 700,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.06em",
                    marginBottom: 4,
                  }}
                >
                  {lang === "ar" ? `معد ${n} — المنصب` : `Author ${n} — Title`}
                </label>
                <Input
                  value={(ev.authors as any)[`author${n}Title`] ?? ""}
                  onChange={(e) =>
                    setField("authors", `author${n}Title`, e.target.value)
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Floating Save FAB ────────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 28,
          [isRtl ? "left" : "right"]: 28,
          zIndex: 400,
          display: "flex",
          flexDirection: "column",
          alignItems: isRtl ? "flex-start" : "flex-end",
          gap: 10,
        }}
      >
        {statusMsg.text && (
          <div
            style={{
              padding: "9px 16px",
              borderRadius: DS.radius.lg,
              fontSize: 12,
              fontWeight: 600,
              boxShadow: DS.shadow.lg,
              background:
                statusMsg.type === "ok"
                  ? DS.green
                  : statusMsg.type === "error"
                    ? DS.red
                    : DS.primary,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 7,
              whiteSpace: "nowrap" as const,
            }}
          >
            {statusMsg.type === "ok" ? (
              <CheckCircle2 size={14} />
            ) : statusMsg.type === "error" ? (
              <XCircle size={14} />
            ) : (
              <Loader2 size={14} />
            )}
            {statusMsg.text}
          </div>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          title={t.save}
          style={{
            width: 54,
            height: 54,
            borderRadius: "50%",
            background: saving ? DS.textMuted : DS.primary,
            color: "#fff",
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 20px ${DS.primary}55`,
            transition: "all 0.2s",
          }}
        >
          {saving ? (
            <Loader2
              size={22}
              style={{ animation: "spin 1s linear infinite" }}
            />
          ) : (
            <Save size={22} />
          )}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
