"use client";

import { useContext, useState, useMemo, useCallback } from "react";
import {
  Eye,
  Printer,
  FileDown,
  Paperclip,
  Pencil,
  MessageCircle,
  MoreVertical,
  History,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ImageIcon,
  Clock,
  MapPin,
  Building2,
  Phone,
  User,
  FileText,
  Hash,
  Calendar,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── types ────────────────────────────────────────────────────────────────────

type Priority = "normal" | "urgent";

type ValuationStatus =
  | "new"
  | "inspection"
  | "review"
  | "audit"
  | "approved"
  | "sent";

type ValuationRow = {
  id: number;
  isDraft: boolean;
  priority: Priority;
  clientLogo: string | null;
  assignment: {
    requester: string;
    template: string;
    referenceNumber: number;
    assignmentNumber: string;
    assignmentDate: string;
    authorizationNumber?: string;
  };
  details: {
    deedNumber?: string;
    plotNumber?: string;
    clientName: string;
    ownerName: string;
    propertyType: string;
    address: string;
    contactNumber?: string;
  };
  value: number;
  status: ValuationStatus;
  elapsedTime: string;
  elapsedLabel: string;
  timerValue: string;
  isOverdue: boolean;
  attachmentsCount: number;
  imagesCount: number;
  hasUnreadNotes: boolean;
  inspector: string;
  workingOn?: string;
  lastUpdate: string;
  lastUpdateBy: string;
};

// ─── i18n ─────────────────────────────────────────────────────────────────────

const copy = {
  en: {
    assignment: "Assignment",
    details: "Details",
    value: "Value",
    status: "Status",
    actions: "Actions",
    requester: "Requester",
    template: "Template",
    refNumber: "Ref #",
    assignmentNo: "Assignment #",
    assignmentDate: "Assignment Date",
    authNo: "Authorization #",
    deedNo: "Deed #",
    plotNo: "Plot #",
    clientName: "Client",
    ownerName: "Owner",
    propertyType: "Property Type",
    address: "Address",
    contactNo: "Contact",
    openTransaction: "Open Transaction",
    viewReport: "View Report",
    downloadPdf: "Download PDF",
    attachments: "Attachments",
    editTransaction: "Edit Transaction",
    followUpNotes: "Follow-up Notes",
    more: "More",
    editLog: "Edit Log",
    duplicate: "Duplicate Transaction",
    images: "Images",
    inspector: "Inspector",
    workingOn: "Working on",
    lastUpdate: "Last Update",
    normal: "Normal",
    urgent: "Urgent",
    draft: "Draft",
    new: "New",
    inspection: "Inspection",
    review: "Review",
    audit: "Audit",
    approved: "Approved",
    sent: "Sent",
    selectAll: "Select All",
    showing: "Showing",
    of: "of",
    entries: "entries",
    page: "Page",
    rowsPerPage: "Rows per page",
    noData: "No matching records found",
    changePriority: "Change priority to urgent",
    expandDetails: "Show details",
    collapseDetails: "Hide details",
    sar: "SAR",
  },
  ar: {
    assignment: "التكليف",
    details: "التفاصيل",
    value: "القيمة",
    status: "الحالة",
    actions: "الإجراءات",
    requester: "طالب التقييم",
    template: "النموذج",
    refNumber: "الرقم المرجعي",
    assignmentNo: "رقم التكليف",
    assignmentDate: "تاريخ التكليف",
    authNo: "رقم التعميد",
    deedNo: "رقم الصك",
    plotNo: "رقم القطعة",
    clientName: "اسم العميل",
    ownerName: "اسم المالك",
    propertyType: "نوع العقار",
    address: "العنوان",
    contactNo: "رقم التواصل",
    openTransaction: "فتح المعاملة",
    viewReport: "عرض التقرير",
    downloadPdf: "تحميل PDF",
    attachments: "المرفقات",
    editTransaction: "تعديل بيانات المعاملة",
    followUpNotes: "ملاحظات المتابعة",
    more: "المزيد",
    editLog: "سجل التعديلات",
    duplicate: "تكرار المعاملة",
    images: "الصور",
    inspector: "المعاين",
    workingOn: "يعمل على المعاملة",
    lastUpdate: "آخر تحديث",
    normal: "عادية",
    urgent: "عاجلة",
    draft: "مسودة",
    new: "جديدة",
    inspection: "المعاينة",
    review: "المراجعة",
    audit: "التدقيق",
    approved: "معتمدة",
    sent: "مرسلة",
    selectAll: "تحديد الكل",
    showing: "عرض",
    of: "من",
    entries: "سجل",
    page: "صفحة",
    rowsPerPage: "صفوف في الصفحة",
    noData: "لم يتم العثور على سجلات مطابقة",
    changePriority: "تغيير أولوية المعاملة لعاجل",
    expandDetails: "عرض التفاصيل",
    collapseDetails: "إخفاء التفاصيل",
    sar: "ر.س",
  },
} as const;

// ─── status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ValuationStatus,
  { bg: string; text: string; dot: string }
> = {
  new: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-400",
  },
  inspection: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  review: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  audit: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    dot: "bg-teal-500",
  },
  approved: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  sent: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    dot: "bg-cyan-500",
  },
};

// ─── dummy data ───────────────────────────────────────────────────────────────

const DUMMY_DATA: ValuationRow[] = [
  {
    id: 7056,
    isDraft: false,
    priority: "normal",
    clientLogo: null,
    assignment: {
      requester:
        "مركز الاسناد والتصفية إنفاذ",
      template: "مفصل - معتمد",
      referenceNumber: 7056,
      assignmentNumber: "S02879",
      assignmentDate: "18-03-2026",
      authorizationNumber: "PRC-04-011-26-03-694",
    },
    details: {
      deedNumber: "498552034572",
      plotNumber: "363 / ج / س",
      clientName: "-",
      ownerName: "-",
      propertyType: "شقة",
      address: "جدة - أم السلم",
      contactNumber: "0555658802",
    },
    value: 0,
    status: "inspection",
    elapsedTime: "5 ساعات",
    elapsedLabel: "5 ساعات",
    timerValue: "05:37:59",
    isOverdue: false,
    attachmentsCount: 5,
    imagesCount: 0,
    hasUnreadNotes: false,
    inspector: "عبدالله ابراهيم عبدالله الغامدي",
    workingOn: "عبدالله ابراهيم عبدالله الغامدي",
    lastUpdate: "18-03-2026 06:13 AM",
    lastUpdateBy: "عبدالله ابراهيم عبدالله الغامدي",
  },
  {
    id: 7052,
    isDraft: false,
    priority: "normal",
    clientLogo: null,
    assignment: {
      requester: "بنك الجزيرة",
      template: "مختصر - معتمد",
      referenceNumber: 7052,
      assignmentNumber: "181130 - 1045020805",
      assignmentDate: "16-03-2026",
    },
    details: {
      deedNumber: "7173586869400000",
      plotNumber: "998",
      clientName: "عبدالله بن سعيد",
      ownerName: "عبدالله سعيد سعد بن سعيد",
      propertyType: "عمارة",
      address: "الرياض - حطين",
      contactNumber: "0555238555",
    },
    value: 19688857.73,
    status: "review",
    elapsedTime: "يومان و 1 ساعة",
    elapsedLabel: "يومان و 1 ساعة",
    timerValue: "21:48:31",
    isOverdue: true,
    attachmentsCount: 4,
    imagesCount: 83,
    hasUnreadNotes: true,
    inspector: "عبدالعزيز ابراهيم الصبيعي",
    lastUpdate: "17-03-2026 02:03 PM",
    lastUpdateBy: "عبدالعزيز ابراهيم الصبيعي",
  },
  {
    id: 7054,
    isDraft: false,
    priority: "normal",
    clientLogo: null,
    assignment: {
      requester: "بنك الجزيرة",
      template: "مختصر - معتمد",
      referenceNumber: 7054,
      assignmentNumber: "2519912",
      assignmentDate: "16-03-2026",
    },
    details: {
      deedNumber: "460026298051",
      plotNumber: "6 / 2",
      clientName: "شيان محمد مهنا الردادي",
      ownerName: "شركة مساكن طبية للتطوير العقاري",
      propertyType: "عمارة",
      address: "المدينة المنورة - شوران",
      contactNumber: "0502456994",
    },
    value: 1703746.46,
    status: "review",
    elapsedTime: "يوم و 20 ساعة",
    elapsedLabel: "يوم و 20 ساعة",
    timerValue: "30:55:37",
    isOverdue: true,
    attachmentsCount: 2,
    imagesCount: 42,
    hasUnreadNotes: false,
    inspector: "أحمد حامد الحجيلي",
    lastUpdate: "17-03-2026 04:55 AM",
    lastUpdateBy: "أحمد حامد الحجيلي",
  },
  {
    id: 7053,
    isDraft: false,
    priority: "normal",
    clientLogo: null,
    assignment: {
      requester: "بنك الجزيرة",
      template: "مختصر - معتمد",
      referenceNumber: 7053,
      assignmentNumber: "2519710",
      assignmentDate: "16-03-2026",
    },
    details: {
      deedNumber: "395024002985",
      plotNumber: "772 / أ",
      clientName: "خالد محمد مفرح الشهري",
      ownerName: "خالد محمد مفرح الشهري",
      propertyType: "فيلا سكنية",
      address: "خميس مشيط - اليرموك",
      contactNumber: "0500147112",
    },
    value: 2009518.65,
    status: "approved",
    elapsedTime: "يوم و 23 ساعة",
    elapsedLabel: "يوم و 23 ساعة",
    timerValue: "31:32:52",
    isOverdue: true,
    attachmentsCount: 4,
    imagesCount: 97,
    hasUnreadNotes: true,
    inspector: "مبارك محمد الشهراني",
    lastUpdate: "17-03-2026 04:18 AM",
    lastUpdateBy: "عمر تاج الملك",
  },
  {
    id: 7040,
    isDraft: false,
    priority: "normal",
    clientLogo: null,
    assignment: {
      requester:
        "مركز الاسناد والتصفية إنفاذ",
      template: "مفصل - معتمد",
      referenceNumber: 7040,
      assignmentNumber: "-",
      assignmentDate: "15-03-2026",
    },
    details: {
      deedNumber: "750116004746",
      plotNumber: "بدون",
      clientName: "مركز الاسناد والتصفية",
      ownerName: "مسلم سويلم عيد العطوي",
      propertyType: "فيلا سكنية",
      address: "تبوك - البساتين",
    },
    value: 0,
    status: "review",
    elapsedTime: "يومان و 18 ساعة",
    elapsedLabel: "يومان و 18 ساعة",
    timerValue: "41:42:58",
    isOverdue: true,
    attachmentsCount: 4,
    imagesCount: 28,
    hasUnreadNotes: false,
    inspector: "خالد شامان",
    lastUpdate: "16-03-2026 06:08 PM",
    lastUpdateBy: "خالد شامان",
  },
  {
    id: 7055,
    isDraft: false,
    priority: "normal",
    clientLogo: null,
    assignment: {
      requester: "منصة خبرة",
      template: "تقرير سردي - مباني",
      referenceNumber: 7055,
      assignmentNumber: "خبرة - 4771851238",
      assignmentDate: "16-03-2026",
      authorizationNumber:
        "خبرة - 4771851238 (عبدالرحمن عثمان محمد الشبانه)",
    },
    details: {
      clientName:
        "خبرة - 4771851238 (عبدالرحمن عثمان محمد الشبانه)",
      ownerName: "-",
      propertyType: "أرض",
      address: "الرياض - النرجس",
    },
    value: 0,
    status: "new",
    elapsedTime: "يوم و 20 ساعة",
    elapsedLabel: "يوم و 20 ساعة",
    timerValue: "44:31:46",
    isOverdue: true,
    attachmentsCount: 0,
    imagesCount: 0,
    hasUnreadNotes: false,
    inspector: "عبدالعزيز خالد الخالد",
    workingOn: "عبدالعزيز الخالد",
    lastUpdate: "16-03-2026 03:19 PM",
    lastUpdateBy: "عبدالعزيز الخالد",
  },
  {
    id: 7050,
    isDraft: false,
    priority: "normal",
    clientLogo: null,
    assignment: {
      requester: "البنك السعودي الفرنسي",
      template: "الفرنسي شركات",
      referenceNumber: 7050,
      assignmentNumber: "15919",
      assignmentDate: "15-03-2026",
    },
    details: {
      deedNumber: "420118000543",
      plotNumber: "3358",
      clientName: "إبراهيم عبدالله عبد العزيز السريع",
      ownerName: "إبراهيم عبدالله عبد العزيز السريع",
      propertyType: "أرض",
      address: "مكة المكرمة - العوالي",
      contactNumber: "0537579360",
    },
    value: 5631256.52,
    status: "audit",
    elapsedTime: "يومان و 9 ساعات",
    elapsedLabel: "يومان و 9 ساعات",
    timerValue: "44:59:08",
    isOverdue: true,
    attachmentsCount: 3,
    imagesCount: 16,
    hasUnreadNotes: false,
    inspector: "عبدالله ابراهيم عبدالله الغامدي",
    lastUpdate: "16-03-2026 02:52 PM",
    lastUpdateBy: "نجلاء ناصر الجريسي",
  },
  {
    id: 7051,
    isDraft: true,
    priority: "normal",
    clientLogo: null,
    assignment: {
      requester: "ورثة عمر بن صديق بن عمر عطار",
      template: "مختصر - معتمد",
      referenceNumber: 7051,
      assignmentNumber: "325510001079",
      assignmentDate: "16-03-2026",
    },
    details: {
      plotNumber: "2007 الى 2014",
      clientName: "عمر بن صديق بن عمر عطار",
      ownerName:
        "نادين صديق بن عمر عطار 9.72% - مريم صديق بن عمر عطار 9.72% - سامر صديق بن عمر عطار 19.44%",
      propertyType: "أرض",
      address: "جدة - الخالدية",
      contactNumber: "+",
    },
    value: 35791800.0,
    status: "inspection",
    elapsedTime: "يومان و ساعتين",
    elapsedLabel: "يومان و ساعتين",
    timerValue: "45:32:57",
    isOverdue: true,
    attachmentsCount: 5,
    imagesCount: 1,
    hasUnreadNotes: false,
    inspector: "عبدالله ابراهيم عبدالله الغامدي",
    lastUpdate: "16-03-2026 02:18 PM",
    lastUpdateBy: "عبدالله ابراهيم عبدالله الغامدي",
  },
  {
    id: 7041,
    isDraft: true,
    priority: "normal",
    clientLogo: null,
    assignment: {
      requester:
        "مركز الاسناد والتصفية إنفاذ",
      template: "مفصل - معتمد",
      referenceNumber: 7041,
      assignmentNumber: "-",
      assignmentDate: "15-03-2026",
    },
    details: {
      deedNumber: "344302000802",
      plotNumber: "218",
      clientName: "مركز الاسناد والتصفية",
      ownerName: "عادل خلف مرجي الشراري",
      propertyType: "فيلا سكنية",
      address: "طبرجل - السمح",
    },
    value: 616851.0,
    status: "audit",
    elapsedTime: "يومان و 17 ساعة",
    elapsedLabel: "يومان و 17 ساعة",
    timerValue: "45:34:29",
    isOverdue: true,
    attachmentsCount: 5,
    imagesCount: 38,
    hasUnreadNotes: false,
    inspector: "فهد طليحان الاسمر الضلعان",
    lastUpdate: "16-03-2026 02:17 PM",
    lastUpdateBy: "نجلاء ناصر الجريسي",
  },
  {
    id: 7039,
    isDraft: false,
    priority: "urgent",
    clientLogo: null,
    assignment: {
      requester:
        "مركز الاسناد والتصفية إنفاذ",
      template: "مفصل - معتمد",
      referenceNumber: 7039,
      assignmentNumber: "S02850",
      assignmentDate: "14-03-2026",
    },
    details: {
      deedNumber: "560679000713",
      plotNumber: "935",
      clientName: "مركز الاسناد والتصفية",
      ownerName: "مسلم سويلم عيد العطوي",
      propertyType: "أرض سكنية",
      address: "تبوك - البساتين",
      contactNumber: "0551234567",
    },
    value: 875000.0,
    status: "sent",
    elapsedTime: "3 أيام و 5 ساعات",
    elapsedLabel: "3 أيام و 5 ساعات",
    timerValue: "77:15:22",
    isOverdue: true,
    attachmentsCount: 6,
    imagesCount: 18,
    hasUnreadNotes: true,
    inspector: "خالد شامان",
    lastUpdate: "15-03-2026 10:30 AM",
    lastUpdateBy: "خالد شامان",
  },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value === 0) return "0.00";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ActionButton({
  tooltip,
  children,
  onClick,
  className,
}: {
  tooltip: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all duration-150 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: ValuationStatus;
  t: (typeof copy)["ar"];
}) {
  const config = STATUS_CONFIG[status];
  const label = t[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        config.bg,
        config.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {label}
    </span>
  );
}

function PriorityBadge({
  priority,
  t,
}: {
  priority: Priority;
  t: (typeof copy)["ar"];
}) {
  if (priority === "urgent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-inset ring-red-200">
        <AlertTriangle className="h-3 w-3" />
        {t.urgent}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-200">
      {t.normal}
    </span>
  );
}

function DetailPair({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  if (!value || value === "-") return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="font-medium text-slate-500">{label}:</span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}

// ─── row component ────────────────────────────────────────────────────────────

function ValuationTableRow({
  row,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  t,
}: {
  row: ValuationRow;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  t: (typeof copy)["ar"];
}) {
  return (
    <div
      className={cn(
        "group border-b border-slate-100 transition-colors last:border-b-0",
        isSelected && "bg-cyan-50/50",
        isExpanded && "bg-slate-50/50",
      )}
    >
      {/* ─── MAIN ROW ─── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="h-4 w-4"
          />
        </div>

        {/* Priority + Draft + Logo */}
        <div className="flex w-16 shrink-0 flex-col items-center gap-1.5">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
            {row.clientLogo ? (
              <img
                src={row.clientLogo}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <Building2 className="h-5 w-5 text-slate-300" />
            )}
          </div>
          <PriorityBadge priority={row.priority} t={t} />
          {row.isDraft && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
              {t.draft}
            </span>
          )}
        </div>

        {/* Assignment summary */}
        <button
          onClick={onToggleExpand}
          className="min-w-0 flex-1 cursor-pointer text-start focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-800">
              {row.assignment.requester}
            </span>
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              #{row.assignment.referenceNumber}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {row.details.propertyType}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{row.details.address}</span>
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
            <Calendar className="h-3 w-3" />
            {row.assignment.assignmentDate}
            <span className="mx-1">|</span>
            {row.assignment.template}
          </div>
        </button>

        {/* Value */}
        <div className="w-28 shrink-0 text-center">
          <div
            className={cn(
              "text-sm font-bold tabular-nums",
              row.value > 0 ? "text-slate-800" : "text-slate-400",
            )}
          >
            {formatCurrency(row.value)}
          </div>
          <div className="text-[10px] text-slate-400">{t.sar}</div>
        </div>

        {/* Status + Timer */}
        <div className="flex w-24 shrink-0 flex-col items-center gap-1.5">
          <StatusBadge status={row.status} t={t} />
          <div className="flex items-center gap-1 text-[11px]">
            <Clock
              className={cn(
                "h-3 w-3",
                row.isOverdue ? "text-red-400" : "text-slate-400",
              )}
            />
            <span
              className={cn(
                "font-mono tabular-nums",
                row.isOverdue ? "text-red-500" : "text-slate-500",
              )}
            >
              {row.timerValue}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {row.elapsedLabel}
          </span>
        </div>

        {/* Actions */}
        <div className="flex w-[200px] shrink-0 items-center justify-center gap-0.5">
          <ActionButton tooltip={t.openTransaction}>
            <Eye className="h-4 w-4" />
          </ActionButton>
          <ActionButton
            tooltip={`${t.attachments} (${row.attachmentsCount})`}
            className="relative"
          >
            <Paperclip className="h-4 w-4" />
            {row.attachmentsCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-600 px-1 text-[9px] font-bold text-white">
                {row.attachmentsCount}
              </span>
            )}
          </ActionButton>
          <ActionButton
            tooltip={t.followUpNotes}
            className="relative"
          >
            <MessageCircle className="h-4 w-4" />
            {row.hasUnreadNotes && (
              <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </ActionButton>
          <ActionButton
            tooltip={`${t.images} (${row.imagesCount})`}
            className="relative"
          >
            <ImageIcon className="h-4 w-4" />
            {row.imagesCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">
                {row.imagesCount}
              </span>
            )}
          </ActionButton>

          {/* More dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2 text-sm">
                <Printer className="h-4 w-4" />
                {t.viewReport}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-sm">
                <FileDown className="h-4 w-4" />
                {t.downloadPdf}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-sm">
                <Pencil className="h-4 w-4" />
                {t.editTransaction}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-sm">
                <History className="h-4 w-4" />
                {t.editLog}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-sm">
                <Copy className="h-4 w-4" />
                {t.duplicate}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-sm">
                <AlertTriangle className="h-4 w-4" />
                {t.changePriority}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Expand toggle */}
          <button
            onClick={onToggleExpand}
            className="ms-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
          </button>
        </div>
      </div>

      {/* ─── EXPANDED DETAILS ─── */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Assignment Details */}
              <div className="space-y-2">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <FileText className="h-3.5 w-3.5" />
                  {t.assignment}
                </h4>
                <DetailPair
                  icon={User}
                  label={t.requester}
                  value={row.assignment.requester}
                />
                <DetailPair
                  icon={FileText}
                  label={t.template}
                  value={row.assignment.template}
                />
                <DetailPair
                  icon={Hash}
                  label={t.refNumber}
                  value={String(row.assignment.referenceNumber)}
                />
                <DetailPair
                  icon={Hash}
                  label={t.assignmentNo}
                  value={row.assignment.assignmentNumber}
                />
                <DetailPair
                  icon={Calendar}
                  label={t.assignmentDate}
                  value={row.assignment.assignmentDate}
                />
                {row.assignment.authorizationNumber && (
                  <DetailPair
                    icon={Hash}
                    label={t.authNo}
                    value={row.assignment.authorizationNumber}
                  />
                )}
              </div>

              {/* Property Details */}
              <div className="space-y-2">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Building2 className="h-3.5 w-3.5" />
                  {t.details}
                </h4>
                {row.details.deedNumber && (
                  <DetailPair
                    icon={Hash}
                    label={t.deedNo}
                    value={row.details.deedNumber}
                  />
                )}
                {row.details.plotNumber && (
                  <DetailPair
                    icon={Hash}
                    label={t.plotNo}
                    value={row.details.plotNumber}
                  />
                )}
                <DetailPair
                  icon={User}
                  label={t.clientName}
                  value={row.details.clientName}
                />
                <DetailPair
                  icon={User}
                  label={t.ownerName}
                  value={row.details.ownerName}
                />
                <DetailPair
                  icon={Building2}
                  label={t.propertyType}
                  value={row.details.propertyType}
                />
                <DetailPair
                  icon={MapPin}
                  label={t.address}
                  value={row.details.address}
                />
                {row.details.contactNumber && (
                  <DetailPair
                    icon={Phone}
                    label={t.contactNo}
                    value={row.details.contactNumber}
                  />
                )}
              </div>

              {/* Inspector & Meta */}
              <div className="space-y-2">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <User className="h-3.5 w-3.5" />
                  {t.inspector}
                </h4>
                <DetailPair
                  icon={User}
                  label={t.inspector}
                  value={row.inspector}
                />
                {row.workingOn && (
                  <DetailPair
                    icon={User}
                    label={t.workingOn}
                    value={row.workingOn}
                  />
                )}
                <DetailPair
                  icon={Calendar}
                  label={t.lastUpdate}
                  value={`${row.lastUpdate} - ${row.lastUpdateBy}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── pagination ───────────────────────────────────────────────────────────────

function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  t,
}: {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  t: (typeof copy)["ar"];
}) {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>
          {t.showing} {start}-{end} {t.of} {totalItems} {t.entries}
        </span>
      </div>

      <div className="hidden sm:flex items-center gap-2">
        <span className="text-xs text-slate-500">{t.rowsPerPage}:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-100"
        >
          {[5, 10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronsRight className="h-4 w-4 rtl:rotate-180" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition",
              page === currentPage
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200",
            )}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}

// ─── column header ────────────────────────────────────────────────────────────

function ColumnHeader({
  label,
  className,
  sortable = false,
}: {
  label: string;
  className?: string;
  sortable?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400",
        sortable && "cursor-pointer select-none hover:text-slate-600",
        className,
      )}
    >
      {label}
      {sortable && <ArrowUpDown className="h-3 w-3" />}
    </div>
  );
}

// ─── main table component ─────────────────────────────────────────────────────

type ValuationTableProps = {
  className?: string;
};

export function ValuationTable({ className }: ValuationTableProps) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const isArabic = language === "ar";
  const t = copy[language];

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const data = DUMMY_DATA;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const allSelected =
    paginatedData.length > 0 &&
    paginatedData.every((row) => selected.has(row.id));

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        paginatedData.forEach((row) => next.delete(row.id));
      } else {
        paginatedData.forEach((row) => next.add(row.id));
      }
      return next;
    });
  }, [allSelected, paginatedData]);

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages],
  );

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        dir={isArabic ? "rtl" : "ltr"}
        className={cn(
          "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
          className,
        )}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[780px]">
            {/* ─── TABLE HEADER ─── */}
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
              <div className="flex shrink-0 items-center">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  className="h-4 w-4"
                />
              </div>
              <div className="w-16 shrink-0" />
              <div className="min-w-0 flex-1">
                <ColumnHeader label={t.assignment} sortable />
              </div>
              <div className="w-28 shrink-0 text-center">
                <ColumnHeader label={t.value} sortable className="justify-center" />
              </div>
              <div className="w-24 shrink-0 text-center">
                <ColumnHeader
                  label={t.status}
                  sortable
                  className="justify-center"
                />
              </div>
              <div className="w-[200px] shrink-0">
                <ColumnHeader label={t.actions} className="justify-center" />
              </div>
            </div>

            {/* ─── ROWS ─── */}
            {paginatedData.length > 0 ? (
              <div>
                {paginatedData.map((row) => (
                  <ValuationTableRow
                    key={row.id}
                    row={row}
                    isSelected={selected.has(row.id)}
                    isExpanded={expanded.has(row.id)}
                    onToggleSelect={() => toggleSelect(row.id)}
                    onToggleExpand={() => toggleExpand(row.id)}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                {t.noData}
              </div>
            )}
          </div>
        </div>

        {/* ─── PAGINATION ─── */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={data.length}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          t={t}
        />
      </div>
    </TooltipProvider>
  );
}
