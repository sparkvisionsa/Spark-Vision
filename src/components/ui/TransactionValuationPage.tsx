"use client";

import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { toApiUrl } from "@/lib/api-url";
import { useSidebar } from "@/components/ui/sidebar";
import { SettlementRow } from "./SettlementComparison";
import { SettlementComparison } from "./SettlementComparison";
import {
  AppraiserOpinionSection,
  emptyAppraiserData,
} from "./AppraiserOpinionSection";
import { DEFAULT_SECTION1_TITLES } from "./SettlementComparison";
import { LanguageContext } from "@/components/layout-provider";
import {
  ReplacementCostSection,
  type ReplacementFields,
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
  Copy,
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

type CompanySignatoryOption = {
  id: string;
  name: string;
  jobTitle: string;
  membershipNo?: string;
  source: "user" | "reportOnly";
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
    authorizedLandCoverPct: "نسبة تغطية الأرض المصرح بها %",
    streetWidth: "عرض الشارع",
    streetFronts: "عدد واجهات الشارع",
    streetFronts0: "لا يوجد شارع",
    streetFronts1: "شارع واحد",
    streetFronts2: "شارعين",
    streetFronts3: "3 شوارع",
    streetFronts4: "4 شوارع",
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
    authorizedLandCoverPct: "Land Cover Percentage %",
    streetWidth: "Street Width",
    streetFronts: "Street Fronts",
    streetFronts0: "No Street",
    streetFronts1: "1 Street",
    streetFronts2: "2 Streets",
    streetFronts3: "3 Streets",
    streetFronts4: "4 Streets",
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

type AssetCategory = "land" | "building" | "both";

type PropertyTypeOption = {
  value: string;
  label: { ar: string; en: string };
  category: AssetCategory;
};

// Full list of property types. IDs already in use in existing evalData
// (1,2,3,4,5,6,7,9,10,21,22,24,28,67) are preserved exactly so old records
// keep resolving to the same option. New types get ids in the 100+ range.
const PROPERTY_TYPES: PropertyTypeOption[] = [
  { value: "1",   label: { ar: "أرض", en: "Land" }, category: "land" },
  { value: "2",   label: { ar: "شقة", en: "Apartment" }, category: "building" },
  { value: "3",   label: { ar: "فيلا سكنية", en: "Residential Villa" }, category: "building" },
  { value: "4",   label: { ar: "عمارة", en: "Building" }, category: "building" },
  { value: "5",   label: { ar: "إستراحة", en: "Rest House" }, category: "building" },
  { value: "6",   label: { ar: "مزرعة", en: "Farm" }, category: "both" },
  { value: "7",   label: { ar: "مستودع", en: "Warehouse" }, category: "building" },
  { value: "108", label: { ar: "محطة", en: "Station" }, category: "building" },
  { value: "9",   label: { ar: "محل تجاري", en: "Shop" }, category: "building" },
  { value: "10",  label: { ar: "دور", en: "Floor" }, category: "building" },
  { value: "111", label: { ar: "ورشة", en: "Workshop" }, category: "building" },
  { value: "112", label: { ar: "ارض مسورة", en: "Walled Land" }, category: "land" },
  { value: "113", label: { ar: "مدرسة", en: "School" }, category: "building" },
  { value: "114", label: { ar: "قصر", en: "Palace" }, category: "building" },
  { value: "115", label: { ar: "مصنع ومبنى", en: "Factory & Building" }, category: "building" },
  { value: "116", label: { ar: "الأكشاك والخدمات الذاتية", en: "Kiosks & Self Services" }, category: "building" },
  { value: "117", label: { ar: "المعارض والمساحات المكتبية والمستودعات", en: "Showrooms, Offices & Warehouses" }, category: "building" },
  { value: "118", label: { ar: "مباني", en: "Buildings" }, category: "building" },
  { value: "119", label: { ar: "أرض مقام عليها مباني", en: "Land with Buildings" }, category: "both" },
  { value: "120", label: { ar: "أرض زراعية", en: "Agricultural Land" }, category: "land" },
  { value: "21",  label: { ar: "أرض سكنية", en: "Residential Land" }, category: "land" },
  { value: "22",  label: { ar: "أرض تجارية", en: "Commercial Land" }, category: "land" },
  { value: "123", label: { ar: "أرض سكنية تجارية", en: "Residential-Commercial Land" }, category: "land" },
  { value: "24",  label: { ar: "فندق", en: "Hotel" }, category: "building" },
  { value: "125", label: { ar: "مبنى", en: "Building" }, category: "building" },
  { value: "126", label: { ar: "محطة وقود", en: "Gas Station" }, category: "building" },
  { value: "127", label: { ar: "ارض", en: "Land" }, category: "land" },
  { value: "28",  label: { ar: "مبنى تجاري", en: "Commercial Building" }, category: "building" },
  { value: "129", label: { ar: "مبنى إداري تجاري", en: "Admin-Commercial Building" }, category: "building" },
  { value: "130", label: { ar: "أرض خام", en: "Raw Land" }, category: "land" },
  { value: "131", label: { ar: "مجمع سكني", en: "Residential Complex" }, category: "building" },
  { value: "132", label: { ar: "أرض متعددة الإستخدام", en: "Multi-Use Land" }, category: "land" },
  { value: "133", label: { ar: "برج", en: "Tower" }, category: "building" },
  { value: "134", label: { ar: "برج جوال", en: "Mobile Tower" }, category: "building" },
  { value: "135", label: { ar: "مكاتب", en: "Offices" }, category: "building" },
  { value: "136", label: { ar: "مكتبي", en: "Office" }, category: "building" },
  { value: "137", label: { ar: "ترفيهي", en: "Recreational" }, category: "building" },
  { value: "138", label: { ar: "نادي رياضي", en: "Sports Club" }, category: "building" },
  { value: "139", label: { ar: "فيلا دوبلكس", en: "Duplex Villa" }, category: "building" },
  { value: "140", label: { ar: "حوش مسور", en: "Walled Yard" }, category: "land" },
  { value: "141", label: { ar: "مستودع + عمائر", en: "Warehouse + Buildings" }, category: "building" },
  { value: "142", label: { ar: "حوش", en: "Yard" }, category: "land" },
  { value: "143", label: { ar: "أرض(سكني مكتبي)", en: "Land (Residential/Office)" }, category: "land" },
  { value: "144", label: { ar: "أرض استخدام مستودعات", en: "Land - Warehouse Use" }, category: "land" },
  { value: "145", label: { ar: "عمارة سكنية تجارية", en: "Residential-Commercial Building" }, category: "building" },
  { value: "146", label: { ar: "مبني سكني دور ارضي وملحق علوي", en: "Residential Building - Ground Floor + Upper Annex" }, category: "building" },
  { value: "147", label: { ar: "مزرعة قائمة", en: "Existing Farm" }, category: "both" },
  { value: "148", label: { ar: "عمائر تحت الإنشاء", en: "Buildings Under Construction" }, category: "building" },
  { value: "149", label: { ar: "عمارة تجارية مكتبية", en: "Commercial-Office Building" }, category: "building" },
  { value: "150", label: { ar: "مرفق - حديقة", en: "Facility - Garden" }, category: "building" },
  { value: "151", label: { ar: "مجمع سكني تجاري", en: "Residential-Commercial Complex" }, category: "building" },
  { value: "152", label: { ar: "محلات وفيلا", en: "Shops & Villa" }, category: "building" },
  { value: "153", label: { ar: "مجمع تجاري", en: "Commercial Complex" }, category: "building" },
  { value: "154", label: { ar: "فلل سكنية", en: "Residential Villas" }, category: "building" },
  { value: "155", label: { ar: "ارض بها محلات تجارية", en: "Land with Commercial Shops" }, category: "land" },
  { value: "156", label: { ar: "محطة وقود وعمارتين سكنية", en: "Gas Station + Two Residential Buildings" }, category: "building" },
  { value: "157", label: { ar: "معرض سيارات", en: "Car Showroom" }, category: "building" },
  { value: "158", label: { ar: "فيلا", en: "Villa" }, category: "building" },
  { value: "159", label: { ar: "عمائر سكنية تجارية وفلل سكنية", en: "Residential-Commercial Buildings & Villas" }, category: "building" },
  { value: "160", label: { ar: "برج تجاري مكتبي طبي", en: "Commercial-Office-Medical Tower" }, category: "building" },
  { value: "161", label: { ar: "معرض تجاري", en: "Commercial Showroom" }, category: "building" },
  { value: "162", label: { ar: "معارض", en: "Showrooms" }, category: "building" },
  { value: "163", label: { ar: "مرفق", en: "Facility" }, category: "building" },
  { value: "164", label: { ar: "عمارتين سكنية تجارية", en: "Two Residential-Commercial Buildings" }, category: "building" },
  { value: "165", label: { ar: "فلل سكنية وارض", en: "Residential Villas & Land" }, category: "both" },
  { value: "166", label: { ar: "عمارتين سكنية", en: "Two Residential Buildings" }, category: "building" },
  { value: "67",  label: { ar: "عمارة سكنية", en: "Residential Building" }, category: "building" },
  { value: "168", label: { ar: "ارض عليها اعمدة الدور الارضي", en: "Land with Ground Floor Columns" }, category: "land" },
  { value: "169", label: { ar: "مستودعات", en: "Warehouses" }, category: "building" },
  { value: "170", label: { ar: "مبنى اداري ومصانع", en: "Admin Building & Factories" }, category: "building" },
  { value: "171", label: { ar: "أرض ومباني", en: "Land & Buildings" }, category: "both" },
  { value: "172", label: { ar: "شقق سكنية", en: "Residential Apartments" }, category: "building" },
  { value: "173", label: { ar: "عمائر", en: "Buildings" }, category: "building" },
  { value: "174", label: { ar: "برج اتصالات", en: "Communications Tower" }, category: "building" },
  { value: "175", label: { ar: "شقة دورين", en: "Two-Floor Apartment" }, category: "building" },
  { value: "176", label: { ar: "ارض سكني", en: "Residential Land" }, category: "land" },
  { value: "177", label: { ar: "ارض لغرفة كهرباء", en: "Land for Electricity Room" }, category: "land" },
  { value: "178", label: { ar: "عمارة ومستودع", en: "Building & Warehouse" }, category: "building" },
  { value: "179", label: { ar: "مكونات مباني", en: "Building Components" }, category: "building" },
  { value: "180", label: { ar: "معرض رقم G-17", en: "Showroom No. G-17" }, category: "building" },
  { value: "181", label: { ar: "كشك", en: "Kiosk" }, category: "building" },
  { value: "182", label: { ar: "مبنى مواقف", en: "Parking Building" }, category: "building" },
  { value: "183", label: { ar: "بيت شعبي", en: "Popular House" }, category: "building" },
  { value: "184", label: { ar: "مربط خيول", en: "Horse Stable" }, category: "building" },
  { value: "185", label: { ar: "مكتب", en: "Office" }, category: "building" },
  { value: "186", label: { ar: "عمارة سكنية تجارية (فندق)+عمارة سكنية", en: "Residential-Commercial Building (Hotel) + Residential Building" }, category: "building" },
];

// Legacy shape used elsewhere in the file (kept for anything already
// referencing PROPERTY_TYPES_OPTIONS[lang]).
const PROPERTY_TYPES_OPTIONS: Record<Lang, { value: string; label: string }[]> =
  {
    ar: PROPERTY_TYPES.map((o) => ({ value: o.value, label: o.label.ar })),
    en: PROPERTY_TYPES.map((o) => ({ value: o.value, label: o.label.en })),
  };

// assetCategoryId: "1" = land, "2" = buildings. Falls back to the full
// list when no category has been chosen yet, or when a type doesn't
// belong exclusively to the opposite category ("both" always shows).
function getPropertyTypesForCategory(
  assetCategoryId: string | undefined,
  lang: Lang,
): { value: string; label: string }[] {
  const wanted =
    assetCategoryId === "1" ? "land" : assetCategoryId === "2" ? "building" : null;
  const filtered = wanted
    ? PROPERTY_TYPES.filter((o) => o.category === wanted || o.category === "both")
    : PROPERTY_TYPES;
  return filtered.map((o) => ({ value: o.value, label: o.label[lang] }));
}

function getPropertyTypeLabel(id: string | undefined, lang: Lang): string {
  if (!id) return "";
  const found = PROPERTY_TYPES.find((o) => o.value === id);
  return found ? found.label[lang] : id;
}
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
  accent,
}: {
  label: string;
  value?: string;
  full?: boolean;
  accent?: string;
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
          fontWeight: value ? 600 : 400,
          lineHeight: 1.5,
          padding: "7px 10px 7px 12px",
          background: DS.surfaceAlt,
          borderRadius: DS.radius.md,
          borderInlineStart: `3px solid ${value ? (accent ?? DS.primary) : DS.border}`,
          border: `1px solid ${DS.border}`,
          borderInlineStartWidth: 3,
          borderInlineStartColor: value ? (accent ?? DS.primary) : DS.border,
          minHeight: 34,
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function WizardShell({
  steps,
  activeStep,
  onStepChange,
  lang,
  children,
  lastStepActions,
}: {
  steps: { key: string; label: string; icon: React.ReactNode; completion?: { requiredTotal: number; requiredFilled: number; isComplete: boolean } }[];
  activeStep: number;
  onStepChange: (i: number) => void;
  lang: "ar" | "en";
  children: React.ReactNode;
  lastStepActions?: {
    onOverview: () => void;
    onViewReport: () => void;
  };
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {/* Left rail */}
      <div
        style={{
          width: 230,
          flexShrink: 0,
          background: DS.surface,
          border: `1px solid ${DS.border}`,
          borderRadius: DS.radius.xl,
          boxShadow: DS.shadow.sm,
          position: "sticky",
          top: 12,
          alignSelf: "flex-start",          // ensures sticky works reliably in the flex row
          maxHeight: "calc(100vh - 24px)",  // cap instead of forcing exact height
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",               // outer card clips corners
        }}
      >
         <div style={{ padding: "10px", overflowY: "auto", flex: 1 }}>
        {steps.map((s, i) => {
          const active = i === activeStep;
          const visited = i < activeStep;
          const done = s.completion ? s.completion.isComplete : visited;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onStepChange(i)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "9px 10px",
                marginBottom: 2,
                border: "none",
                borderRadius: DS.radius.md,
                background: active ? DS.primaryLight : "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "inherit" as const,
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: active ? DS.primaryMid : DS.surfaceAlt,
                  color: active ? DS.primary : DS.textMuted,
                }}
              >
                {s.icon}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: active ? DS.primary : DS.text,
                  fontWeight: active ? 700 : 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {s.label}
              </span>
              {s.completion && !s.completion.isComplete && (
                <span
                  style={{
                    marginInlineStart: "auto",
                    fontSize: 10,
                    fontWeight: 700,
                    color: DS.textMuted,
                    flexShrink: 0,
                  }}
                >
                  {s.completion.requiredFilled}/{s.completion.requiredTotal}
                </span>
              )}
            </button>
          );
        })}
      </div>
      </div>

      {/* Right pane */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {children}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                  padding: "12px 4px",
                }}
              >
                <button
                  type="button"
                  disabled={activeStep === 0}
                  onClick={() => onStepChange(Math.max(0, activeStep - 1))}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 16px",
                    border: `1px solid ${DS.border}`,
                    borderRadius: DS.radius.md,
                    background: DS.surface,
                    color: DS.textMuted,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: activeStep === 0 ? "default" : "pointer",
                    opacity: activeStep === 0 ? 0.4 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  {lang === "ar" ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
                  {lang === "ar" ? "السابق" : "Previous"}
                </button>

                {activeStep === steps.length - 1 && lastStepActions ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={lastStepActions.onOverview}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "9px 16px",
                        border: `1px solid ${DS.border}`,
                        borderRadius: DS.radius.md,
                        background: DS.surface,
                        color: DS.textMuted,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <ClipboardList size={14} />
                      {lang === "ar" ? "نظرة عامة" : "Overview"}
                    </button>
                    <button
                      type="button"
                      onClick={lastStepActions.onViewReport}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "9px 16px",
                        border: "none",
                        borderRadius: DS.radius.md,
                        background: DS.primary,
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        boxShadow: `0 2px 8px ${DS.primary}35`,
                      }}
                    >
                      <Printer size={14} />
                      {lang === "ar" ? "عرض التقرير النهائي" : "View Final Report"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={activeStep === steps.length - 1}
                    onClick={() => onStepChange(Math.min(steps.length - 1, activeStep + 1))}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "9px 16px",
                      border: "none",
                      borderRadius: DS.radius.md,
                      background: DS.primary,
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: activeStep === steps.length - 1 ? "default" : "pointer",
                      opacity: activeStep === steps.length - 1 ? 0.4 : 1,
                      fontFamily: "inherit",
                      boxShadow: `0 2px 8px ${DS.primary}35`,
                    }}
                  >
                    {steps[Math.min(steps.length - 1, activeStep + 1)]?.label}
                    {lang === "ar" ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                  </button>
                )}
              </div>
            </div>
    </div>
  );
}

function StatCard({
  label, value, icon, color = DS.primary, isRtl = false,
}: { label: string; value?: string; icon?: React.ReactNode; color?: string; isRtl?: boolean }) {

  return (
    <div
      style={{
        position: "relative",
        background: DS.surface,
        border: `1px solid ${DS.border}`,
        borderRadius: DS.radius.lg,
        padding: "14px 16px",
        boxShadow: DS.shadow.sm,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0, insetInlineEnd: 0,
          width: 70, height: 70,
          background: `radial-gradient(circle at top ${isRtl ? "left" : "right"}, ${color}22, transparent 70%)`,
          pointerEvents: "none" as const,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: DS.radius.sm,
            background: `${color}18`, color, flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: DS.textLight }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: DS.text, direction: "ltr" as const, position: "relative" as const }}>
        {value || "—"}
      </div>
    </div>
  );
}
function DashCard({
  title, icon, onEdit, lang, children,
}: { title: string; icon: React.ReactNode; onEdit: () => void; lang: "ar" | "en"; children: React.ReactNode }) {
  return (
    <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: DS.radius.lg, boxShadow: DS.shadow.sm, overflow: "hidden", display: "flex", flexDirection: "column" as const }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: DS.surfaceAlt, borderBottom: `1px solid ${DS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: DS.radius.sm, background: `${DS.primary}15`, color: DS.primary }}>
            {icon}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: DS.text }}>{title}</span>
        </div>
        <button type="button" onClick={onEdit} style={{ fontSize: 11, fontWeight: 600, color: DS.primary, background: `${DS.primary}10`, border: `1px solid ${DS.primary}30`, borderRadius: DS.radius.sm, padding: "4px 9px", cursor: "pointer", fontFamily: "inherit" }}>
          {lang === "ar" ? "تعديل" : "Edit"}
        </button>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column" as const, gap: 6, flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

function DashRow({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
      <span style={{ color: DS.textMuted }}>{label}</span>
      <span style={{ color: value ? DS.text : DS.textLight, fontWeight: value ? 600 : 400, textAlign: "right" as const }}>
        {value || "—"}
      </span>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({
  title,
  children,
  accentColor,
  icon,
  completion,
  lang,
}: {
  title: string;
  children: React.ReactNode;
  accentColor?: string;
  icon?: React.ReactNode;
  completion?: { requiredTotal: number; requiredFilled: number; isComplete: boolean };
  lang: "ar" | "en";
  defaultOpen?: boolean; // kept for prop compatibility, no longer used
}) {
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
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "13px 18px",
          background: hasAccent ? accentColor : DS.surfaceAlt,
          borderBottom: `1px solid ${DS.border}`,
          fontWeight: 600,
          fontSize: 13,
          color: hasAccent ? "#fff" : DS.text,
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
                background: hasAccent ? "rgba(255,255,255,0.18)" : `${DS.primary}15`,
                color: hasAccent ? "#fff" : DS.primary,
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
          )}
          <span>{title}</span>
          {completion && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginInlineStart: 6,
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                background: completion.isComplete
                  ? "#f0fdf4"
                  : hasAccent
                    ? "rgba(255,255,255,0.18)"
                    : DS.surfaceAlt,
                color: completion.isComplete
                  ? "#15803d"
                  : hasAccent
                    ? "#fff"
                    : DS.textMuted,
                border: completion.isComplete
                  ? "1px solid #bbf7d0"
                  : `1px solid ${hasAccent ? "rgba(255,255,255,0.3)" : DS.border}`,
              }}
            >
              {completion.isComplete ? (
                <>
                  <CheckCircle2 size={11} />
                  {lang === "ar" ? "مكتمل" : "Complete"}
                </>
              ) : (
                `${completion.requiredFilled}/${completion.requiredTotal}`
              )}
            </span>
          )}
        </div>
      </div>
      <div style={{ padding: "18px 20px" }}>{children}</div>
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
  required = false
}: {
  label: string;
  children: React.ReactNode;
    full?: boolean;
    required?: boolean
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
        {required && (
                  <span style={{ color: DS.red, marginInlineStart: 3 }}>*</span>
                )}
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

function cryptoRandomId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `author-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
      authorizedLandCoverPct: "",
      streetWidth: "",
      streetFronts: "",
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
      authorEntries: [{ id: cryptoRandomId(), signatoryId: "", title: "" }] as {
        id: string;
        signatoryId: string;
        title: string;
      }[],
    },
    comparisonRows: [emptyComparisonRow(), emptyComparisonRow()],
    appraiser: emptyAppraiserData(),
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
    investmentEntries: [] as any[],
    residualValueEntries: [] as any[],
    dcfEntries: [] as any[],
    rentalValueEntries: [] as any[],
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

  // Maps to the `ev` state shape. section = top-level key in ev, field = key within it.
  const REQUIRED_FIELDS: Record<string, { section: string; field: string }[]> = {
    secBasic: [
      { section: "basic", field: "subDivisionRecordNumber" }, // رقم محضر التجزئة
      { section: "basic", field: "buildingLicense" },          // رخصة البناء (see note above re: "حالة رخصة البناء")
      { section: "basic", field: "clientName" },                // اسم العميل
      { section: "basic", field: "authorizedName" },             // اسم المفوض بطلب التقييم
      { section: "basic", field: "ownerName" },                  // اسم المالك
      { section: "basic", field: "otherUsers" },                 // المستخدمين الأخرين
      { section: "basic", field: "deedNumber" },                 // رقم الصك
      { section: "basic", field: "deedDate" },                   // تاريخ الصك
      { section: "basic", field: "deedSource" },                 // مصدر الصك
      { section: "basic", field: "buildingLicenseDate" },        // تاريخ رخصة البناء
      { section: "basic", field: "parcelNumber" },                // رقم القطعة
      { section: "basic", field: "planNumber" },                  // رقم المخطط
      { section: "basic", field: "elevation" },                   // المنسوب
      { section: "basic", field: "inspectionBoundaries" },       // حدود المعاينة
    ],
    secBoundaries: [
      { section: "boundaries", field: "northBoundary" },
      { section: "boundaries", field: "northLength" },
      { section: "boundaries", field: "southBoundary" },
      { section: "boundaries", field: "southLength" },
      { section: "boundaries", field: "eastBoundary" },
      { section: "boundaries", field: "eastLength" },
      { section: "boundaries", field: "westBoundary" },
      { section: "boundaries", field: "westLength" },
    ],
  };

  const requiredBasicKeys = new Set(
    REQUIRED_FIELDS.secBasic.map((f) => f.field),
  );

  function useSectionCompletion(ev: ReturnType<typeof emptyEval>) {
    return React.useMemo(() => {
      const result: Record<
        string,
        { requiredTotal: number; requiredFilled: number; isComplete: boolean }
      > = {};

      for (const [sectionKey, fields] of Object.entries(REQUIRED_FIELDS)) {
        let filled = 0;
        for (const { section, field } of fields) {
          const val = (ev as any)[section]?.[field];
          if (val !== undefined && val !== null && String(val).trim() !== "") {
            filled += 1;
          }
        }
        result[sectionKey] = {
          requiredTotal: fields.length,
          requiredFilled: filled,
          isComplete: filled === fields.length,
        };
      }
      return result;
    }, [ev]);
  }

  function computeReplacementDerived(
    lines: typeof ev.replacementLines,
    fields: typeof ev.replacementFields,
  ) {
    const p = (s: string) => parseFloat(s) || 0;

    const totalArea = lines.reduce((s: number, l: any) => s + p(l.space), 0);
    const totalVal = lines.reduce(
      (s: number, l: any) => s + p(l.total || "0"),
      0,
    );

    const adminPct = p(fields.managementPct) / 100;
    const profPct = p(fields.professionalPct) / 100;
    const utilPct = p(fields.utilityNetworkPct) / 100;
    const emrgPct = p(fields.emergencyPct) / 100;
    const finPct = p(fields.financePct) / 100;
    const devProfit = p(fields.earningsRate) / 100;
    const yearDevPct = p(fields.yearDev) / 100;

    const indirectPct =
      adminPct + profPct + utilPct + emrgPct + finPct + yearDevPct;
    const indirect = totalVal * indirectPct;
    const directTotal = totalVal + indirect;
    const devProfitVal = directTotal * devProfit;
    const assetVal = directTotal + devProfitVal;

    const physPct = p(fields.depreciationPct);
    const econPct = p(fields.economicPct);
    const funcPct = p(fields.careerPct);
    const totalDep = Math.min(100, physPct + econPct + funcPct);

    const depVal = assetVal * (totalDep / 100);
    const netAsset = assetVal - depVal; // costNetBuildings
    const netMeter = totalArea > 0 ? netAsset / totalArea : 0;

    const landDataTotal = p(fields.meterPriceLand) * p(fields.landSpace); // costNetLandPrice
    const landAsset = landDataTotal + netAsset; // costLandBuildTotal

    return {
      netAsset,
      landDataTotal,
      landAsset,
      netMeter,
      totalArea,
      totalVal,
    };
  }

  // ─── helper: recompute net-meter-price from settlement data ──────────────────
  // (mirrors SettlementAdjustmentsTable's math, lifted here so vm-m can read it)
  function computeSettlementNetMeter(
    compRows: typeof ev.comparisonRows,
    section1Rows: typeof ev.section1Rows,
    settlementRows: typeof ev.settlementRows,
    bases: typeof ev.settlementBases,
    weights: typeof ev.settlementWeights,
  ): number {
    const p = (s: string | undefined) =>
      parseFloat(String(s || "").replace(/,/g, "")) || 0;
    const activeComps = compRows
      .map((r: any, i: number) => ({ row: r, originalIndex: i }))
      .filter(({ row }: any) => row.inReport !== false);
    const n = activeComps.length;
    if (n === 0) return 0;

    const getBase = (c: number) => {
      const origIdx = activeComps[c]?.originalIndex ?? c;
      const stored = bases[origIdx];
      return stored !== undefined && stored !== ""
        ? stored
        : (compRows[origIdx]?.price ?? "");
    };

    const getS1Adj = (row: any, c: number) => {
      const origIdx = activeComps[c]?.originalIndex ?? c;
      return (row.colAdj ?? [])[origIdx] ?? "";
    };

    const getS2Adj = (row: any, c: number) => {
      const origIdx = activeComps[c]?.originalIndex ?? c;
      return (row.colAdj ?? [])[origIdx] ?? "";
    };

    const effectiveBases = Array.from({ length: n }, (_, c) => getBase(c));

    const s1AdjAmounts = Array.from({ length: n }, (_, c) => {
      const base = p(effectiveBases[c]);
      return section1Rows
        .filter((r: any) => r.inReport !== false)
        .reduce(
          (sum: number, r: any) => sum + base * (p(getS1Adj(r, c)) / 100),
          0,
        );
    });

    const priceAfterS1 = Array.from({ length: n }, (_, c) => {
      const base = p(effectiveBases[c]);
      return base ? base + s1AdjAmounts[c] : 0;
    });

    const s2AdjAmounts = Array.from({ length: n }, (_, c) => {
      const base = priceAfterS1[c];
      return (settlementRows as any[])
        .filter((r: any) => r.inReport !== false)
        .reduce((sum: number, r: any) => {
          const origIdx = activeComps[c]?.originalIndex ?? c;
          const adj = (r.colAdj ?? [])[origIdx] ?? "";
          return sum + base * (p(adj) / 100);
        }, 0);
    });

    const priceAfterAll = Array.from(
      { length: n },
      (_, c) => priceAfterS1[c] + s2AdjAmounts[c],
    );

    const totalWeight = Array.from({ length: n }, (_, c) => {
      const origIdx = activeComps[c]?.originalIndex ?? c;
      return p(weights[origIdx] ?? "");
    }).reduce((s: number, v: number) => s + v, 0);

    if (Math.abs(totalWeight - 100) > 0.01) return 0;

    const net = Array.from({ length: n }, (_, c) => {
      const origIdx = activeComps[c]?.originalIndex ?? c;
      return priceAfterAll[c] * (p(weights[origIdx] ?? "") / 100);
    }).reduce((s: number, v: number) => s + v, 0);

    return net;
  }

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
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [signatories, setSignatories] = useState<CompanySignatoryOption[]>([]);
  const [statusMsg, setStatusMsg] = useState<{
    type: "ok" | "error" | "info";
    text: string;
  }>({ type: "ok", text: "" });
  const [saving, setSaving] = useState(false);
  const [investmentTitle, setInvestmentTitle] = useState("");
  const [rvlForm, setRvlForm] = useState({ landSpace: "", rvlId: "" });
  const [dcfForm, setDcfForm] = useState({ title: "", num: "", date: "" });
  const [rvForm, setRvForm] = useState({ title: "" });
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
  const [showCopyModal, setShowCopyModal] = useState(false);
    const [copyList, setCopyList] = useState<any[]>([]);
    const [copyLoading, setCopyLoading] = useState(false);
    const [copySearch, setCopySearch] = useState("");
    const [copyingId, setCopyingId] = useState<string | null>(null);
    const [copyError, setCopyError] = useState<string | null>(null);

    const openCopyModal = () => {
      setShowCopyModal(true);
      setCopyError(null);
      setCopyLoading(true);
      fetch(toApiUrl("/api/transactions"), {
        credentials: "include",
        cache: "no-store",
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => {
          const arr = Array.isArray(data)
            ? data
            : (data.data ?? data.transactions ?? data.items ?? []);
          setCopyList(arr.filter((row: any) => (row.id ?? row._id) !== transactionId));
        })
        .catch(() =>
          setCopyError(lang === "ar" ? "فشل تحميل المعاملات" : "Failed to load transactions"),
        )
        .finally(() => setCopyLoading(false));
    };

    const handleCopyFromTransaction = (sourceId: string) => {
      setCopyingId(sourceId);
      setCopyError(null);
      fetch(toApiUrl(`/api/transactions/${sourceId}`), {
        credentials: "include",
        cache: "no-store",
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => {
          setEv(buildEvFromTxData(data));
          setIsDirty(true);
          setShowCopyModal(false);
          setStatusMsg({
            type: "ok",
            text: lang === "ar" ? "تم نسخ البيانات بنجاح" : "Data copied successfully",
          });
        })
        .catch(() =>
          setCopyError(lang === "ar" ? "فشل نسخ البيانات" : "Failed to copy data"),
        )
        .finally(() => setCopyingId(null));
    };

    const filteredCopyList = copyList.filter((row: any) => {
      if (!copySearch.trim()) return true;
      const q = copySearch.toLowerCase();
      const hay = [
        row.assignmentNumber,
        row.clientName,
        row.clientId,
        row.id,
        row._id,
        row?.evalData?.address,
        row?.evalData?.ownerName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

  const [isDirty, setIsDirty] = useState(false);
  const skipNextDirtyMark = useRef(true); // true while we're loading/hydrating ev programmatically

  // ── Investment entry helpers ──────────────────────────────────────────────────

  function updateInvestmentEntry(
    entryIdx: number,
    partial: Record<string, any>,
  ) {
    setEv((p) => ({
      ...p,
      investmentEntries: p.investmentEntries.map((en: any, i: number) =>
        i === entryIdx ? { ...en, ...partial } : en,
      ),
    }));
  }

  const addAuthor = useCallback(() => {
    setEv((p) => ({
      ...p,
      authors: {
        authorEntries: [
          ...p.authors.authorEntries,
          { id: cryptoRandomId(), signatoryId: "", title: "" },
        ],
      },
    }));
  }, []);

  const updateAuthor = useCallback(
    (rowId: string, patch: Partial<{ signatoryId: string; title: string }>) => {
      setEv((p) => ({
        ...p,
        authors: {
          authorEntries: p.authors.authorEntries.map((a) =>
            a.id === rowId ? { ...a, ...patch } : a,
          ),
        },
      }));
    },
    [],
  );

  const removeAuthor = useCallback((rowId: string) => {
    setEv((p) => ({
      ...p,
      authors: {
        authorEntries:
          p.authors.authorEntries.length > 1
            ? p.authors.authorEntries.filter((a) => a.id !== rowId)
            : p.authors.authorEntries, // always keep at least one row
      },
    }));
  }, []);

  function addInvestmentLine(entryIdx: number) {
    setEv((p) => ({
      ...p,
      investmentEntries: p.investmentEntries.map((en: any, i: number) =>
        i === entryIdx
          ? {
              ...en,
              lines: [
                ...(en.lines ?? []),
                {
                  title: "",
                  space: "",
                  value: "",
                  notes: "",
                  inCapitalization: true,
                },
              ],
            }
          : en,
      ),
    }));
  }

  function updateInvestmentLine(
    entryIdx: number,
    lineIdx: number,
    partial: Record<string, any>,
  ) {
    setEv((p) => ({
      ...p,
      investmentEntries: p.investmentEntries.map((en: any, i: number) =>
        i !== entryIdx
          ? en
          : {
              ...en,
              lines: (en.lines ?? []).map((l: any, j: number) =>
                j === lineIdx ? { ...l, ...partial } : l,
              ),
            },
      ),
    }));
  }

  function removeInvestmentLine(entryIdx: number, lineIdx: number) {
    setEv((p) => ({
      ...p,
      investmentEntries: p.investmentEntries.map((en: any, i: number) =>
        i !== entryIdx
          ? en
          : {
              ...en,
              lines: (en.lines ?? []).filter(
                (_: any, j: number) => j !== lineIdx,
              ),
            },
      ),
    }));
  }


  function addMarketComp(entryIdx: number) {
    setEv((p) => ({
      ...p,
      investmentEntries: p.investmentEntries.map((en: any, i: number) =>
        i === entryIdx
          ? {
              ...en,
              marketComps: [
                ...(en.marketComps ?? []),
                { title: "", income: "", propertyValue: "", notes: "" },
              ],
            }
          : en,
      ),
    }));
  }

  function updateMarketComp(
    entryIdx: number,
    compIdx: number,
    partial: Record<string, any>,
  ) {
    setEv((p) => ({
      ...p,
      investmentEntries: p.investmentEntries.map((en: any, i: number) =>
        i !== entryIdx
          ? en
          : {
              ...en,
              marketComps: (en.marketComps ?? []).map((c: any, j: number) =>
                j === compIdx ? { ...c, ...partial } : c,
              ),
            },
      ),
    }));
  }

  function removeMarketComp(entryIdx: number, compIdx: number) {
    setEv((p) => ({
      ...p,
      investmentEntries: p.investmentEntries.map((en: any, i: number) =>
        i !== entryIdx
          ? en
          : {
              ...en,
              marketComps: (en.marketComps ?? []).filter(
                (_: any, j: number) => j !== compIdx,
              ),
            },
      ),
    }));
  }

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

  function ensureAtLeastOneAuthor(
    entries: { id: string; signatoryId: string; title: string }[],
  ) {
    return entries.length > 0
      ? entries
      : [{ id: cryptoRandomId(), signatoryId: "", title: "" }];
  }

  const buildEvFromTxData = useCallback((txData: any) => {
    const e: Record<string, any> = txData.evalData ?? {};
    const bl = buildByLabel(txData.templateFieldValues);
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
    return {
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
        authorizedLandCoverPct: pick(e.authorizedLandCoverPct),
        streetWidth: pick(e.streetWidth),
        streetFronts: pick(e.streetFronts),
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
        ...emptyAppraiserData(),
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
        standards: pick(
          e.standards,
          "تم إعداد هذا التقرير وفقاً لمعايير التقييم السعودية الصادرة عن الهيئة السعودية للمقيمين المعتمدين (تقييم)، ومعايير التقييم الدولية (IVS).",
        ),
        scope: pick(
          e.scope,
          "قام المقيم بمعاينة الأصل ميدانياً، وجمع البيانات المتعلقة بالموقع والمساحة والمواصفات، والاطلاع على الوثائق المتوفرة (الصك، الرخصة، المخطط)، بالإضافة إلى دراسة السوق العقاري المحلي والمقارنات المتاحة في نفس المنطقة أو مناطق مشابهة.",
        ),
        assumptions: pick(
          e.assumptions,
          "تم افتراض أن المعلومات والوثائق المقدمة من قبل العميل صحيحة ودقيقة، وأن الأصل خالٍ من أي التزامات أو نزاعات قانونية لم يتم الإفصاح عنها، وأن الغرض من التقييم كما هو موضح في الطلب.",
        ),
        risks: pick(
          e.risks,
          "قد تتأثر القيمة النهائية بتقلبات السوق العقاري، أو بأي معلومات لم يتم الإفصاح عنها من قبل العميل، أو بتغيرات في الأنظمة والتشريعات ذات العلاقة.",
        ),
      },
      authors: {
        authorEntries: ensureAtLeastOneAuthor(
          Array.isArray(e.authorEntries) && e.authorEntries.length > 0
            ? e.authorEntries.map((a: any) => ({
                id: typeof a.id === "string" && a.id ? a.id : cryptoRandomId(),
                signatoryId: typeof a.signatoryId === "string" ? a.signatoryId : "",
                title: typeof a.title === "string" ? a.title : "",
              }))
            : [1, 2, 3, 4]
                .map((n) => ({
                  signatoryId: pick(e[`author${n}Id`]),
                  title: pick(e[`author${n}Title`]),
                }))
                .filter((a) => a.signatoryId || a.title)
                .map((a) => ({ id: cryptoRandomId(), ...a })),
        ),
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
      investmentEntries: Array.isArray(e.investmentEntries)
        ? e.investmentEntries
        : [],
      residualValueEntries: Array.isArray(e.residualValueEntries)
        ? e.residualValueEntries
        : [],
      dcfEntries: Array.isArray(e.dcfEntries) ? e.dcfEntries : [],
      rentalValueEntries: Array.isArray(e.rentalValueEntries)
              ? e.rentalValueEntries
              : [],
          };
        }, [lang]);

        useEffect(() => {
          if (!tx) return;
          setEv(buildEvFromTxData(tx));
          skipNextDirtyMark.current = true;
        }, [tx, buildEvFromTxData]);


        useEffect(() => {
          fetch(toApiUrl("/api/company/users"), {
            credentials: "include",
            cache: "no-store",
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (!data) return;
              const users = Array.isArray(data.users) ? data.users : [];
              const reportOnly = Array.isArray(data.reportOnlySignatories)
                ? data.reportOnlySignatories
                : [];

              const opts: CompanySignatoryOption[] = [
                ...users
                  .filter((u: any) => u.valuationReportDisplayName)
                  .map((u: any) => ({
                    id: u.id,
                    name: u.valuationReportDisplayName as string,
                    jobTitle: (u.valuationReportJobTitle as string) ?? "",
                    membershipNo: (u.valuationReportMembershipNo as string) ?? "",
                    source: "user" as const,
                  })),
                ...reportOnly.map((r: any) => ({
                  id: r.id,
                  name: r.name as string,
                  jobTitle: (r.jobTitle as string) ?? "",
                  membershipNo: (r.membershipNo as string) ?? "",
                  source: "reportOnly" as const,
                })),
              ];

              setSignatories(opts);
            })
            .catch(() => {
              // silently ignore — authors dropdown just falls back to empty list
            });
        }, []);
  useEffect(() => {
    if (skipNextDirtyMark.current) {
      skipNextDirtyMark.current = false;
      return;
    }
    setIsDirty(true);
  }, [ev]);



  const { setOpen } = useSidebar()

  // Collapse the app sidebar whenever this page is active, restore on leave.
  useEffect(() => {
    setOpen(false);
    return () => setOpen(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = ""; // required for Chrome to show the native confirm dialog
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
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
        authorEntries: ev.authors.authorEntries,
        comparisonRows: ev.comparisonRows,
        section1Rows: ev.section1Rows,
        settlementRows: ev.settlementRows,
        settlementBases: ev.settlementBases,
        settlementWeights: ev.settlementWeights,
        replacementLines: ev.replacementLines,
        ...ev.replacementFields,
        investmentEntries: ev.investmentEntries,
        residualValueEntries: ev.residualValueEntries,
        dcfEntries: ev.dcfEntries,
        rentalValueEntries: ev.rentalValueEntries,
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
      setIsDirty(false);
      setStatusMsg({ type: "ok", text: t.savedOk });
      onStatusSaved?.();
    } catch {
      setStatusMsg({ type: "error", text: t.saveError });
    } finally {
      setSaving(false);
    }
  };

  const repDerived = computeReplacementDerived(
    ev.replacementLines,
    ev.replacementFields as any,
  );
  const completion = useSectionCompletion(ev);
  const investmentTotal = ev.investmentEntries.reduce(
    (sum: number, entry: any) => {
      const capLines = entry.lines ?? [];
      const capIncludedIncome = capLines
        .filter((l: any) => l.inCapitalization !== false)
        .reduce(
          (s: number, l: any) =>
            s + (parseFloat(l.space) || 0) * (parseFloat(l.value) || 0),
          0,
        );
      const vacancyAmt =
        capIncludedIncome * (parseFloat(entry.vacancyRate) / 100 || 0);
      const effectiveIncome = capIncludedIncome - vacancyAmt;
      const maintenanceAmt =
        effectiveIncome * (parseFloat(entry.maintenanceRate) / 100 || 0);
      const noi = effectiveIncome - maintenanceAmt;
      const capRate = parseFloat(entry.capitalizationRate) || 0;
      return sum + (capRate > 0 ? noi / (capRate / 100) : 0);
    },
    0,
  );

  const settlNetMeter = computeSettlementNetMeter(
    ev.comparisonRows,
    ev.section1Rows,
    ev.settlementRows,
    ev.settlementBases,
    ev.settlementWeights,
  );

  const VM_TABS = [
    { id: "vm-m", label: t.vmMarket },
    { id: "vm-c", label: t.vmCost },
    { id: "vm-i", label: t.vmIncome },
    { id: "vm-r", label: t.vmResidual },
    { id: "vm-d", label: t.vmDcf },
    { id: "vm-e", label: t.vmRental },
  ];

  const STEPS = [
    { key: "overview",     label: lang === "ar" ? "نظرة عامة" : "Overview",        icon: <ClipboardList size={14} /> },
    { key: "location",     label: t.secLocation,                                    icon: <MapPin size={14} /> },
    { key: "basic",        label: t.secBasic,        icon: <Database size={14} />,  completion: completion.secBasic },
    { key: "boundaries",   label: t.secBoundaries,   icon: <Compass size={14} />,   completion: completion.secBoundaries },
    { key: "finishing",    label: t.secFinishing,                                   icon: <Layers size={14} /> },
    { key: "services",     label: t.secServices,                                    icon: <Zap size={14} /> },
    { key: "map",          label: t.secMap,                                         icon: <Map size={14} /> },
    { key: "comparison",   label: t.secComparison,                                  icon: <Map size={14} /> },
    { key: "replacement",  label: t.secReplacement,                                 icon: <Wrench size={14} /> },
    { key: "investment",   label: lang === "ar" ? "التحليل الاستثماري" : "Investment Analysis", icon: <BarChart2 size={14} /> },
    { key: "methods",      label: t.secMethods,                                     icon: <BarChart2 size={14} /> },
    { key: "appraiser",    label: t.secAppraiser,                                   icon: <UserCheck size={14} /> },
    { key: "report",       label: lang === "ar" ? "التقرير والمعدين" : "Report & Authors", icon: <ScrollText size={14} /> },
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

  // ── Select-all / Deselect-all helper for Property Services ─────────────────
  const ALL_ENV_KEYS = [
    "mosque", "commercialMarket", "park", "governmentFacility",
    "highSpeedRoad", "otherServices", "educationalFacility",
    "securityFacility", "medicalFacility",
  ];
  const allEnvSelected = ALL_ENV_KEYS.every((k) =>
    (ev.services.surroundingEnvironment ?? []).includes(k),
  );
  const allBoolServicesSelected =
    svc.electricity === true &&
    svc.sanitaryDrainage === true &&
    svc.telephoneLine === true;
  const allServicesSelected = allEnvSelected && allBoolServicesSelected;

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
        padding: "12px 16px 80px",
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
          marginBottom: 10,
          background: DS.surface,
          borderRadius: DS.radius.xl,
          padding: "12px 14px",
          border: `1px solid ${DS.border}`,
          boxShadow: DS.shadow.sm,
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (isDirty) {
              const confirmed = window.confirm(
                lang === "ar"
                  ? "لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟"
                  : "You have unsaved changes. Leave without saving?",
              );
              if (!confirmed) return;
            }
            onBack();
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
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
              fontSize: 14,
              fontWeight: 700,
              margin: 0,
              color: DS.text,
              letterSpacing: "-0.2px",
            }}
          >
            {t.pageTitle}
          </h1>
          <div style={{ fontSize: 10, color: DS.textMuted, marginTop: 0 }}>
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

      {/* ── Quick actions ───────────────────────────────────────────────────────────── */}
                  <div
                    style={{
                      background: DS.surface,
                      border: `1px solid ${DS.border}`,
                      borderRadius: DS.radius.xl,
                      marginBottom: 12,
                      padding: "14px 18px",
                      boxShadow: DS.shadow.md,
                      position: "sticky" as const,
                      top: 12,
                      zIndex: 60,
                    }}
                  >
                    <p style={{ fontSize: 10, fontWeight: 700, color: DS.textLight, textTransform: "uppercase" as const, letterSpacing: "0.08em", margin: "0 0 10px" }}>
                      {t.secAssetDetails}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                      <ActionButton icon={<Image size={14} />} label={t.btnImages} accent="#7c3aed" onClick={() => onOpenImages?.(transactionId, requester)} />
                      <ActionButton icon={<Paperclip size={14} />} label={t.btnAttachments} accent="#0891b2" onClick={() => onOpenAttachments?.(transactionId, requester)} />
                      <ActionButton icon={<Pencil size={14} />} label={t.btnEdit} accent="#d97706" onClick={() => onOpenEdit?.(transactionId, requester)} />
                      <ActionButton icon={<Map size={14} />} label={t.btnNearComps} />
                      <ActionButton icon={<Pin size={14} />} label={t.btnCopyComps} />
                      <ActionButton icon={<Printer size={14} />} label={t.btnView} onClick={() => window.open(`/api/transactions/${transactionId}/pdf`, "_blank")} />
                      <ActionButton icon={<FileText size={14} />} label={t.btnPdf} onClick={() => { const a = document.createElement("a"); a.href = `/api/transactions/${transactionId}/pdf`; a.download = `valuation-${transactionId}.pdf`; a.click(); }} />
                      <ActionButton icon={<MessageSquare size={14} />} label={t.btnMessages} accent="#0891b2" onClick={() => onOpenNotes?.(transactionId, requester)} />
                    </div>
                  </div>

      {/* ── Request Information ─────────────────────────────────────────────── */}
      <WizardShell steps={STEPS} activeStep={activeStep} onStepChange={setActiveStep} lang={lang} lastStepActions={{
                onOverview: () => setActiveStep(0),
                onViewReport: () =>
                  window.open(`/api/transactions/${transactionId}/pdf`, "_blank"),
              }}
>
      {activeStep === 0 && (
        <>
        {/* ── Hero (compact) ──────────────────────────────────────────────── */}
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
                  <div
                    style={{
                      position: "relative",
                      borderRadius: DS.radius.xl,
                      padding: "20px 24px 18px",
                      marginBottom: 12,
                      background: `linear-gradient(135deg, ${DS.primary} 0%, #7c3aed 100%)`,
                      boxShadow: `0 10px 30px -8px ${DS.primary}55`,
                      overflow: "hidden",
                      color: "#fff",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: -40, insetInlineEnd: -40,
                        width: 180, height: 180,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.08)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: -60, insetInlineStart: -20,
                        width: 160, height: 160,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.06)",
                      }}
                    />
                    <div style={{ position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const, marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <span
                            style={{
                              width: 34, height: 34, borderRadius: DS.radius.md,
                              background: "rgba(255,255,255,0.16)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <ClipboardList size={17} />
                          </span>
                          <div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.2px" }}>{t.pageTitle}</span>
                              <span style={{ fontSize: 11, opacity: 0.75 }}>#{transactionId}</span>
                            </div>
                            <div style={{ fontSize: 10.5, opacity: 0.75, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginTop: 4 }}>
                              {t.finalAssetValue}
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 800, direction: "ltr" as const, lineHeight: 1.15 }}>
                              {ev.appraiser.finalAssetValue
                                ? Number(ev.appraiser.finalAssetValue).toLocaleString("en-US", { maximumFractionDigits: 0 })
                                : (lang === "ar" ? "لم يُحدد بعد" : "Not yet determined")}
                            </div>
                          </div>
                        </div>

                        {/* Status badge + opened/completed toggles */}
                        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: isRtl ? "flex-start" : "flex-end", gap: 7 }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "5px 12px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              background: "rgba(255,255,255,0.18)",
                            }}
                          >
                            {WORKFLOW_STATUSES[lang].find((s) => s.value === ev.status)?.label}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, justifyContent: isRtl ? "flex-start" : "flex-end" }}>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "4px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                                background: tx?.isOpened ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
                              }}
                            >
                              {tx?.isOpened ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              {lang === "ar" ? (tx?.isOpened ? "تم الفتح" : "لم يُفتح") : (tx?.isOpened ? "Opened" : "Not opened")}
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                const next = !tx?.isCompleted;
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
                                  setTx((prev: any) => ({ ...prev, isCompleted: !next }));
                                  setStatusMsg({ type: "error", text: t.saveError });
                                }
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "4px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                                border: "none",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                background: tx?.isCompleted ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
                                color: "#fff",
                              }}
                            >
                              {tx?.isCompleted ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              {lang === "ar" ? (tx?.isCompleted ? "مكتملة" : "غير مكتملة") : (tx?.isCompleted ? "Completed" : "Not completed")}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Data-rich metrics grid (merged from Request + Asset Info) */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                          gap: "12px 22px",
                          paddingTop: 13,
                          borderTop: "1px solid rgba(255,255,255,0.18)",
                        }}
                      >
                        {[
                          { label: t.propertyArea, value: ev.assetInfo.propertyArea },
                          { label: t.propertyType, value: ev.assetInfo.propertyType },
                          { label: t.address, value: ev.assetInfo.address },
                          { label: t.landUse, value: ev.assetInfo.landUse },
                          { label: t.region, value: ev.location.regionName || ev.location.cityName },
                          { label: t.client, value: tx?.clientName ?? tx?.clientId },
                          {
                            label: t.valuationPurpose,
                            value: VALUATION_PURPOSES[lang][tx?.valuationPurpose] ?? tx?.valuationPurpose,
                          },
                          { label: t.refNo, value: transactionId },
                        ].map((m, i) => (
                          <div key={i} style={{ minWidth: 90 }}>
                            <div style={{ fontSize: 9.5, opacity: 0.75, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 3 }}>
                              {m.label}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{m.value || "—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
          {/* ── Expanded stat grid (remaining Request + Asset Info data) ─────── */}
          <div
            style={{
              background: DS.surface,
              border: `1px solid ${DS.border}`,
              borderRadius: DS.radius.xl,
              marginBottom: 12,
              padding: "16px 18px",
              boxShadow: DS.shadow.sm,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <StatCard icon={<ScrollText size={13} />} color="#d97706" label={t.assignmentNo} value={tx?.assignmentNumber} isRtl={isRtl} />
                <StatCard icon={<ScrollText size={13} />} color="#d97706" label={t.assignmentDate} value={tx?.assignmentDate}  isRtl={isRtl} />
              <StatCard
                icon={<Scale size={13} />}
                color="#0891b2"
                label={t.valuationBasis}
                value={VALUATION_BASES[lang][tx?.valuationBasis] ?? tx?.valuationBasis} isRtl={isRtl}
              />
              <StatCard
                icon={<Building2 size={13} />}
                color="#7c3aed"
                label={t.ownershipType}
                value={OWNERSHIP_TYPES[lang][tx?.ownershipType] ?? tx?.ownershipType} isRtl={isRtl}
              />
              <StatCard
                icon={<Compass size={13} />}
                color="#2563eb"
                label={t.valuationHypothesis}
                value={VALUATION_HYPOTHESES[lang][tx?.valuationHypothesis] ?? tx?.valuationHypothesis} isRtl={isRtl}
              />
                <StatCard icon={<Layers size={13} />} color="#059669" label={t.assetCount} value={t.assetCountVal} isRtl={isRtl} />
                <StatCard icon={<FileText size={13} />} color="#0e7490" label={t.template} value={tx?.templateName ?? tx?.templateId}  isRtl={isRtl}/>
                <StatCard icon={<Users size={13} />} color="#7c3aed" label={t.inspector} value={ev.assetInfo.inspector}  isRtl={isRtl}/>
              <StatCard icon={<MessageSquare size={13} />} color="#2563eb" label={t.contactNo} value={ev.assetInfo.contactNo} isRtl={isRtl} / >
              <StatCard icon={<UserCheck size={13} />} color="#d97706" label={t.reviewer} value={ev.assetInfo.reviewer} isRtl={isRtl} />

              {tx?.intendedUse && (
                <StatCard icon={<ClipboardList size={13} />} color="#64748b" label={t.notes} value={tx?.intendedUse} isRtl={isRtl}/>
              )}
            </div>
          </div>



          {/* ── Important Links ─────────────────────────────────────────────────── */}
          <details
            style={{
              background: DS.surface,
              border: `1px solid ${DS.border}`,
              borderRadius: DS.radius.xl,
              marginTop: 12,
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
                background: `linear-gradient(90deg, ${DS.primary}10, transparent)`,
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
                  <Link2 size={14} />
                </span>
                {t.secLinks}
              </div>
              <ChevronDown size={13} style={{ color: DS.textMuted, flexShrink: 0 }} />
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
        </>
      )}
      {activeStep === 1 && (
      <>
            {/* ── Location ────────────────────────────────────────────────────────── */}
      <SectionCard title={t.secLocation} icon={<MapPin size={14} />} lang={lang}>
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
                  ? (getPropertyTypeLabel(ev.location.propertyTypeId, lang) ||
                     ev.assetInfo.propertyType)
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
                  : !ev.location.assetCategoryId
                    ? (lang === "ar"
                        ? "اختر تصنيف الأصل أولاً لتصفية القائمة"
                        : "Select asset category first to filter the list")
                    : undefined
              }
            >
              {getPropertyTypesForCategory(ev.location.assetCategoryId, lang).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </InlineSelectField>
          </Field>
        </GridFields>
            </SectionCard>

      </>
      )}
      {activeStep === 2 && (
      <>

      {/* ── Basic Data ──────────────────────────────────────────────────────── */}
      <SectionCard
        title={t.secBasic}
        icon={<Database size={14} />}
        completion={completion.secBasic}
        lang={lang}

      >
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
            ] as [keyof typeof ev.basic, TKeys][]
          ).map(([key, labelKey]) => (
            <Field
              key={key}
              label={t[labelKey] as string}
              required={requiredBasicKeys.has(key)}
            >
              <Input
                value={(ev.basic as any)[key]}
                onChange={(e) => setField("basic", key, e.target.value)}
              />
            </Field>
          ))}
          <Field label={t.authorizedLandCoverPct}>
            <Input
              type="number"
              value={ev.basic.authorizedLandCoverPct}
              onChange={(e) =>
                setField("basic", "authorizedLandCoverPct", e.target.value)
              }
            />
          </Field>
          <Field label={t.elevation} required={requiredBasicKeys.has("elevation")}>
            <Select
              value={ev.basic.elevation}
              onChange={(e) => setField("basic", "elevation", e.target.value)}
            >
              <option value="" disabled>{t.selectValue}</option>
              <option value="مرتفع">{lang === "ar" ? "مرتفع" : "High"}</option>
              <option value="مستوي">{lang === "ar" ? "مستوي" : "Level"}</option>
              <option value="منخفض">{lang === "ar" ? "منخفض" : "Low"}</option>
            </Select>
          </Field>
          <Field label={t.streetWidth} required={requiredBasicKeys.has("streetWidth")}>
            <Input
              type="text"
              value={ev.basic.streetWidth}
              onChange={(e) => setField("basic", "streetWidth", e.target.value)}
            />
          </Field>
          <Field label={t.streetFronts}>
            <Select
              value={ev.basic.streetFronts}
              onChange={(e) =>
                setField("basic", "streetFronts", e.target.value)
              }
            >
              <option value="" disabled>
                {t.selectValue}
              </option>
              <option value="0">{t.streetFronts0}</option>
              <option value="1">{t.streetFronts1}</option>
              <option value="2">{t.streetFronts2}</option>
              <option value="3">{t.streetFronts3}</option>
              <option value="4">{t.streetFronts4}</option>
            </Select>
          </Field>
          <Field label={t.inspectionBoundaries} full required={requiredBasicKeys.has("inspectionBoundaries")}>
            <Select
              value={ev.basic.inspectionBoundaries}
              onChange={(e) =>
                setField("basic", "inspectionBoundaries", e.target.value)
              }
            >
              <option value="" disabled>{t.selectValue}</option>
              <option value="معاينة خارجية">
                {lang === "ar" ? "معاينة خارجية" : "External Inspection"}
              </option>
              <option value="معاينة داخلية">
                {lang === "ar" ? "معاينة داخلية" : "Internal Inspection"}
              </option>
              <option value="معاينة داخلية وخارجية">
                {lang === "ar" ? "معاينة داخلية وخارجية" : "Internal & External Inspection"}
              </option>
            </Select>
          </Field>
        </GridFields>
            </SectionCard>

      </>
      )}
      {activeStep === 3 && (
      <>

      {/* ── Boundaries ──────────────────────────────────────────────────────── */}
      <SectionCard
        title={t.secBoundaries}
        icon={<Compass size={14} />}
        completion={completion.secBoundaries}
        lang={lang}

      >
        <GridFields>
          {boundaryFields.map(({ key, labelKey }) => (
            <Field key={key} label={t[labelKey] as string} required>
              <Input
                value={(ev.boundaries as any)[key]}
                onChange={(e) => setField("boundaries", key, e.target.value)}
              />
            </Field>
          ))}
        </GridFields>
            </SectionCard>

      </>
      )}
      {activeStep === 4 && (
      <>

      {/* ── Finishing ───────────────────────────────────────────────────────── */}
      <SectionCard title={t.secFinishing} icon={<Layers size={14} />} lang={lang}
>
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

      </>
      )}
      {activeStep === 5 && (
      <>

      {/* ── Services ────────────────────────────────────────────────────────── */}
      <SectionCard title={t.secServices} icon={<Zap size={14} />} lang={lang}
>
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

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() =>
                    setEv((p) => ({
                      ...p,
                      services: {
                        ...p.services,
                        availableServices: {
                          ...p.services.availableServices,
                          electricity: !allServicesSelected ? true : null,
                          sanitaryDrainage: !allServicesSelected ? true : null,
                          telephoneLine: !allServicesSelected ? true : null,
                        },
                        surroundingEnvironment: !allServicesSelected ? ALL_ENV_KEYS : [],
                      },
                    }))
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    background: allServicesSelected ? `${DS.red}10` : `${DS.primary}10`,
                    border: `1px solid ${allServicesSelected ? DS.red + "35" : DS.primary + "30"}`,
                    borderRadius: DS.radius.md,
                    color: allServicesSelected ? DS.red : DS.primary,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {allServicesSelected ? <X size={13} /> : <Check size={13} />}
                  {allServicesSelected
                    ? lang === "ar" ? "إلغاء تحديد الكل" : "Deselect All"
                    : lang === "ar" ? "تحديد الكل" : "Select All"}
                </button>
              </div>

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

            </>
            )}
            {activeStep === 6 && (
            <>

      {/* ── Map Location ────────────────────────────────────────────────────── */}
      <SectionCard title={t.secMap} icon={<MapPin size={14} />} lang={lang}
>
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

            </>
            )}
            {activeStep === 7 && (
            <>

      {/* ── Comparison ──────────────────────────────────────────────────────── */}
      <SectionCard
        title={t.secComparison}
        accentColor="#0e7490"
        icon={<Map size={14} />}
        lang={lang}

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

            </>
            )}
            {activeStep === 8 && (
            <>

      {/* ── Replacement Cost ─────────────────────────────────────────────────── */}
      <SectionCard
        title={t.secReplacement}
        accentColor="#0e7490"
        icon={<Wrench size={14} />}
        lang={lang}

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

            </>
            )}
            {activeStep === 9 && (
            <>

      {/* ── Investment (الاستثمار) ──────────────────────────────────────────────── */}
      <SectionCard
              title={lang === "ar" ? "الاستثمار" : "Investment"}
              accentColor="#0e7490"
              icon={<BarChart2 size={14} />}
              lang={lang}
      >
        {/* Add new capitalization block form */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <Field label={lang === "ar" ? "العنوان" : "Title"}>
            <Input
              value={investmentTitle}
              onChange={(e) => setInvestmentTitle(e.target.value)}
              placeholder={
                lang === "ar"
                  ? "رسملة المبنى الرئيسي"
                  : "Main Building Capitalization"
              }
            />
          </Field>
          <div style={{ paddingBottom: 2 }}>
            <button
              type="button"
              disabled={!investmentTitle.trim()}
              onClick={() => {
                setEv((p) => ({
                  ...p,
                  investmentEntries: [
                    ...p.investmentEntries,
                    {
                      id: Date.now(),
                      title: investmentTitle.trim(),
                      lines: [],
                      showCapAnalysis: false,
                      marketComps: [],
                      vacancyRate: "",
                      maintenanceRate: "",
                      capitalizationRate: "",
                      notes: "",
                    },
                  ],
                }));
                setInvestmentTitle("");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: DS.green,
                color: "#fff",
                border: "none",
                borderRadius: DS.radius.md,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                opacity: !investmentTitle.trim() ? 0.4 : 1,
                transition: "opacity 0.15s",
              }}
            >
              + {lang === "ar" ? "إضافة" : "Add"}
            </button>
          </div>
        </div>

        {/* Render each capitalization block */}
        {ev.investmentEntries.map((entry: any, entryIdx: number) => {
          const capLines = entry.lines ?? [];
          const grossIncome = capLines.reduce((s: number, l: any) => {
            const space = parseFloat(l.space) || 0;
            const value = parseFloat(l.value) || 0;
            return s + space * value;
          }, 0);
          const capIncludedIncome = capLines
            .filter((l: any) => l.inCapitalization !== false)
            .reduce(
              (s: number, l: any) =>
                s + (parseFloat(l.space) || 0) * (parseFloat(l.value) || 0),
              0,
            );
          const vacancyAmt =
            capIncludedIncome * (parseFloat(entry.vacancyRate) / 100 || 0);
          const effectiveIncome = capIncludedIncome - vacancyAmt;
          const maintenanceAmt =
            effectiveIncome * (parseFloat(entry.maintenanceRate) / 100 || 0);
          const noi = effectiveIncome - maintenanceAmt;
          const capRate = parseFloat(entry.capitalizationRate) || 0;
          const propertyValue = capRate > 0 ? noi / (capRate / 100) : 0;

          const validComps = (entry.marketComps ?? []).filter(
            (c: any) =>
              parseFloat(c.income) > 0 && parseFloat(c.propertyValue) > 0,
          );
          const avgCapRate =
            validComps.length > 0
              ? validComps.reduce(
                  (s: number, c: any) =>
                    s +
                    (parseFloat(c.income) / parseFloat(c.propertyValue)) * 100,
                  0,
                ) / validComps.length
              : 0;

          return (
            <div
              key={entry.id ?? entryIdx}
              style={{
                border: `1px solid ${DS.border}`,
                borderRadius: DS.radius.lg,
                marginBottom: 24,
                overflow: "hidden",
                boxShadow: DS.shadow.sm,
              }}
            >
              {/* Block header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 16px",
                  background: DS.surfaceAlt,
                  borderBottom: `1px solid ${DS.border}`,
                }}
              >
                <h6
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: 14,
                    color: DS.text,
                  }}
                >
                  {lang === "ar" ? "المبنى:" : "Building:"} {entry.title}
                </h6>
                <button
                  type="button"
                  onClick={() =>
                    setEv((p) => ({
                      ...p,
                      investmentEntries: p.investmentEntries.filter(
                        (_: any, i: number) => i !== entryIdx,
                      ),
                    }))
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: DS.red,
                    cursor: "pointer",
                    fontSize: 18,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: "16px" }}>
                {/* Lines table */}
                <div
                  style={{
                    overflowX: "auto",
                    borderRadius: DS.radius.md,
                    border: `1px solid ${DS.border}`,
                    marginBottom: 10,
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
                      <tr>
                        {[
                          lang === "ar" ? "النوع" : "Type",
                          lang === "ar" ? "العدد/المساحة" : "Count/Area",
                          lang === "ar" ? "سعر المتر/الوحدة" : "Price/Unit",
                          lang === "ar" ? "القيمة الإيجارية" : "Rental Value",
                          lang === "ar" ? "ملاحظات" : "Notes",
                          lang === "ar" ? "ضمن الرسملة" : "In Cap.",
                          lang === "ar" ? "حذف" : "Del.",
                        ].map((h, i) => (
                          <th key={i} style={thS}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {capLines.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            style={{
                              ...tdS,
                              textAlign: "center",
                              color: DS.textLight,
                              padding: 16,
                            }}
                          >
                            {lang === "ar"
                              ? "لا توجد بنود — أضف بنداً جديداً"
                              : "No lines — add a new line below"}
                          </td>
                        </tr>
                      ) : (
                        capLines.map((line: any, lineIdx: number) => {
                          const lineTotal =
                            (parseFloat(line.space) || 0) *
                            (parseFloat(line.value) || 0);
                          return (
                            <tr
                              key={lineIdx}
                              style={{
                                background:
                                  lineIdx % 2 === 0
                                    ? DS.surface
                                    : DS.surfaceAlt,
                              }}
                            >
                              <td style={tdS}>
                                <input
                                  type="text"
                                  value={line.title ?? ""}
                                  onChange={(e) =>
                                    updateInvestmentLine(entryIdx, lineIdx, {
                                      title: e.target.value,
                                    })
                                  }
                                  style={cellInputS}
                                />
                              </td>
                              <td style={tdS}>
                                <input
                                  type="text"
                                  dir="ltr"
                                  value={line.space ?? ""}
                                  onChange={(e) =>
                                    updateInvestmentLine(entryIdx, lineIdx, {
                                      space: e.target.value,
                                    })
                                  }
                                  style={cellInputS}
                                />
                              </td>
                              <td style={tdS}>
                                <input
                                  type="text"
                                  dir="ltr"
                                  value={line.value ?? ""}
                                  onChange={(e) =>
                                    updateInvestmentLine(entryIdx, lineIdx, {
                                      value: e.target.value,
                                    })
                                  }
                                  style={cellInputS}
                                />
                              </td>
                              <td
                                style={{
                                  ...tdS,
                                  fontWeight: 600,
                                  color: DS.primary,
                                  direction: "ltr",
                                  textAlign: "right",
                                  whiteSpace: "nowrap" as const,
                                }}
                              >
                                {lineTotal > 0
                                  ? lineTotal.toLocaleString("en-US", {
                                      maximumFractionDigits: 0,
                                    })
                                  : "—"}
                              </td>
                              <td style={tdS}>
                                <input
                                  type="text"
                                  value={line.notes ?? ""}
                                  onChange={(e) =>
                                    updateInvestmentLine(entryIdx, lineIdx, {
                                      notes: e.target.value,
                                    })
                                  }
                                  style={cellInputS}
                                />
                              </td>
                              <td style={{ ...tdS, textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={line.inCapitalization !== false}
                                  onChange={(e) =>
                                    updateInvestmentLine(entryIdx, lineIdx, {
                                      inCapitalization: e.target.checked,
                                    })
                                  }
                                  style={{
                                    accentColor: DS.primary,
                                    width: 15,
                                    height: 15,
                                  }}
                                />
                              </td>
                              <td style={{ ...tdS, textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeInvestmentLine(entryIdx, lineIdx)
                                  }
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: DS.red,
                                    cursor: "pointer",
                                    fontSize: 16,
                                    lineHeight: 1,
                                  }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: DS.surfaceAlt }}>
                        <td colSpan={3} style={{ ...tdS, fontWeight: 700 }}>
                          {lang === "ar" ? "المجموع" : "Total"}
                        </td>
                        <td
                          colSpan={4}
                          style={{
                            ...tdS,
                            fontWeight: 700,
                            color: DS.primary,
                            direction: "ltr",
                            textAlign: "right",
                          }}
                        >
                          {grossIncome > 0
                            ? grossIncome.toLocaleString("en-US", {
                                maximumFractionDigits: 0,
                              })
                            : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => addInvestmentLine(entryIdx)}
                  style={{ ...linkBtnS, color: DS.green, marginBottom: 20 }}
                >
                  + {lang === "ar" ? "بند جديد" : "New Line"}
                </button>

                {/* Cap rate analysis toggle */}
                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      color: DS.primary,
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={entry.showCapAnalysis ?? false}
                      onChange={(e) =>
                        updateInvestmentEntry(entryIdx, {
                          showCapAnalysis: e.target.checked,
                        })
                      }
                      style={{ accentColor: DS.primary, width: 15, height: 15 }}
                    />
                    {lang === "ar"
                      ? "تحليل معدل الرسملة"
                      : "Capitalization Rate Analysis"}
                  </label>
                </div>

                {/* Market extraction table */}
                {entry.showCapAnalysis && (
                  <div style={{ marginBottom: 20 }}>
                    <h6
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: DS.text,
                        marginBottom: 10,
                      }}
                    >
                      {lang === "ar"
                        ? "طريقة الاستخلاص من السوق:"
                        : "Market Extraction Method:"}
                    </h6>
                    <div
                      style={{
                        overflowX: "auto",
                        borderRadius: DS.radius.md,
                        border: `1px solid ${DS.border}`,
                        marginBottom: 8,
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
                          <tr>
                            {[
                              lang === "ar" ? "البند" : "Item",
                              lang === "ar" ? "دخل العقار" : "Property Income",
                              lang === "ar" ? "قيمة العقار" : "Property Value",
                              lang === "ar" ? "معدل الرسملة" : "Cap Rate",
                              lang === "ar" ? "ملاحظات" : "Notes",
                              lang === "ar" ? "حذف" : "Del.",
                            ].map((h, i) => (
                              <th key={i} style={thS}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(entry.marketComps ?? []).length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                style={{
                                  ...tdS,
                                  textAlign: "center",
                                  color: DS.textLight,
                                  padding: 14,
                                }}
                              >
                                {lang === "ar"
                                  ? "لا توجد بيانات"
                                  : "No comparables added"}
                              </td>
                            </tr>
                          ) : (
                            (entry.marketComps ?? []).map(
                              (comp: any, compIdx: number) => {
                                const income = parseFloat(comp.income) || 0;
                                const val = parseFloat(comp.propertyValue) || 0;
                                const cr =
                                  income > 0 && val > 0
                                    ? ((income / val) * 100).toFixed(2)
                                    : "—";
                                return (
                                  <tr
                                    key={compIdx}
                                    style={{
                                      background:
                                        compIdx % 2 === 0
                                          ? DS.surface
                                          : DS.surfaceAlt,
                                    }}
                                  >
                                    <td style={tdS}>
                                      <input
                                        type="text"
                                        value={comp.title ?? ""}
                                        onChange={(e) =>
                                          updateMarketComp(entryIdx, compIdx, {
                                            title: e.target.value,
                                          })
                                        }
                                        style={cellInputS}
                                      />
                                    </td>
                                    <td style={tdS}>
                                      <input
                                        type="text"
                                        dir="ltr"
                                        value={comp.income ?? ""}
                                        onChange={(e) =>
                                          updateMarketComp(entryIdx, compIdx, {
                                            income: e.target.value,
                                          })
                                        }
                                        style={cellInputS}
                                      />
                                    </td>
                                    <td style={tdS}>
                                      <input
                                        type="text"
                                        dir="ltr"
                                        value={comp.propertyValue ?? ""}
                                        onChange={(e) =>
                                          updateMarketComp(entryIdx, compIdx, {
                                            propertyValue: e.target.value,
                                          })
                                        }
                                        style={cellInputS}
                                      />
                                    </td>
                                    <td
                                      style={{
                                        ...tdS,
                                        fontWeight: 600,
                                        color: DS.primary,
                                        textAlign: "center",
                                        whiteSpace: "nowrap" as const,
                                      }}
                                    >
                                      {cr}
                                      {cr !== "—" ? "%" : ""}
                                    </td>
                                    <td style={tdS}>
                                      <input
                                        type="text"
                                        value={comp.notes ?? ""}
                                        onChange={(e) =>
                                          updateMarketComp(entryIdx, compIdx, {
                                            notes: e.target.value,
                                          })
                                        }
                                        style={cellInputS}
                                      />
                                    </td>
                                    <td style={{ ...tdS, textAlign: "center" }}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeMarketComp(entryIdx, compIdx)
                                        }
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: DS.red,
                                          cursor: "pointer",
                                          fontSize: 16,
                                          lineHeight: 1,
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </td>
                                  </tr>
                                );
                              },
                            )
                          )}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: DS.surfaceAlt }}>
                            <td colSpan={3} style={{ ...tdS, fontWeight: 700 }}>
                              {lang === "ar"
                                ? "متوسط معدل الرسملة"
                                : "Average Cap Rate"}
                            </td>
                            <td
                              colSpan={3}
                              style={{
                                ...tdS,
                                fontWeight: 700,
                                color: DS.primary,
                                textAlign: "center",
                              }}
                            >
                              {avgCapRate > 0
                                ? `${avgCapRate.toFixed(2)}%`
                                : "—"}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <button
                      type="button"
                      onClick={() => addMarketComp(entryIdx)}
                      style={{ ...linkBtnS, color: DS.green }}
                    >
                      + {lang === "ar" ? "بند جديد" : "New Item"}
                    </button>
                  </div>
                )}

                {/* Capitalization calculator */}
                <div
                  style={{
                    overflowX: "auto",
                    borderRadius: DS.radius.md,
                    border: `1px solid ${DS.border}`,
                    marginBottom: 14,
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <tbody>
                      {[
                        {
                          label:
                            lang === "ar"
                              ? "إجمالي دخل العقار المتوقع"
                              : "Expected Gross Income",
                          content: (
                            <div
                              style={{
                                padding: "6px 10px",
                                direction: "ltr",
                                textAlign: "right" as const,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {capIncludedIncome > 0
                                ? capIncludedIncome.toLocaleString("en-US", {
                                    maximumFractionDigits: 0,
                                  })
                                : "—"}
                            </div>
                          ),
                        },
                        {
                          label:
                            lang === "ar" ? "خسائر الاشغار" : "Vacancy Loss",
                          content: (
                            <input
                              type="text"
                              dir="ltr"
                              value={entry.vacancyRate ?? ""}
                              onChange={(e) =>
                                updateInvestmentEntry(entryIdx, {
                                  vacancyRate: e.target.value,
                                })
                              }
                              placeholder={
                                lang === "ar" ? "النسبة %" : "Rate %"
                              }
                              style={{ ...cellInputS, textAlign: "right" }}
                            />
                          ),
                        },
                        {
                          label:
                            lang === "ar"
                              ? "إجمالي الدخل الفعلي"
                              : "Effective Gross Income",
                          content: (
                            <div
                              style={{
                                padding: "6px 10px",
                                direction: "ltr",
                                textAlign: "right" as const,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {effectiveIncome > 0
                                ? effectiveIncome.toLocaleString("en-US", {
                                    maximumFractionDigits: 0,
                                  })
                                : "—"}
                            </div>
                          ),
                        },
                        {
                          label:
                            lang === "ar"
                              ? "نسبة الصيانة والتشغيل"
                              : "Operating Expense Ratio",
                          content: (
                            <input
                              type="text"
                              dir="ltr"
                              value={entry.maintenanceRate ?? ""}
                              onChange={(e) =>
                                updateInvestmentEntry(entryIdx, {
                                  maintenanceRate: e.target.value,
                                })
                              }
                              placeholder={
                                lang === "ar" ? "النسبة %" : "Rate %"
                              }
                              style={{ ...cellInputS, textAlign: "right" }}
                            />
                          ),
                        },
                        {
                          label:
                            lang === "ar"
                              ? "صافي الدخل التشغيلي"
                              : "Net Operating Income",
                          content: (
                            <div
                              style={{
                                padding: "6px 10px",
                                direction: "ltr",
                                textAlign: "right" as const,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {noi > 0
                                ? noi.toLocaleString("en-US", {
                                    maximumFractionDigits: 0,
                                  })
                                : "—"}
                            </div>
                          ),
                        },
                        {
                          label:
                            lang === "ar"
                              ? "معدل الرسملة"
                              : "Capitalization Rate",
                          content: (
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                alignItems: "center",
                              }}
                            >
                              <input
                                type="text"
                                dir="ltr"
                                value={entry.capitalizationRate ?? ""}
                                onChange={(e) =>
                                  updateInvestmentEntry(entryIdx, {
                                    capitalizationRate: e.target.value,
                                  })
                                }
                                placeholder="%"
                                style={{
                                  ...cellInputS,
                                  textAlign: "right",
                                  flex: 1,
                                }}
                              />
                              {avgCapRate > 0 && !entry.capitalizationRate && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateInvestmentEntry(entryIdx, {
                                      capitalizationRate: avgCapRate.toFixed(2),
                                    })
                                  }
                                  style={{
                                    fontSize: 10,
                                    padding: "3px 7px",
                                    background: `${DS.primary}15`,
                                    border: `1px solid ${DS.primary}30`,
                                    borderRadius: DS.radius.sm,
                                    color: DS.primary,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap" as const,
                                  }}
                                >
                                  {lang === "ar"
                                    ? "تعبئة من السوق"
                                    : "Fill from market"}
                                </button>
                              )}
                            </div>
                          ),
                        },
                        {
                          label:
                            lang === "ar" ? "قيمة العقار" : "Property Value",
                          content: (
                            <div
                              style={{
                                padding: "6px 10px",
                                direction: "ltr",
                                textAlign: "right" as const,
                                fontWeight: 700,
                                fontSize: 14,
                                color: DS.primary,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {propertyValue > 0
                                ? propertyValue.toLocaleString("en-US", {
                                    maximumFractionDigits: 0,
                                  })
                                : "—"}
                            </div>
                          ),
                          highlight: true,
                        },
                      ].map(({ label, content, highlight }, ri) => (
                        <tr
                          key={ri}
                          style={{
                            background: highlight
                              ? DS.primaryLight
                              : ri % 2 === 0
                                ? DS.surface
                                : DS.surfaceAlt,
                          }}
                        >
                          <td
                            style={{
                              ...tdS,
                              fontWeight: 600,
                              color: highlight ? DS.primary : DS.text,
                              width: "55%",
                            }}
                          >
                            {label}
                          </td>
                          <td
                            style={{
                              ...tdS,
                              border: `1px solid ${highlight ? DS.primary + "30" : DS.border}`,
                            }}
                          >
                            {content}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Notes */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: DS.textMuted,
                      fontWeight: 700,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.06em",
                      marginBottom: 5,
                    }}
                  >
                    {lang === "ar" ? "ملاحظات:" : "Notes:"}
                  </label>
                  <textarea
                    rows={3}
                    value={entry.notes ?? ""}
                    onChange={(e) =>
                      updateInvestmentEntry(entryIdx, { notes: e.target.value })
                    }
                    style={{
                      ...inputStyle,
                      resize: "vertical" as const,
                      minHeight: 66,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </SectionCard>

      {/* ── Residual Value ──────────────────────────────────────────────────────── */}
      <SectionCard
        title={lang === "ar" ? "القيمة المتبقية" : "Residual Value"}
        accentColor="#0e7490"
        icon={<Scale size={14} />}
        lang={lang}

      >
        {/* Add entry form */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          {(() => {
            return (
              <>
                <Field
                  label={
                    lang === "ar" ? "مساحة الموقع العام الخام" : "Raw Land Area"
                  }
                >
                  <Input
                    type="text"
                    dir="ltr"
                    value={rvlForm.landSpace}
                    onChange={(e) =>
                      setRvlForm((f) => ({ ...f, landSpace: e.target.value }))
                    }
                  />
                </Field>
                <Field label={lang === "ar" ? "النوع" : "Type"}>
                  <Select
                    value={rvlForm.rvlId}
                    onChange={(e) =>
                      setRvlForm((f) => ({ ...f, rvlId: e.target.value }))
                    }
                  >
                    <option value="" disabled>
                      {lang === "ar"
                        ? "الرجاء اختيار نوع القيمة المتبقية"
                        : "Select residual value type"}
                    </option>
                    <option value="1">
                      {lang === "ar" ? "أرض تطويرية" : "Developmental Land"}
                    </option>
                    <option value="2">
                      {lang === "ar" ? "مبنى" : "Building"}
                    </option>
                  </Select>
                </Field>
                <div style={{ paddingBottom: 2 }}>
                  <button
                    type="button"
                    disabled={!rvlForm.landSpace || !rvlForm.rvlId}
                    onClick={() => {
                      setEv((p) => ({
                        ...p,
                        residualValueEntries: [
                          ...p.residualValueEntries,
                          { ...rvlForm, id: Date.now() },
                        ],
                      }));
                      setRvlForm({ landSpace: "", rvlId: "" });
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      background: DS.green,
                      color: "#fff",
                      border: "none",
                      borderRadius: DS.radius.md,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      opacity: !rvlForm.landSpace || !rvlForm.rvlId ? 0.4 : 1,
                    }}
                  >
                    + {lang === "ar" ? "إضافة" : "Add"}
                  </button>
                </div>
              </>
            );
          })()}
        </div>

        {/* Entries table */}
        {ev.residualValueEntries.length > 0 && (
          <div
            style={{
              overflowX: "auto",
              borderRadius: DS.radius.md,
              border: `1px solid ${DS.border}`,
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
                <tr>
                  {[
                    "#",
                    lang === "ar" ? "المساحة" : "Area",
                    lang === "ar" ? "النوع" : "Type",
                    lang === "ar" ? "حذف" : "Delete",
                  ].map((h, i) => (
                    <th key={i} style={thS}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ev.residualValueEntries.map((row: any, idx: number) => (
                  <tr key={row.id ?? idx}>
                    <td
                      style={{
                        ...tdS,
                        textAlign: "center",
                        color: DS.textMuted,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{ ...tdS, direction: "ltr", textAlign: "right" }}
                    >
                      {row.landSpace}
                    </td>
                    <td style={tdS}>
                      {row.rvlId === "1"
                        ? lang === "ar"
                          ? "أرض تطويرية"
                          : "Developmental Land"
                        : lang === "ar"
                          ? "مبنى"
                          : "Building"}
                    </td>
                    <td style={{ ...tdS, textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() =>
                          setEv((p) => ({
                            ...p,
                            residualValueEntries: p.residualValueEntries.filter(
                              (_: any, i: number) => i !== idx,
                            ),
                          }))
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: DS.red,
                          cursor: "pointer",
                          fontSize: 16,
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── DCF ─────────────────────────────────────────────────────────────────── */}
      <SectionCard
        title={
          lang === "ar"
            ? "التدفقات النقدية المخصومة (DCF)"
            : "Discounted Cash Flow (DCF)"
        }
        accentColor="#0e7490"
        icon={<BarChart2 size={14} />}
        lang={lang}

      >
        {/* Add entry form */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          {(() => {
            return (
              <>
                <Field label={lang === "ar" ? "العنوان" : "Title"}>
                  <Input
                    value={dcfForm.title}
                    onChange={(e) =>
                      setDcfForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                </Field>
                <Field
                  label={
                    lang === "ar" ? "عدد سنوات الاستثمار" : "Investment Years"
                  }
                >
                  <Input
                    type="text"
                    dir="ltr"
                    value={dcfForm.num}
                    onChange={(e) =>
                      setDcfForm((f) => ({ ...f, num: e.target.value }))
                    }
                  />
                </Field>
                <Field
                  label={
                    lang === "ar"
                      ? "تاريخ بداية الاستثمار"
                      : "Investment Start Date"
                  }
                >
                  <Input
                    type="date"
                    value={dcfForm.date}
                    onChange={(e) =>
                      setDcfForm((f) => ({ ...f, date: e.target.value }))
                    }
                  />
                </Field>
                <div style={{ paddingBottom: 2 }}>
                  <button
                    type="button"
                    disabled={!dcfForm.title}
                    onClick={() => {
                      setEv((p) => ({
                        ...p,
                        dcfEntries: [
                          ...p.dcfEntries,
                          { ...dcfForm, id: Date.now() },
                        ],
                      }));
                      setDcfForm({ title: "", num: "", date: "" });
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      background: DS.green,
                      color: "#fff",
                      border: "none",
                      borderRadius: DS.radius.md,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      opacity: !dcfForm.title ? 0.4 : 1,
                    }}
                  >
                    + {lang === "ar" ? "إضافة" : "Add"}
                  </button>
                </div>
              </>
            );
          })()}
        </div>

        {/* Entries table */}
        {ev.dcfEntries.length > 0 && (
          <div
            style={{
              overflowX: "auto",
              borderRadius: DS.radius.md,
              border: `1px solid ${DS.border}`,
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
                <tr>
                  {[
                    "#",
                    lang === "ar" ? "العنوان" : "Title",
                    lang === "ar" ? "عدد السنوات" : "Years",
                    lang === "ar" ? "تاريخ البداية" : "Start Date",
                    lang === "ar" ? "حذف" : "Delete",
                  ].map((h, i) => (
                    <th key={i} style={thS}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ev.dcfEntries.map((row: any, idx: number) => (
                  <tr
                    key={row.id ?? idx}
                    style={{
                      background: idx % 2 === 0 ? DS.surface : DS.surfaceAlt,
                    }}
                  >
                    <td
                      style={{
                        ...tdS,
                        textAlign: "center",
                        color: DS.textMuted,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td style={{ ...tdS, fontWeight: 600 }}>{row.title}</td>
                    <td
                      style={{ ...tdS, direction: "ltr", textAlign: "right" }}
                    >
                      {row.num || "—"}
                    </td>
                    <td style={tdS}>{row.date || "—"}</td>
                    <td style={{ ...tdS, textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() =>
                          setEv((p) => ({
                            ...p,
                            dcfEntries: p.dcfEntries.filter(
                              (_: any, i: number) => i !== idx,
                            ),
                          }))
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: DS.red,
                          cursor: "pointer",
                          fontSize: 16,
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Rental Value ─────────────────────────────────────────────────────────── */}
      <SectionCard
        title={lang === "ar" ? "القيمة الإيجارية" : "Rental Value"}
        accentColor="#0e7490"
        icon={<Building2 size={14} />}
        lang={lang}

      >
        {/* Add entry form */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          {(() => {
            return (
              <>
                <Field label={lang === "ar" ? "العنوان" : "Title"}>
                  <Input
                    value={rvForm.title}
                    onChange={(e) => setRvForm({ title: e.target.value })}
                  />
                </Field>
                <div style={{ paddingBottom: 2 }}>
                  <button
                    type="button"
                    disabled={!rvForm.title}
                    onClick={() => {
                      setEv((p) => ({
                        ...p,
                        rentalValueEntries: [
                          ...p.rentalValueEntries,
                          {
                            id: Date.now(),
                            title: rvForm.title,
                            lines: [],
                            // capitalization analysis fields
                            vacancyRate: "",
                            maintenanceRate: "",
                            capitalizationRate: "",
                            // market extraction comparables
                            marketComps: [],
                          },
                        ],
                      }));
                      setRvForm({ title: "" });
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      background: DS.green,
                      color: "#fff",
                      border: "none",
                      borderRadius: DS.radius.md,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      opacity: !rvForm.title ? 0.4 : 1,
                    }}
                  >
                    + {lang === "ar" ? "إضافة" : "Add"}
                  </button>
                </div>
              </>
            );
          })()}
        </div>

        {/* Render each rental value entry (mirrors the Capitalization HTML) */}
        {ev.rentalValueEntries.map((entry: any, entryIdx: number) => (
          <div
            key={entry.id ?? entryIdx}
            style={{
              border: `1px solid ${DS.border}`,
              borderRadius: DS.radius.md,
              marginBottom: 20,
              overflow: "hidden",
            }}
          >
            {/* Entry header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: DS.surfaceAlt,
                borderBottom: `1px solid ${DS.border}`,
              }}
            >
              <span
                style={{ fontWeight: 700, fontSize: 14, color: DS.primary }}
              >
                {lang === "ar" ? "المبنى:" : "Building:"} {entry.title}
              </span>
              <button
                type="button"
                onClick={() =>
                  setEv((p) => ({
                    ...p,
                    rentalValueEntries: p.rentalValueEntries.filter(
                      (_: any, i: number) => i !== entryIdx,
                    ),
                  }))
                }
                style={{
                  background: "none",
                  border: "none",
                  color: DS.red,
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "14px" }}>
              {/* Lines table */}
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: DS.radius.sm,
                  border: `1px solid ${DS.border}`,
                  marginBottom: 14,
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
                    <tr>
                      {[
                        lang === "ar" ? "النوع" : "Type",
                        lang === "ar" ? "العدد/المساحة" : "Count/Area",
                        lang === "ar" ? "سعر المتر/الوحدة" : "Price/Unit",
                        lang === "ar" ? "القيمة الإيجارية" : "Rental Value",
                        lang === "ar" ? "ملاحظات" : "Notes",
                        lang === "ar" ? "ضمن الرسملة" : "In Capitalization",
                        lang === "ar" ? "حذف" : "Delete",
                      ].map((h, i) => (
                        <th key={i} style={thS}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(entry.lines ?? []).map((line: any, lineIdx: number) => {
                      const total =
                        (parseFloat(line.space) || 0) *
                        (parseFloat(line.value) || 0) *
                        (parseFloat(line.multiplier) || 1);
                      return (
                        <tr
                          key={lineIdx}
                          style={{
                            background:
                              lineIdx % 2 === 0 ? DS.surface : DS.surfaceAlt,
                          }}
                        >
                          <td style={tdS}>
                            <input
                              type="text"
                              value={line.title ?? ""}
                              onChange={(e) => {
                                const updated = entry.lines.map(
                                  (l: any, i: number) =>
                                    i === lineIdx
                                      ? { ...l, title: e.target.value }
                                      : l,
                                );
                                setEv((p) => ({
                                  ...p,
                                  rentalValueEntries: p.rentalValueEntries.map(
                                    (en: any, i: number) =>
                                      i === entryIdx
                                        ? { ...en, lines: updated }
                                        : en,
                                  ),
                                }));
                              }}
                              style={cellInputS}
                            />
                          </td>
                          <td style={tdS}>
                            <input
                              type="text"
                              dir="ltr"
                              value={line.space ?? ""}
                              onChange={(e) => {
                                const updated = entry.lines.map(
                                  (l: any, i: number) =>
                                    i === lineIdx
                                      ? { ...l, space: e.target.value }
                                      : l,
                                );
                                setEv((p) => ({
                                  ...p,
                                  rentalValueEntries: p.rentalValueEntries.map(
                                    (en: any, i: number) =>
                                      i === entryIdx
                                        ? { ...en, lines: updated }
                                        : en,
                                  ),
                                }));
                              }}
                              style={cellInputS}
                            />
                          </td>
                          <td style={tdS}>
                            <input
                              type="text"
                              dir="ltr"
                              value={line.value ?? ""}
                              onChange={(e) => {
                                const updated = entry.lines.map(
                                  (l: any, i: number) =>
                                    i === lineIdx
                                      ? { ...l, value: e.target.value }
                                      : l,
                                );
                                setEv((p) => ({
                                  ...p,
                                  rentalValueEntries: p.rentalValueEntries.map(
                                    (en: any, i: number) =>
                                      i === entryIdx
                                        ? { ...en, lines: updated }
                                        : en,
                                  ),
                                }));
                              }}
                              style={cellInputS}
                            />
                          </td>
                          <td
                            style={{
                              ...tdS,
                              fontVariantNumeric: "tabular-nums",
                              textAlign: "right",
                              direction: "ltr",
                              fontWeight: 600,
                              color: DS.primary,
                            }}
                          >
                            {total > 0
                              ? total.toLocaleString("en-US", {
                                  maximumFractionDigits: 0,
                                })
                              : "—"}
                          </td>
                          <td style={tdS}>
                            <input
                              type="text"
                              value={line.notes ?? ""}
                              onChange={(e) => {
                                const updated = entry.lines.map(
                                  (l: any, i: number) =>
                                    i === lineIdx
                                      ? { ...l, notes: e.target.value }
                                      : l,
                                );
                                setEv((p) => ({
                                  ...p,
                                  rentalValueEntries: p.rentalValueEntries.map(
                                    (en: any, i: number) =>
                                      i === entryIdx
                                        ? { ...en, lines: updated }
                                        : en,
                                  ),
                                }));
                              }}
                              style={cellInputS}
                            />
                          </td>
                          <td style={{ ...tdS, textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={line.inCapitalization ?? true}
                              onChange={(e) => {
                                const updated = entry.lines.map(
                                  (l: any, i: number) =>
                                    i === lineIdx
                                      ? {
                                          ...l,
                                          inCapitalization: e.target.checked,
                                        }
                                      : l,
                                );
                                setEv((p) => ({
                                  ...p,
                                  rentalValueEntries: p.rentalValueEntries.map(
                                    (en: any, i: number) =>
                                      i === entryIdx
                                        ? { ...en, lines: updated }
                                        : en,
                                  ),
                                }));
                              }}
                              style={{ accentColor: DS.primary }}
                            />
                          </td>
                          <td style={{ ...tdS, textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = entry.lines.filter(
                                  (_: any, i: number) => i !== lineIdx,
                                );
                                setEv((p) => ({
                                  ...p,
                                  rentalValueEntries: p.rentalValueEntries.map(
                                    (en: any, i: number) =>
                                      i === entryIdx
                                        ? { ...en, lines: updated }
                                        : en,
                                  ),
                                }));
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: DS.red,
                                cursor: "pointer",
                                fontSize: 15,
                              }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: DS.surfaceAlt }}>
                      <td colSpan={3} style={{ ...tdS, fontWeight: 700 }}>
                        {lang === "ar" ? "المجموع" : "Total"}
                      </td>
                      <td
                        colSpan={4}
                        style={{
                          ...tdS,
                          fontWeight: 700,
                          color: DS.primary,
                          direction: "ltr",
                          textAlign: "right",
                        }}
                      >
                        {(entry.lines ?? [])
                          .reduce(
                            (s: number, l: any) =>
                              s +
                              (parseFloat(l.space) || 0) *
                                (parseFloat(l.value) || 0) *
                                (parseFloat(l.multiplier) || 1),
                            0,
                          )
                          .toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Add line button */}
              <button
                type="button"
                onClick={() => {
                  const newLine = {
                    title: "",
                    space: "",
                    value: "",
                    notes: "",
                    inCapitalization: true,
                    multiplier: "1",
                  };
                  setEv((p) => ({
                    ...p,
                    rentalValueEntries: p.rentalValueEntries.map(
                      (en: any, i: number) =>
                        i === entryIdx
                          ? { ...en, lines: [...(en.lines ?? []), newLine] }
                          : en,
                    ),
                  }));
                }}
                style={{ ...linkBtnS, color: DS.green }}
              >
                + {lang === "ar" ? "بند جديد" : "New Line"}
              </button>

              {/* Capitalization analysis */}
              <div
                style={{
                  marginTop: 16,
                  borderTop: `1px solid ${DS.border}`,
                  paddingTop: 14,
                }}
              >
                {/* Market extraction comparables */}
                <h6
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: DS.primary,
                    marginBottom: 10,
                  }}
                >
                  {lang === "ar"
                    ? "طريقة الاستخلاص من السوق:"
                    : "Market Extraction Method:"}
                </h6>
                <div
                  style={{
                    overflowX: "auto",
                    borderRadius: DS.radius.sm,
                    border: `1px solid ${DS.border}`,
                    marginBottom: 10,
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
                      <tr>
                        {[
                          lang === "ar" ? "البند" : "Item",
                          lang === "ar" ? "دخل العقار" : "Property Income",
                          lang === "ar" ? "قيمة العقار" : "Property Value",
                          lang === "ar" ? "معدل الرسملة" : "Cap Rate",
                          lang === "ar" ? "ملاحظات" : "Notes",
                          lang === "ar" ? "حذف" : "Delete",
                        ].map((h, i) => (
                          <th key={i} style={thS}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(entry.marketComps ?? []).map(
                        (comp: any, compIdx: number) => {
                          const capRate =
                            comp.propertyValue && comp.income
                              ? (
                                  (parseFloat(comp.income) /
                                    parseFloat(comp.propertyValue)) *
                                  100
                                ).toFixed(2)
                              : "—";
                          return (
                            <tr
                              key={compIdx}
                              style={{
                                background:
                                  compIdx % 2 === 0
                                    ? DS.surface
                                    : DS.surfaceAlt,
                              }}
                            >
                              <td style={tdS}>
                                <input
                                  type="text"
                                  value={comp.title ?? ""}
                                  onChange={(e) => {
                                    const u = entry.marketComps.map(
                                      (c: any, i: number) =>
                                        i === compIdx
                                          ? { ...c, title: e.target.value }
                                          : c,
                                    );
                                    setEv((p) => ({
                                      ...p,
                                      rentalValueEntries:
                                        p.rentalValueEntries.map(
                                          (en: any, i: number) =>
                                            i === entryIdx
                                              ? { ...en, marketComps: u }
                                              : en,
                                        ),
                                    }));
                                  }}
                                  style={cellInputS}
                                />
                              </td>
                              <td style={tdS}>
                                <input
                                  type="text"
                                  dir="ltr"
                                  value={comp.income ?? ""}
                                  onChange={(e) => {
                                    const u = entry.marketComps.map(
                                      (c: any, i: number) =>
                                        i === compIdx
                                          ? { ...c, income: e.target.value }
                                          : c,
                                    );
                                    setEv((p) => ({
                                      ...p,
                                      rentalValueEntries:
                                        p.rentalValueEntries.map(
                                          (en: any, i: number) =>
                                            i === entryIdx
                                              ? { ...en, marketComps: u }
                                              : en,
                                        ),
                                    }));
                                  }}
                                  style={cellInputS}
                                />
                              </td>
                              <td style={tdS}>
                                <input
                                  type="text"
                                  dir="ltr"
                                  value={comp.propertyValue ?? ""}
                                  onChange={(e) => {
                                    const u = entry.marketComps.map(
                                      (c: any, i: number) =>
                                        i === compIdx
                                          ? {
                                              ...c,
                                              propertyValue: e.target.value,
                                            }
                                          : c,
                                    );
                                    setEv((p) => ({
                                      ...p,
                                      rentalValueEntries:
                                        p.rentalValueEntries.map(
                                          (en: any, i: number) =>
                                            i === entryIdx
                                              ? { ...en, marketComps: u }
                                              : en,
                                        ),
                                    }));
                                  }}
                                  style={cellInputS}
                                />
                              </td>
                              <td
                                style={{
                                  ...tdS,
                                  fontWeight: 600,
                                  color: DS.primary,
                                  textAlign: "center",
                                }}
                              >
                                {capRate}
                                {capRate !== "—" ? "%" : ""}
                              </td>
                              <td style={tdS}>
                                <input
                                  type="text"
                                  value={comp.notes ?? ""}
                                  onChange={(e) => {
                                    const u = entry.marketComps.map(
                                      (c: any, i: number) =>
                                        i === compIdx
                                          ? { ...c, notes: e.target.value }
                                          : c,
                                    );
                                    setEv((p) => ({
                                      ...p,
                                      rentalValueEntries:
                                        p.rentalValueEntries.map(
                                          (en: any, i: number) =>
                                            i === entryIdx
                                              ? { ...en, marketComps: u }
                                              : en,
                                        ),
                                    }));
                                  }}
                                  style={cellInputS}
                                />
                              </td>
                              <td style={{ ...tdS, textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const u = entry.marketComps.filter(
                                      (_: any, i: number) => i !== compIdx,
                                    );
                                    setEv((p) => ({
                                      ...p,
                                      rentalValueEntries:
                                        p.rentalValueEntries.map(
                                          (en: any, i: number) =>
                                            i === entryIdx
                                              ? { ...en, marketComps: u }
                                              : en,
                                        ),
                                    }));
                                  }}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: DS.red,
                                    cursor: "pointer",
                                    fontSize: 15,
                                  }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newComp = {
                      title: "",
                      income: "",
                      propertyValue: "",
                      notes: "",
                    };
                    setEv((p) => ({
                      ...p,
                      rentalValueEntries: p.rentalValueEntries.map(
                        (en: any, i: number) =>
                          i === entryIdx
                            ? {
                                ...en,
                                marketComps: [
                                  ...(en.marketComps ?? []),
                                  newComp,
                                ],
                              }
                            : en,
                      ),
                    }));
                  }}
                  style={{ ...linkBtnS, color: DS.green, marginBottom: 14 }}
                >
                  + {lang === "ar" ? "بند جديد" : "New Item"}
                </button>

                {/* Capitalization calculator */}
                <div
                  style={{
                    background: DS.surfaceAlt,
                    border: `1px solid ${DS.border}`,
                    borderRadius: DS.radius.md,
                    padding: 14,
                  }}
                >
                  {(() => {
                    const totalRental = (entry.lines ?? [])
                      .filter((l: any) => l.inCapitalization !== false)
                      .reduce(
                        (s: number, l: any) =>
                          s +
                          (parseFloat(l.space) || 0) *
                            (parseFloat(l.value) || 0) *
                            (parseFloat(l.multiplier) || 1),
                        0,
                      );
                    const vacancyAmt =
                      totalRental * (parseFloat(entry.vacancyRate) / 100 || 0);
                    const actualIncome = totalRental - vacancyAmt;
                    const maintenanceAmt =
                      actualIncome *
                      (parseFloat(entry.maintenanceRate) / 100 || 0);
                    const noi = actualIncome - maintenanceAmt;
                    const capRate = parseFloat(entry.capitalizationRate) || 0;
                    const propertyValue =
                      capRate > 0 ? noi / (capRate / 100) : 0;

                    const updateEntry = (field: string, val: string) =>
                      setEv((p) => ({
                        ...p,
                        rentalValueEntries: p.rentalValueEntries.map(
                          (en: any, i: number) =>
                            i === entryIdx ? { ...en, [field]: val } : en,
                        ),
                      }));

                    return (
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 13,
                        }}
                      >
                        <tbody>
                          {[
                            {
                              label:
                                lang === "ar"
                                  ? "إجمالي دخل العقار المتوقع"
                                  : "Expected Gross Income",
                              value: totalRental.toLocaleString("en-US", {
                                maximumFractionDigits: 0,
                              }),
                              readOnly: true,
                              field: null,
                            },
                            {
                              label:
                                lang === "ar"
                                  ? "خسائر الاشغار (%)"
                                  : "Vacancy Loss (%)",
                              value: entry.vacancyRate ?? "",
                              readOnly: false,
                              field: "vacancyRate",
                            },
                            {
                              label:
                                lang === "ar"
                                  ? "إجمالي الدخل الفعلي"
                                  : "Effective Gross Income",
                              value: actualIncome.toLocaleString("en-US", {
                                maximumFractionDigits: 0,
                              }),
                              readOnly: true,
                              field: null,
                            },
                            {
                              label:
                                lang === "ar"
                                  ? "نسبة الصيانة والتشغيل (%)"
                                  : "Operating Expense Ratio (%)",
                              value: entry.maintenanceRate ?? "",
                              readOnly: false,
                              field: "maintenanceRate",
                            },
                            {
                              label:
                                lang === "ar"
                                  ? "صافي الدخل التشغيلي"
                                  : "Net Operating Income",
                              value: noi.toLocaleString("en-US", {
                                maximumFractionDigits: 0,
                              }),
                              readOnly: true,
                              field: null,
                            },
                            {
                              label:
                                lang === "ar"
                                  ? "معدل الرسملة (%)"
                                  : "Capitalization Rate (%)",
                              value: entry.capitalizationRate ?? "",
                              readOnly: false,
                              field: "capitalizationRate",
                            },
                            {
                              label:
                                lang === "ar"
                                  ? "قيمة العقار"
                                  : "Property Value",
                              value:
                                propertyValue > 0
                                  ? propertyValue.toLocaleString("en-US", {
                                      maximumFractionDigits: 0,
                                    })
                                  : "—",
                              readOnly: true,
                              field: null,
                              highlight: true,
                            },
                          ].map(
                            (
                              { label, value, readOnly, field, highlight },
                              ri,
                            ) => (
                              <tr
                                key={ri}
                                style={{
                                  background: highlight
                                    ? DS.primaryLight
                                    : ri % 2 === 0
                                      ? DS.surface
                                      : DS.surfaceAlt,
                                }}
                              >
                                <td
                                  style={{
                                    ...tdS,
                                    fontWeight: 600,
                                    color: highlight ? DS.primary : DS.text,
                                  }}
                                >
                                  {label}
                                </td>
                                <td style={tdS}>
                                  {readOnly ? (
                                    <div
                                      style={{
                                        padding: "5px 8px",
                                        fontVariantNumeric: "tabular-nums",
                                        direction: "ltr",
                                        textAlign: "right",
                                        fontWeight: highlight ? 700 : 500,
                                        color: highlight ? DS.primary : DS.text,
                                        fontSize: highlight ? 14 : 13,
                                      }}
                                    >
                                      {value}
                                    </div>
                                  ) : (
                                    <input
                                      type="text"
                                      dir="ltr"
                                      value={value}
                                      onChange={(e) =>
                                        field &&
                                        updateEntry(field, e.target.value)
                                      }
                                      style={{
                                        ...cellInputS,
                                        textAlign: "right",
                                      }}
                                    />
                                  )}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        ))}
            </SectionCard>

            </>
            )}
            {activeStep === 10 && (
            <>

      {/* ── Valuation Methods ────────────────────────────────────────────────────── */}
      <SectionCard title={t.secMethods} icon={<BarChart2 size={14} />} lang={lang}
>
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
            {/* ── All comparison rows table ── */}
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
              {lang === "ar" ? "عروض المقارنة:" : "Comparable Properties:"}
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
                      lang === "ar" ? "التاريخ" : "Date",
                      lang === "ar" ? "النوع" : "Type",
                      lang === "ar" ? "نوع المقارنة" : "Kind",
                      lang === "ar" ? "المساحة (م²)" : "Area (m²)",
                      lang === "ar" ? "سعر المتر" : "Meter Price",
                      lang === "ar" ? "الإجمالي" : "Total",
                      lang === "ar" ? "الوصف / البُعد" : "Description",
                      lang === "ar" ? "المصدر" : "Source",
                      lang === "ar" ? "تضمين" : "Include",
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
                        colSpan={10}
                        style={{
                          ...tdS,
                          textAlign: "center",
                          color: DS.textLight,
                          padding: 20,
                        }}
                      >
                        {lang === "ar"
                          ? "لا توجد بيانات"
                          : "No comparisons added yet"}
                      </td>
                    </tr>
                  ) : (
                    ev.comparisonRows.map((row: any, idx: number) => {
                      const isIncluded = row.inReport !== false;
                      const meterPrice = parseFloat(row.price) || 0;
                      const area = parseFloat(row.landSpace) || 0;
                      const total = row.total
                        ? parseFloat(row.total)
                        : meterPrice * area || 0;
                      return (
                        <tr
                          key={idx}
                          style={{
                            background: !isIncluded
                              ? "#fafafa"
                              : idx % 2 === 0
                                ? DS.surface
                                : DS.surfaceAlt,
                            opacity: isIncluded ? 1 : 0.5,
                          }}
                        >
                          <td
                            style={{
                              ...tdS,
                              textAlign: "center",
                              fontWeight: 600,
                              color: DS.textMuted,
                              width: 28,
                            }}
                          >
                            {idx + 1}
                          </td>
                          <td style={tdS}>{row.evalDate || "—"}</td>
                          <td style={tdS}>
                            {row.propertyTypeId
                              ? ((
                                  {
                                    "1": lang === "ar" ? "أرض" : "Land",
                                    "2": lang === "ar" ? "شقة" : "Apartment",
                                    "3":
                                      lang === "ar"
                                        ? "فيلا سكنية"
                                        : "Residential Villa",
                                    "4": lang === "ar" ? "عمارة" : "Building",
                                    "5":
                                      lang === "ar" ? "إستراحة" : "Rest House",
                                    "6": lang === "ar" ? "مزرعة" : "Farm",
                                    "7": lang === "ar" ? "مستودع" : "Warehouse",
                                    "9": lang === "ar" ? "محل تجاري" : "Shop",
                                    "10": lang === "ar" ? "دور" : "Floor",
                                    "21":
                                      lang === "ar"
                                        ? "أرض سكنية"
                                        : "Residential Land",
                                    "22":
                                      lang === "ar"
                                        ? "أرض تجارية"
                                        : "Commercial Land",
                                    "24": lang === "ar" ? "فندق" : "Hotel",
                                    "28":
                                      lang === "ar"
                                        ? "مبنى تجاري"
                                        : "Commercial Building",
                                    "67":
                                      lang === "ar"
                                        ? "عمارة سكنية"
                                        : "Residential Building",
                                  } as Record<string, string>
                                )[row.propertyTypeId] ?? row.propertyTypeId)
                              : "—"}
                          </td>
                          <td style={tdS}>{row.comparisonKind || "—"}</td>
                          <td
                            style={{
                              ...tdS,
                              fontVariantNumeric: "tabular-nums",
                              textAlign: "right",
                              direction: "ltr",
                            }}
                          >
                            {area > 0
                              ? area.toLocaleString("en-US", {
                                  maximumFractionDigits: 2,
                                })
                              : "—"}
                          </td>
                          <td
                            style={{
                              ...tdS,
                              fontWeight: 600,
                              fontVariantNumeric: "tabular-nums",
                              textAlign: "right",
                              direction: "ltr",
                              color: DS.primary,
                            }}
                          >
                            {meterPrice > 0
                              ? meterPrice.toLocaleString("en-US", {
                                  maximumFractionDigits: 2,
                                })
                              : "—"}
                          </td>
                          <td
                            style={{
                              ...tdS,
                              fontVariantNumeric: "tabular-nums",
                              textAlign: "right",
                              direction: "ltr",
                            }}
                          >
                            {total > 0
                              ? total.toLocaleString("en-US", {
                                  maximumFractionDigits: 0,
                                })
                              : "—"}
                          </td>
                          <td style={tdS}>{row.description || "—"}</td>
                          <td style={tdS}>{row.source || "—"}</td>
                          <td style={{ ...tdS, textAlign: "center" }}>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                background: isIncluded
                                  ? DS.primary
                                  : DS.surfaceAlt,
                                border: `2px solid ${isIncluded ? DS.primary : DS.borderStrong}`,
                              }}
                            >
                              {isIncluded && (
                                <Check size={11} color="#fff" strokeWidth={3} />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Summary by type ── */}
            {ev.comparisonRows.some(
              (r: any) => r.inReport !== false && parseFloat(r.price) > 0,
            ) && (
              <>
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
                  {lang === "ar"
                    ? "ملخص المقارنات (حسب النوع):"
                    : "Comparables Summary (by Type):"}
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
                      <tr>
                        {[
                          "#",
                          t.landUse,
                          lang === "ar" ? "عدد المقارنات" : "# Comparables",
                          lang === "ar" ? "متوسط سعر المتر" : "Avg Meter Price",
                          t.marketWeightPct,
                          lang === "ar"
                            ? "سعر المتر الموزون"
                            : "Weighted Meter Price",
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
                      {(() => {
                        type GroupAcc = {
                          count: number;
                          totalPrice: number;
                          totalArea: number;
                          typeLabel: string;
                        };
                        const groups: Record<string, GroupAcc> = {};
                        ev.comparisonRows.forEach((row: any) => {
                          if (row.inReport === false) return;
                          const price = parseFloat(row.price) || 0;
                          if (price <= 0) return;
                          const key = row.propertyTypeId || "general";
                          const typeLabel = row.propertyTypeId
                            ? ((
                                {
                                  "1": lang === "ar" ? "أرض" : "Land",
                                  "2": lang === "ar" ? "شقة" : "Apartment",
                                  "21":
                                    lang === "ar"
                                      ? "أرض سكنية"
                                      : "Residential Land",
                                  "22":
                                    lang === "ar"
                                      ? "أرض تجارية"
                                      : "Commercial Land",
                                  "67":
                                    lang === "ar"
                                      ? "عمارة سكنية"
                                      : "Residential Building",
                                } as Record<string, string>
                              )[row.propertyTypeId] ?? row.propertyTypeId)
                            : lang === "ar"
                              ? "عام"
                              : "General";
                          if (!groups[key])
                            groups[key] = {
                              count: 0,
                              totalPrice: 0,
                              totalArea: 0,
                              typeLabel,
                            };
                          groups[key].count += 1;
                          groups[key].totalPrice += price;
                          groups[key].totalArea +=
                            parseFloat(row.landSpace) || 0;
                        });
                        return Object.entries(groups).map(([key, g], idx) => {
                          const avgMeter =
                            g.count > 0 ? g.totalPrice / g.count : 0;
                          const weightPct = 100 / Object.keys(groups).length;
                          const weightedMeter = avgMeter * (weightPct / 100);
                          const propertyArea =
                            parseFloat(ev.assetInfo.propertyArea) || 0;
                          const total = weightedMeter * propertyArea;
                          return (
                            <tr key={key}>
                              <td style={tdS}>{idx + 1}</td>
                              <td style={tdS}>{g.typeLabel}</td>
                              <td style={{ ...tdS, textAlign: "center" }}>
                                {g.count}
                              </td>
                              <td
                                style={{
                                  ...tdS,
                                  fontWeight: 600,
                                  fontVariantNumeric: "tabular-nums",
                                  direction: "ltr",
                                  textAlign: "right",
                                }}
                              >
                                {avgMeter.toFixed(2)}
                              </td>
                              <td style={{ ...tdS, textAlign: "center" }}>
                                {weightPct.toFixed(1)}%
                              </td>
                              <td
                                style={{
                                  ...tdS,
                                  fontWeight: 600,
                                  direction: "ltr",
                                  textAlign: "right",
                                }}
                              >
                                {weightedMeter.toFixed(2)}
                              </td>
                              <td
                                style={{
                                  ...tdS,
                                  fontWeight: 600,
                                  direction: "ltr",
                                  textAlign: "right",
                                }}
                              >
                                {total > 0
                                  ? total.toLocaleString("en-US", {
                                      maximumFractionDigits: 2,
                                    })
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
                                  {[
                                    lang === "ar" ? "المقارنات" : "Comparisons",
                                    lang === "ar" ? "التسويات" : "Settlements",
                                    lang === "ar" ? "وحدات" : "Units",
                                  ].map((label, li) => (
                                    <React.Fragment key={li}>
                                      {li > 0 && (
                                        <span
                                          style={{
                                            color: DS.borderStrong,
                                            fontSize: 11,
                                          }}
                                        >
                                          |
                                        </span>
                                      )}
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
                                        {label}
                                      </label>
                                    </React.Fragment>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── Calculator ── */}
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

            {/* Auto-filled hint banner */}
            {settlNetMeter > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: DS.radius.md,
                  background: DS.primaryLight,
                  border: `1px solid ${DS.primary}25`,
                  marginBottom: 14,
                  fontSize: 12,
                  color: DS.primary,
                  fontWeight: 500,
                }}
              >
                <Info size={13} />
                {lang === "ar"
                  ? `تم احتساب صافي سعر المتر تلقائياً من جدول التسويات: ${settlNetMeter.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ريال/م²`
                  : `Net meter price auto-calculated from settlement table: ${settlNetMeter.toLocaleString("en-US", { maximumFractionDigits: 2 })} SAR/m²`}
              </div>
            )}

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
                <div style={{ position: "relative" }}>
                  <Input
                    value={ev.methodsMarket.marketMeterPrice}
                    onChange={(e) =>
                      setField(
                        "methodsMarket",
                        "marketMeterPrice",
                        e.target.value,
                      )
                    }
                    placeholder={
                      settlNetMeter > 0 ? settlNetMeter.toFixed(2) : "0.00"
                    }
                  />
                  {settlNetMeter > 0 && !ev.methodsMarket.marketMeterPrice && (
                    <button
                      type="button"
                      onClick={() =>
                        setField(
                          "methodsMarket",
                          "marketMeterPrice",
                          settlNetMeter.toFixed(2),
                        )
                      }
                      style={{
                        position: "absolute",
                        insetInlineEnd: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 10,
                        padding: "2px 6px",
                        background: `${DS.primary}15`,
                        border: `1px solid ${DS.primary}30`,
                        borderRadius: DS.radius.sm,
                        color: DS.primary,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {lang === "ar" ? "تعبئة" : "Fill"}
                    </button>
                  )}
                </div>
              </Field>
              <Field label={t.propertyAreaMethod}>
                <div style={{ position: "relative" }}>
                  <Input
                    value={ev.methodsMarket.propertyAreaMethod}
                    onChange={(e) =>
                      setField(
                        "methodsMarket",
                        "propertyAreaMethod",
                        e.target.value,
                      )
                    }
                    placeholder={ev.assetInfo.propertyArea || "0.00"}
                  />
                  {ev.assetInfo.propertyArea &&
                    !ev.methodsMarket.propertyAreaMethod && (
                      <button
                        type="button"
                        onClick={() =>
                          setField(
                            "methodsMarket",
                            "propertyAreaMethod",
                            ev.assetInfo.propertyArea,
                          )
                        }
                        style={{
                          position: "absolute",
                          insetInlineEnd: 6,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 10,
                          padding: "2px 6px",
                          background: `${DS.primary}15`,
                          border: `1px solid ${DS.primary}30`,
                          borderRadius: DS.radius.sm,
                          color: DS.primary,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lang === "ar" ? "تعبئة" : "Fill"}
                      </button>
                    )}
                </div>
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
                        ).toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })
                      : ev.methodsMarket.marketMethodTotal
                  }
                />
              </Field>
              <Field label={t.marketWeightPct}>
                <Input
                  value={ev.methodsMarket.marketWeightPct}
                  onChange={(e) =>
                    setField("methodsMarket", "marketWeightPct", e.target.value)
                  }
                  placeholder="100"
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

            {/* Auto-fill notice */}
            {(repDerived.netAsset > 0 || repDerived.landDataTotal > 0) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: DS.radius.md,
                  background: DS.primaryLight,
                  border: `1px solid ${DS.primary}25`,
                  marginBottom: 14,
                  fontSize: 12,
                  color: DS.primary,
                  fontWeight: 500,
                }}
              >
                <Info size={13} />
                {lang === "ar"
                  ? "القيم أدناه محسوبة تلقائياً من قسم تكلفة الإحلال أعلاه."
                  : "Values below are auto-calculated from the Replacement Cost section above."}
              </div>
            )}

            {/* Replacement lines summary table */}
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
                      lang === "ar" ? "الاسم" : "Name",
                      lang === "ar" ? "المساحة (م²)" : "Area (m²)",
                      lang === "ar" ? "سعر الوحدة" : "Unit Price",
                      lang === "ar" ? "قيمة المبنى" : "Building Value",
                      lang === "ar" ? "ملاحظات" : "Notes",
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
                        colSpan={7}
                        style={{
                          ...tdS,
                          textAlign: "center",
                          color: DS.textLight,
                          padding: 20,
                        }}
                      >
                        {lang === "ar"
                          ? "لا توجد بيانات — أضف بنوداً في قسم تكلفة الإحلال"
                          : "No data — add items in the Replacement Cost section"}
                      </td>
                    </tr>
                  ) : (
                    ev.replacementLines
                      .filter((l: any) => l.title || l.total)
                      .map((line: any, idx: number) => {
                        const space = parseFloat(line.space) || 0;
                        const unit = parseFloat(line.unitPrice) || 0;
                        const total =
                          parseFloat(line.total || "0") ||
                          (line.useSpace !== false ? space * unit : unit);
                        return (
                          <tr
                            key={idx}
                            style={{
                              background:
                                idx % 2 === 0 ? DS.surface : DS.surfaceAlt,
                            }}
                          >
                            <td
                              style={{
                                ...tdS,
                                textAlign: "center",
                                color: DS.textMuted,
                                width: 28,
                              }}
                            >
                              {idx + 1}
                            </td>
                            <td style={tdS}>
                              {line.title ||
                                `${lang === "ar" ? "بند" : "Line"} ${idx + 1}`}
                            </td>
                            <td
                              style={{
                                ...tdS,
                                fontVariantNumeric: "tabular-nums",
                                direction: "ltr",
                                textAlign: "right",
                              }}
                            >
                              {space > 0
                                ? space.toLocaleString("en-US", {
                                    maximumFractionDigits: 2,
                                  })
                                : "—"}
                            </td>
                            <td
                              style={{
                                ...tdS,
                                fontVariantNumeric: "tabular-nums",
                                direction: "ltr",
                                textAlign: "right",
                              }}
                            >
                              {unit > 0
                                ? unit.toLocaleString("en-US", {
                                    maximumFractionDigits: 2,
                                  })
                                : "—"}
                            </td>
                            <td
                              style={{
                                ...tdS,
                                fontWeight: 600,
                                fontVariantNumeric: "tabular-nums",
                                direction: "ltr",
                                textAlign: "right",
                                color: DS.primary,
                              }}
                            >
                              {total > 0
                                ? total.toLocaleString("en-US", {
                                    maximumFractionDigits: 2,
                                  })
                                : "—"}
                            </td>
                            <td style={tdS}>{line.notes || "—"}</td>
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
                                {[
                                  lang === "ar" ? "المسطحات" : "Areas",
                                  lang === "ar" ? "الإحلال" : "Replacement",
                                  lang === "ar" ? "أعداد" : "Count",
                                ].map((label, li) => (
                                  <React.Fragment key={li}>
                                    {li > 0 && (
                                      <span
                                        style={{
                                          color: DS.borderStrong,
                                          fontSize: 11,
                                        }}
                                      >
                                        |
                                      </span>
                                    )}
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
                                      {label}
                                    </label>
                                  </React.Fragment>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            {/* KPI strip from replacement calc */}
            {repDerived.netAsset > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 10,
                  marginBottom: 20,
                  padding: "14px",
                  background: DS.surfaceAlt,
                  borderRadius: DS.radius.md,
                  border: `1px solid ${DS.border}`,
                }}
              >
                {[
                  {
                    label: lang === "ar" ? "إجمالي المساحة" : "Total Area",
                    value: `${repDerived.totalArea.toLocaleString("en-US", { maximumFractionDigits: 2 })} م²`,
                  },
                  {
                    label:
                      lang === "ar"
                        ? "إجمالي قيمة الأصل (مباشر)"
                        : "Total Asset Value (Direct)",
                    value: repDerived.totalVal.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    }),
                  },
                  {
                    label: t.costNetBuildings,
                    value: repDerived.netAsset.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    }),
                    accent: true,
                  },
                  {
                    label: t.costNetLandPrice,
                    value: repDerived.landDataTotal.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    }),
                  },
                  {
                    label: t.costLandBuildTotal,
                    value: repDerived.landAsset.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    }),
                    accent: true,
                  },
                  {
                    label: lang === "ar" ? "صافي سعر المتر" : "Net Meter Price",
                    value: repDerived.netMeter.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    }),
                  },
                ].map(({ label, value, accent }, ki) => (
                  <div
                    key={ki}
                    style={{
                      background: "#fff",
                      borderRadius: DS.radius.md,
                      padding: "10px 12px",
                      border: `1px solid ${accent ? DS.primary + "40" : DS.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: DS.textLight,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: accent ? DS.primary : DS.text,
                        direction: "ltr",
                        textAlign: isRtl ? "right" : "left",
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                <div style={{ position: "relative" }}>
                  <Input
                    value={ev.methodsCost.costNetBuildings}
                    onChange={(e) =>
                      setField(
                        "methodsCost",
                        "costNetBuildings",
                        e.target.value,
                      )
                    }
                    placeholder={
                      repDerived.netAsset > 0
                        ? repDerived.netAsset.toFixed(2)
                        : "0.00"
                    }
                  />
                  {repDerived.netAsset > 0 &&
                    !ev.methodsCost.costNetBuildings && (
                      <button
                        type="button"
                        onClick={() =>
                          setField(
                            "methodsCost",
                            "costNetBuildings",
                            repDerived.netAsset.toFixed(2),
                          )
                        }
                        style={{
                          position: "absolute",
                          insetInlineEnd: 6,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 10,
                          padding: "2px 6px",
                          background: `${DS.primary}15`,
                          border: `1px solid ${DS.primary}30`,
                          borderRadius: DS.radius.sm,
                          color: DS.primary,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lang === "ar" ? "تعبئة" : "Fill"}
                      </button>
                    )}
                </div>
              </Field>
              <Field label={t.costNetLandPrice}>
                <div style={{ position: "relative" }}>
                  <Input
                    value={ev.methodsCost.costNetLandPrice}
                    onChange={(e) =>
                      setField(
                        "methodsCost",
                        "costNetLandPrice",
                        e.target.value,
                      )
                    }
                    placeholder={
                      repDerived.landDataTotal > 0
                        ? repDerived.landDataTotal.toFixed(2)
                        : "0.00"
                    }
                  />
                  {repDerived.landDataTotal > 0 &&
                    !ev.methodsCost.costNetLandPrice && (
                      <button
                        type="button"
                        onClick={() =>
                          setField(
                            "methodsCost",
                            "costNetLandPrice",
                            repDerived.landDataTotal.toFixed(2),
                          )
                        }
                        style={{
                          position: "absolute",
                          insetInlineEnd: 6,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 10,
                          padding: "2px 6px",
                          background: `${DS.primary}15`,
                          border: `1px solid ${DS.primary}30`,
                          borderRadius: DS.radius.sm,
                          color: DS.primary,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lang === "ar" ? "تعبئة" : "Fill"}
                      </button>
                    )}
                </div>
              </Field>
              <Field label={t.costLandBuildTotal}>
                <Input
                  readOnly
                  value={
                    ev.methodsCost.costNetBuildings ||
                    ev.methodsCost.costNetLandPrice
                      ? (
                          (parseFloat(ev.methodsCost.costNetBuildings) ||
                            repDerived.netAsset) +
                          (parseFloat(ev.methodsCost.costNetLandPrice) ||
                            repDerived.landDataTotal)
                        ).toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })
                      : repDerived.landAsset > 0
                        ? repDerived.landAsset.toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })
                        : ev.methodsCost.costLandBuildTotal
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
                  {ev.investmentEntries.length === 0 ? (
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
                    ev.investmentEntries.map((entry: any, idx: number) => {
                      const capLines = entry.lines ?? [];
                      const capIncludedIncome = capLines
                        .filter((l: any) => l.inCapitalization !== false)
                        .reduce(
                          (s: number, l: any) =>
                            s +
                            (parseFloat(l.space) || 0) *
                              (parseFloat(l.value) || 0),
                          0,
                        );
                      const vacancyAmt =
                        capIncludedIncome *
                        (parseFloat(entry.vacancyRate) / 100 || 0);
                      const effectiveIncome = capIncludedIncome - vacancyAmt;
                      const maintenanceAmt =
                        effectiveIncome *
                        (parseFloat(entry.maintenanceRate) / 100 || 0);
                      const noi = effectiveIncome - maintenanceAmt;
                      const capRate = parseFloat(entry.capitalizationRate) || 0;
                      const propertyValue =
                        capRate > 0 ? noi / (capRate / 100) : 0;

                      return (
                        <tr
                          key={entry.id ?? idx}
                          style={{
                            background:
                              idx % 2 === 0 ? DS.surface : DS.surfaceAlt,
                          }}
                        >
                          <td style={{ ...tdS, fontWeight: 600 }}>
                            {entry.title}
                          </td>
                          <td
                            style={{
                              ...tdS,
                              fontWeight: 600,
                              fontVariantNumeric: "tabular-nums",
                              direction: "ltr",
                              textAlign: "right",
                              color: DS.primary,
                            }}
                          >
                            {propertyValue > 0
                              ? propertyValue.toLocaleString("en-US", {
                                  maximumFractionDigits: 0,
                                })
                              : capRate === 0
                                ? lang === "ar"
                                  ? "معدل الرسملة غير محدد"
                                  : "Cap rate not set"
                                : "—"}
                          </td>
                          <td style={{ ...tdS, textAlign: "center" }}>
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
                      );
                    })
                  )}
                </tbody>
                {ev.investmentEntries.length > 1 && (
                  <tfoot>
                    <tr style={{ background: DS.surfaceAlt }}>
                      <td style={{ ...tdS, fontWeight: 700 }}>
                        {lang === "ar" ? "الإجمالي" : "Total"}
                      </td>
                      <td
                        style={{
                          ...tdS,
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          direction: "ltr",
                          textAlign: "right",
                          color: DS.primary,
                        }}
                      >
                        {investmentTotal > 0
                          ? investmentTotal.toLocaleString("en-US", {
                              maximumFractionDigits: 0,
                            })
                          : "—"}
                      </td>
                      <td style={tdS} />
                    </tr>
                  </tfoot>
                )}
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

            {investmentTotal > 0 && !ev.methodsIncome.incomeTotal && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: DS.radius.md,
                  background: DS.primaryLight,
                  border: `1px solid ${DS.primary}25`,
                  marginBottom: 14,
                  fontSize: 12,
                  color: DS.primary,
                  fontWeight: 500,
                }}
              >
                <Info size={13} />
                {lang === "ar"
                  ? `تم احتساب إجمالي الدخل تلقائياً من قسم الاستثمار: ${investmentTotal.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ريال`
                  : `Total income auto-calculated from Investment section: ${investmentTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })} SAR`}
              </div>
            )}

            <GridFields tight>
              <Field label={t.incomeTotal}>
                <div style={{ position: "relative" }}>
                  <Input
                    value={ev.methodsIncome.incomeTotal}
                    onChange={(e) =>
                      setField("methodsIncome", "incomeTotal", e.target.value)
                    }
                    placeholder={
                      investmentTotal > 0
                        ? investmentTotal.toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })
                        : "0"
                    }
                  />
                  {investmentTotal > 0 && !ev.methodsIncome.incomeTotal && (
                    <button
                      type="button"
                      onClick={() =>
                        setField(
                          "methodsIncome",
                          "incomeTotal",
                          investmentTotal.toFixed(0),
                        )
                      }
                      style={{
                        position: "absolute",
                        insetInlineEnd: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 10,
                        padding: "2px 6px",
                        background: `${DS.primary}15`,
                        border: `1px solid ${DS.primary}30`,
                        borderRadius: DS.radius.sm,
                        color: DS.primary,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {lang === "ar" ? "تعبئة" : "Fill"}
                    </button>
                  )}
                </div>
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

            </>
            )}
            {activeStep === 11 && (
            <>

      <SectionCard title={t.secAppraiser} icon={<UserCheck size={14} />} lang={lang}
>
        <AppraiserOpinionSection
          lang={lang}
          methodTotals={{
            market: (() => {
              // Priority 1: user explicitly typed a total
              const manualTotal = parseFloat(
                ev.methodsMarket.marketMethodTotal,
              );
              if (manualTotal > 0) return manualTotal;
              // Priority 2: meter price × area (user-entered meter price wins, then settlement-derived)
              const meterPrice =
                parseFloat(ev.methodsMarket.marketMeterPrice) || settlNetMeter;
              const area =
                parseFloat(ev.methodsMarket.propertyAreaMethod) ||
                parseFloat(ev.assetInfo.propertyArea) ||
                0;
              return meterPrice * area;
            })(),
            cost: (() => {
              // Priority 1: user explicitly typed the combined total
              const manualTotal = parseFloat(ev.methodsCost.costLandBuildTotal);
              if (manualTotal > 0) return manualTotal;
              // Priority 2: sum of user-entered net buildings + net land price
              const userBuildings = parseFloat(ev.methodsCost.costNetBuildings);
              const userLand = parseFloat(ev.methodsCost.costNetLandPrice);
              if (userBuildings > 0 || userLand > 0)
                return (
                  (userBuildings || repDerived.netAsset) +
                  (userLand || repDerived.landDataTotal)
                );
              // Priority 3: fully auto-calculated from replacement section
              return repDerived.landAsset;
            })(),
            income: investmentTotal,
            rvl: 0,
            dcf: 0,
            rental: 0,
          }}
          data={ev.appraiser}
          onChange={(updated) => setEv((p) => ({ ...p, appraiser: updated }))}
        />
            </SectionCard>

            </>
            )}
            {activeStep === 12 && (
            <>

      {/* ── Report Items ─────────────────────────────────────────────────────── */}
      <SectionCard title={t.secReport} icon={<ScrollText size={14} />} lang={lang}
>
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
            <SectionCard title={t.secAuthors} icon={<Users size={14}/>} lang={lang} >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ev.authors.authorEntries.map((entry, idx) => {
              const picked = signatories.find((s) => s.id === entry.signatoryId);
              return (
                <div
                  key={entry.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: 10,
                    alignItems: "end",
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
                      {lang === "ar" ? `معد ${idx + 1} — الاسم` : `Author ${idx + 1} — Name`}
                    </label>
                    <Select
                      value={entry.signatoryId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const sig = signatories.find((s) => s.id === val);
                        updateAuthor(entry.id, {
                          signatoryId: val,
                          title: sig ? sig.jobTitle : entry.title,
                        });
                      }}
                    >
                      <option value="">{lang === "ar" ? "بدون" : "None"}</option>
                      {signatories.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.source === "reportOnly"
                            ? lang === "ar"
                              ? " (معدّ تقرير)"
                              : " (Report only)"
                            : ""}
                        </option>
                      ))}
                    </Select>
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
                      {lang === "ar" ? `معد ${idx + 1} — المنصب` : `Author ${idx + 1} — Title`}
                    </label>
                    <Input
                      value={entry.title}
                      onChange={(e) => updateAuthor(entry.id, { title: e.target.value })}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeAuthor(entry.id)}
                    disabled={ev.authors.authorEntries.length <= 1}
                    title={lang === "ar" ? "حذف" : "Remove"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 34,
                      height: 34,
                      border: `1px solid ${DS.border}`,
                      borderRadius: DS.radius.md,
                      background: DS.surface,
                      color: DS.red,
                      cursor:
                        ev.authors.authorEntries.length <= 1 ? "not-allowed" : "pointer",
                      opacity: ev.authors.authorEntries.length <= 1 ? 0.35 : 1,
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addAuthor}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
                padding: "8px 14px",
                background: `${DS.primary}12`,
                border: `1.5px solid ${DS.primary}35`,
                borderRadius: DS.radius.md,
                color: DS.primary,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <UserCheck size={14} />
              {lang === "ar" ? "إضافة معدّ" : "Add Author"}
            </button>
          </div>
        </div>
            </SectionCard>

            </>
            )}
            </WizardShell>

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
        <button
                  type="button"
                  onClick={openCopyModal}
                  title={
                    lang === "ar"
                      ? "نسخ البيانات من معاملة أخرى"
                      : "Copy Data from Another Transaction"
                  }
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    background: DS.surface,
                    color: DS.primary,
                    border: `1.5px solid ${DS.primary}40`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: DS.shadow.md,
                    transition: "all 0.2s",
                  }}
                >
                  <Copy size={19} />
                </button>
      </div>


      {showCopyModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(15,23,42,0.55)",
                  zIndex: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                }}
                onClick={() => setShowCopyModal(false)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: DS.surface,
                    borderRadius: DS.radius.xl,
                    width: "100%",
                    maxWidth: 560,
                    maxHeight: "80vh",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    boxShadow: DS.shadow.lg,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 18px",
                      borderBottom: `1px solid ${DS.border}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: DS.radius.sm,
                          background: `${DS.primary}15`,
                          color: DS.primary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Copy size={15} />
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: DS.text }}>
                        {lang === "ar"
                          ? "نسخ البيانات من معاملة أخرى"
                          : "Copy Data from Another Transaction"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCopyModal(false)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: DS.textMuted,
                        display: "flex",
                      }}
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <div style={{ padding: "12px 18px 0" }}>
                    <Input
                      value={copySearch}
                      onChange={(e) => setCopySearch(e.target.value)}
                      placeholder={
                        lang === "ar"
                          ? "ابحث برقم التكليف أو العميل أو المالك..."
                          : "Search by assignment #, client, or owner..."
                      }
                    />
                  </div>

                  {copyError && (
                    <div style={{ margin: "10px 18px 0", fontSize: 12, color: DS.red }}>
                      {copyError}
                    </div>
                  )}

                  <div style={{ padding: "12px 18px 18px", overflowY: "auto", flex: 1 }}>
                    {copyLoading ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 40,
                          color: DS.textMuted,
                          gap: 8,
                        }}
                      >
                        <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                        {t.loading}
                      </div>
                    ) : filteredCopyList.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          color: DS.textLight,
                          padding: 40,
                          fontSize: 13,
                        }}
                      >
                        {lang === "ar" ? "لا توجد معاملات" : "No transactions found"}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {filteredCopyList.map((row: any) => {
                          const id = row.id ?? row._id;
                          const busy = copyingId === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              disabled={!!copyingId}
                              onClick={() => handleCopyFromTransaction(id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                                padding: "10px 12px",
                                border: `1px solid ${DS.border}`,
                                borderRadius: DS.radius.md,
                                background: DS.surfaceAlt,
                                cursor: copyingId ? "default" : "pointer",
                                textAlign: isRtl ? "right" : "left",
                                fontFamily: "inherit",
                                opacity: copyingId && !busy ? 0.5 : 1,
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: DS.text,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {row.clientName ?? row.clientId ?? "—"}
                                  {row.assignmentNumber ? ` · ${row.assignmentNumber}` : ""}
                                </div>
                                <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 2 }}>
                                  {row?.evalData?.address ?? row?.evalData?.ownerName ?? id}
                                </div>
                              </div>
                              {busy ? (
                                <Loader2
                                  size={15}
                                  style={{ animation: "spin 1s linear infinite", color: DS.primary }}
                                />
                              ) : (
                                <Copy size={15} style={{ color: DS.primary, flexShrink: 0 }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
