"use client";

import { useContext, useState, useMemo, useCallback, useEffect } from "react";
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
import { toApiUrl } from "@/lib/api-url";
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
  | "sent"
  | "cancelled"
  | "pending";

// Raw shape returned by /api/transactions
type ApiTransaction = {
  id: string;
  assignmentNumber: string;
  authorizationNumber?: string;
  assignmentDate: string;
  valuationPurpose: string;
  intendedUse?: string;
  valuationBasis: string;
  ownershipType: string;
  valuationHypothesis: string;
  clientId: string;
  clientName?: string;
  branch: string;
  templateId?: string;
  templateName?: string;
  // top-level status is legacy/optional — evalData.status is the source of truth
  status?: string;
  priority?: string;
  finalAssetValue?: number;
  createdAt: string;
  updatedAt: string;
  templateFieldValues?: Record<string, { label: string; value: string }>;
  // evalData holds all fields saved by the appraiser
  evalData?: {
    status?: string;
    finalAssetValue?: number | string;
    ownerName?: string;
    clientName?: string;
    deedNumber?: string;
    cityName?: string;
    neighborhoodName?: string;
    [key: string]: any;
  };
  // legacy flat fields (kept for backwards compatibility)
  deedNumber?: string;
  ownerName?: string;
  propertyTypeId?: string;
  cityName?: string;
  neighborhoodName?: string;
  imagesCount?: number;
  attachmentsCount?: number;
};

type ValuationRow = {
  id: string;
  isDraft: boolean;
  priority: Priority;
  clientLogo: string | null;
  assignment: {
    requester: string;
    template: string;
    referenceNumber: string;
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
  timerValue: string;
  isOverdue: boolean;
  attachmentsCount: number;
  imagesCount: number;
  hasUnreadNotes: boolean;
  inspector: string;
  workingOn?: string;
  lastUpdate: string;
  lastUpdateBy: string;
  elapsedLabel: string;
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
    cancelled: "Cancelled",
    pending: "Pending",
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
    loading: "Loading transactions...",
    error: "Failed to load transactions.",
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
    cancelled: "ملغية",
    pending: "معلقة",
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
    loading: "جاري تحميل المعاملات...",
    error: "فشل تحميل المعاملات.",
  },
} as const;

type Copy = (typeof copy)[keyof typeof copy];

// ─── status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ValuationStatus,
  { bg: string; text: string; dot: string }
> = {
  new: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
  inspection: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  review: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  audit: { bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500" },
  approved: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  sent: { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
  cancelled: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400" },
  pending: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value === 0) return "0.00";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function elapsedSince(dateStr: string): {
  label: string;
  isOverdue: boolean;
  timer: string;
} {
  const created = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor((diffMs % 3600000) / 60000);
  const isOverdue = diffH >= 24;

  let label = "";
  if (diffH < 1) label = "أقل من ساعة";
  else if (diffH < 24) label = `${diffH} ساعة`;
  else {
    const days = Math.floor(diffH / 24);
    const remH = diffH % 24;
    label = remH > 0 ? `${days} يوم و ${remH} ساعة` : `${days} يوم`;
  }

  const hh = String(diffH).padStart(2, "0");
  const mm = String(diffM).padStart(2, "0");
  const timer = `${hh}:${mm}:00`;

  return { label, isOverdue, timer };
}

/** Build a label→value lookup from templateFieldValues */
function byLabel(
  tfv?: Record<string, { label: string; value: string }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!tfv) return map;
  Object.values(tfv).forEach((e) => {
    if (e?.label) map[e.label] = e.value ?? "";
  });
  return map;
}

/** Map an API transaction to a ValuationRow */
function mapToRow(tx: ApiTransaction): ValuationRow {
  const bl = byLabel(tx.templateFieldValues);
  const elapsed = elapsedSince(tx.createdAt);
  const ed = tx.evalData ?? {};

  const address =
    [
      ed.cityName ?? tx.cityName ?? bl["المدينة"],
      ed.neighborhoodName ?? tx.neighborhoodName ?? bl["الحي"],
    ]
      .filter(Boolean)
      .join(" - ") ||
    bl["العنوان"] ||
    "—";

  // ── Status: evalData.status is the source of truth; fall back to
  // top-level tx.status for records not yet opened by the appraiser ──
  const resolvedStatus = (ed.status || tx.status || "new") as ValuationStatus;

  // ── Final value: prefer evalData, then top-level ──
  const resolvedValue =
    parseFloat(String(ed.finalAssetValue ?? tx.finalAssetValue ?? 0)) || 0;

  return {
    id: tx.id,
    isDraft: false,
    priority: (tx.priority as Priority) ?? "normal",
    clientLogo: null,
    assignment: {
      requester: tx.clientName ?? tx.clientId ?? "—",
      template: tx.templateName ?? tx.templateId ?? "—",
      referenceNumber: tx.id.slice(-6).toUpperCase(),
      assignmentNumber: tx.assignmentNumber || "—",
      assignmentDate: tx.assignmentDate || "—",
      authorizationNumber: tx.authorizationNumber,
    },
    details: {
      deedNumber: ed.deedNumber ?? tx.deedNumber ?? bl["رقم الصك"] ?? undefined,
      plotNumber: bl["رقم القطعة"] ?? undefined,
      clientName: ed.clientName ?? tx.clientName ?? bl["اسم العميل"] ?? "—",
      ownerName: ed.ownerName ?? tx.ownerName ?? bl["اسم المالك"] ?? "—",
      propertyType: bl["نوع الأصل"] ?? "—",
      address,
      contactNumber: bl["رقم التواصل"] ?? undefined,
    },
    value: resolvedValue,
    status: resolvedStatus,
    timerValue: elapsed.timer,
    isOverdue: elapsed.isOverdue,
    elapsedLabel: elapsed.label,
    attachmentsCount: tx.attachmentsCount ?? 0,
    imagesCount: tx.imagesCount ?? 0,
    hasUnreadNotes: false,
    inspector: bl["المعاين"] ?? "—",
    workingOn: undefined,
    lastUpdate: new Date(tx.updatedAt).toLocaleString("ar-SA"),
    lastUpdateBy: "—",
  };
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

function StatusBadge({ status, t }: { status: ValuationStatus; t: Copy }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
  const label = (t as any)[status] ?? status;
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

function PriorityBadge({ priority, t }: { priority: Priority; t: Copy }) {
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
  if (!value || value === "-" || value === "—") return null;
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
  onOpen,
  t,
}: {
  row: ValuationRow;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onOpen: (id: string) => void;
  t: Copy;
}) {
  return (
    <div
      className={cn(
        "group border-b border-slate-100 transition-colors last:border-b-0",
        isSelected && "bg-cyan-50/50",
        isExpanded && "bg-slate-50/50",
      )}
    >
      {/* MAIN ROW */}
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
          <span className="text-[10px] text-slate-400">{row.elapsedLabel}</span>
        </div>

        {/* Actions */}
        <div className="flex w-[200px] shrink-0 items-center justify-center gap-0.5">
          <ActionButton
            tooltip={t.openTransaction}
            onClick={() => onOpen(row.id)}
          >
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

          <ActionButton tooltip={t.followUpNotes} className="relative">
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

      {/* EXPANDED DETAILS */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
                  value={row.assignment.referenceNumber}
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
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  t: Copy;
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
          {[5, 10, 20, 50].map((s) => (
            <option key={s} value={s}>
              {s}
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
  onOpenTransaction?: (transactionId: string) => void;
};

export function ValuationTable({
  className,
  onOpenTransaction,
}: ValuationTableProps) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const isArabic = language === "ar";
  const t = copy[language];

  const [rows, setRows] = useState<ValuationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(toApiUrl("/api/transactions"), {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const arr: ApiTransaction[] = Array.isArray(data)
          ? data
          : (data.data ?? data.transactions ?? data.items ?? []);
        setRows(arr.map(mapToRow));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  const allSelected =
    paginatedData.length > 0 && paginatedData.every((r) => selected.has(r.id));

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) paginatedData.forEach((r) => next.delete(r.id));
      else paginatedData.forEach((r) => next.add(r.id));
      return next;
    });
  }, [allSelected, paginatedData]);

  const toggleSelect = useCallback(
    (id: string) =>
      setSelected((prev) => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
      }),
    [],
  );
  const toggleExpand = useCallback(
    (id: string) =>
      setExpanded((prev) => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
      }),
    [],
  );
  const handlePageChange = useCallback(
    (p: number) => setCurrentPage(Math.max(1, Math.min(p, totalPages))),
    [totalPages],
  );
  const handlePageSizeChange = useCallback((s: number) => {
    setPageSize(s);
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
            {/* TABLE HEADER */}
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
                <ColumnHeader
                  label={t.value}
                  sortable
                  className="justify-center"
                />
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

            {/* ROWS */}
            {loading ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                {t.loading}
              </div>
            ) : error ? (
              <div className="flex h-40 items-center justify-center text-sm text-red-400">
                {t.error} {error}
              </div>
            ) : paginatedData.length > 0 ? (
              <div>
                {paginatedData.map((row) => (
                  <ValuationTableRow
                    key={row.id}
                    row={row}
                    isSelected={selected.has(row.id)}
                    isExpanded={expanded.has(row.id)}
                    onToggleSelect={() => toggleSelect(row.id)}
                    onToggleExpand={() => toggleExpand(row.id)}
                    onOpen={(id) => onOpenTransaction?.(id)}
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

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={rows.length}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          t={t}
        />
      </div>
    </TooltipProvider>
  );
}
