"use client";

import {
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ImageIcon,
  Clock,
  MapPin,
  Building2,
  User,
  Hash,
  Calendar,
  ArrowUpDown,
  AlertTriangle,
  X,
  Upload,
  File,
  Trash2,
  CheckCircle2,
  Send,
  Download,
  Reply,
  Pin,
  GripVertical,
  Save,
  FileText,
  Target,
  BookOpen,
  Layers,
  Users,
  GitBranch,
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
  status?: string;
  priority?: string;
  finalAssetValue?: number;
  createdAt: string;
  updatedAt: string;
  templateFieldValues?: Record<string, { label: string; value: string }>;
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
  // Raw transaction data for editing
  rawData?: Partial<ApiTransaction>;
};

type AttachmentFile = {
  id: string;
  name: string;
  originalName: string;
  type: "pdf" | "image" | "other";
  preview: string | null;
  size: number;
  uploadedAt: string;
};

type PendingUpload = {
  id: string;
  file: File;
  name: string;
  preview: string | null;
  type: "pdf" | "image" | "other";
};

// ─── NEW: Image types ──────────────────────────────────────────────────────────

type ImageFile = {
  id: string;
  name: string;
  originalName: string;
  preview: string;
  size: number;
  uploadedAt: string;
  sortIndex: number;
};

type PendingImageUpload = {
  id: string;
  file: File;
  name: string;
  preview: string;
};

// ─── NEW: Edit transaction types ───────────────────────────────────────────────

type EditableTransactionData = {
  assignmentNumber: string;
  authorizationNumber: string;
  assignmentDate: string;
  valuationPurpose: string;
  intendedUse: string;
  valuationBasis: string;
  ownershipType: string;
  valuationHypothesis: string;
  clientId: string;
  branch: string;
  priority: string;
  status: string;
};

type NoteAuthor = { id: string; name: string; role: string; color: string };

type NoteMessage = {
  id: string;
  author: NoteAuthor;
  content: string;
  timestamp: string;
  isPinned: boolean;
  replyTo?: { id: string; content: string; authorName: string };
};

// ─── dummy data ───────────────────────────────────────────────────────────────

const DUMMY_ATTACHMENTS: AttachmentFile[] = [
  {
    id: "att-1",
    name: "صك الملكية",
    originalName: "deed_document.pdf",
    type: "pdf",
    preview: "https://placehold.co/300x400/1e3a5f/ffffff?text=PDF",
    size: 2400000,
    uploadedAt: "2025-04-10T09:30:00",
  },
  {
    id: "att-2",
    name: "مخطط الموقع",
    originalName: "site_plan.pdf",
    type: "pdf",
    preview: "https://placehold.co/300x400/0f4c3a/ffffff?text=PDF",
    size: 1800000,
    uploadedAt: "2025-04-10T10:15:00",
  },
  {
    id: "att-3",
    name: "صورة الواجهة",
    originalName: "facade_photo.jpg",
    type: "image",
    preview: "https://placehold.co/300x400/4a2040/ffffff?text=IMG",
    size: 950000,
    uploadedAt: "2025-04-11T14:00:00",
  },
];

// ─── NEW: Dummy images ─────────────────────────────────────────────────────────

const DUMMY_IMAGES: ImageFile[] = [
  {
    id: "img-1",
    name: "الواجهة الأمامية",
    originalName: "front_facade.jpg",
    preview: "https://placehold.co/400x300/1a3a5c/ffffff?text=واجهة+أمامية",
    size: 1200000,
    uploadedAt: "2025-04-10T09:30:00",
    sortIndex: 1,
  },
  {
    id: "img-2",
    name: "الواجهة الخلفية",
    originalName: "back_facade.jpg",
    preview: "https://placehold.co/400x300/0f3d2a/ffffff?text=واجهة+خلفية",
    size: 980000,
    uploadedAt: "2025-04-10T10:15:00",
    sortIndex: 2,
  },
  {
    id: "img-3",
    name: "المدخل الرئيسي",
    originalName: "main_entrance.jpg",
    preview: "https://placehold.co/400x300/3a1a4c/ffffff?text=المدخل",
    size: 870000,
    uploadedAt: "2025-04-11T14:00:00",
    sortIndex: 3,
  },
  {
    id: "img-4",
    name: "الحديقة",
    originalName: "garden.jpg",
    preview: "https://placehold.co/400x300/1c3a1c/ffffff?text=الحديقة",
    size: 1050000,
    uploadedAt: "2025-04-11T15:30:00",
    sortIndex: 4,
  },
];

const DUMMY_AUTHORS: NoteAuthor[] = [
  { id: "u1", name: "أحمد الزهراني", role: "مقيّم", color: "bg-cyan-500" },
  { id: "u2", name: "سارة المالكي", role: "مراجع", color: "bg-violet-500" },
  { id: "u3", name: "خالد العتيبي", role: "مدقق", color: "bg-emerald-500" },
];
const ME = DUMMY_AUTHORS[0];

const DUMMY_NOTES: NoteMessage[] = [
  {
    id: "n1",
    author: DUMMY_AUTHORS[1],
    content:
      "تم الانتهاء من مراجعة وثائق الصك، يرجى التحقق من رقم القطعة المدوّن في العقد.",
    timestamp: "2025-04-10T09:15:00",
    isPinned: true,
  },
  {
    id: "n2",
    author: DUMMY_AUTHORS[0],
    content:
      "تم التحقق، رقم القطعة صحيح ومطابق للمخطط. سأرفع التقرير اليوم بعد الظهر.",
    timestamp: "2025-04-10T10:30:00",
    isPinned: false,
    replyTo: {
      id: "n1",
      content: "تم الانتهاء من مراجعة وثائق الصك...",
      authorName: "سارة المالكي",
    },
  },
  {
    id: "n3",
    author: DUMMY_AUTHORS[2],
    content: "لاحظت أن صورة الواجهة الشمالية غير واضحة، هل يمكن إعادة التصوير؟",
    timestamp: "2025-04-11T08:00:00",
    isPinned: false,
  },
  {
    id: "n4",
    author: DUMMY_AUTHORS[0],
    content: "سأزور الموقع غداً الصباح وأرفع صوراً جديدة.",
    timestamp: "2025-04-11T08:45:00",
    isPinned: false,
    replyTo: {
      id: "n3",
      content: "لاحظت أن صورة الواجهة الشمالية غير واضحة...",
      authorName: "خالد العتيبي",
    },
  },
];

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
    rowsPerPage: "Rows per page",
    noData: "No matching records found",
    sar: "SAR",
    loading: "Loading transactions...",
    error: "Failed to load transactions.",
    attachmentsModal: "Attachments",
    dropFiles: "Drop files here or click to upload",
    supportedFormats: "PDF, JPG, PNG supported",
    noAttachments: "No attachments yet",
    pendingLabel: "Pending",
    enterFileName: "Enter file name...",
    deleteSelected: "Delete Selected",
    downloadSelected: "Download Selected",
    notesModal: "Follow-up Notes",
    notesPlaceholder: "Write a note...",
    sendNote: "Send",
    pinned: "Pinned",
    reply: "Reply",
    pin: "Pin",
    noNotes: "No notes yet. Start the conversation.",
    online: "online",
    participants: "Participants",
    // NEW image modal
    imagesModal: "Property Images",
    dropImages: "Drop images here or click to upload",
    supportedImageFormats: "JPG, PNG, WEBP supported",
    noImages: "No images yet",
    enterImageName: "Enter image name...",
    imageIndex: "Order",
    // NEW edit modal
    editTransactionModal: "Edit Transaction",
    saveChanges: "Save Changes",
    cancel: "Cancel",
    assignmentNumberLabel: "Assignment Number",
    authorizationNumberLabel: "Authorization Number",
    assignmentDateLabel: "Assignment Date",
    valuationPurposeLabel: "Valuation Purpose",
    intendedUseLabel: "Intended Use",
    valuationBasisLabel: "Valuation Basis",
    ownershipTypeLabel: "Ownership Type",
    valuationHypothesisLabel: "Valuation Hypothesis",
    clientIdLabel: "Client ID",
    branchLabel: "Branch",
    priorityLabel: "Priority",
    statusLabel: "Status",
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
    rowsPerPage: "صفوف في الصفحة",
    noData: "لم يتم العثور على سجلات مطابقة",
    sar: "ر.س",
    loading: "جاري تحميل المعاملات...",
    error: "فشل تحميل المعاملات.",
    attachmentsModal: "المرفقات",
    dropFiles: "اسحب الملفات هنا أو اضغط للرفع",
    supportedFormats: "يدعم PDF و JPG و PNG",
    noAttachments: "لا توجد مرفقات حتى الآن",
    pendingLabel: "قيد الرفع",
    enterFileName: "أدخل اسم الملف...",
    deleteSelected: "حذف المحدد",
    downloadSelected: "تحميل المحدد",
    notesModal: "ملاحظات المتابعة",
    notesPlaceholder: "اكتب ملاحظة...",
    sendNote: "إرسال",
    pinned: "مثبّت",
    reply: "رد",
    pin: "تثبيت",
    noNotes: "لا توجد ملاحظات بعد. ابدأ المحادثة.",
    online: "متصل",
    participants: "المشاركون",
    // NEW image modal
    imagesModal: "صور العقار",
    dropImages: "اسحب الصور هنا أو اضغط للرفع",
    supportedImageFormats: "يدعم JPG و PNG و WEBP",
    noImages: "لا توجد صور حتى الآن",
    enterImageName: "أدخل اسم الصورة...",
    imageIndex: "الترتيب",
    // NEW edit modal
    editTransactionModal: "تعديل بيانات المعاملة",
    saveChanges: "حفظ التغييرات",
    cancel: "إلغاء",
    assignmentNumberLabel: "رقم التكليف",
    authorizationNumberLabel: "رقم التعميد",
    assignmentDateLabel: "تاريخ التكليف",
    valuationPurposeLabel: "الغرض من التقييم",
    intendedUseLabel: "الاستخدام المقصود",
    valuationBasisLabel: "أساس التقييم",
    ownershipTypeLabel: "نوع الملكية",
    valuationHypothesisLabel: "فرضية التقييم",
    clientIdLabel: "معرّف العميل",
    branchLabel: "الفرع",
    priorityLabel: "الأولوية",
    statusLabel: "الحالة",
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

function formatCurrency(v: number) {
  if (v === 0) return "0.00";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function elapsedSince(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor((diffMs % 3600000) / 60000);
  const isOverdue = diffH >= 24;
  let label =
    diffH < 1
      ? "أقل من ساعة"
      : diffH < 24
        ? `${diffH} ساعة`
        : (() => {
            const d = Math.floor(diffH / 24);
            const r = diffH % 24;
            return r > 0 ? `${d} يوم و ${r} ساعة` : `${d} يوم`;
          })();
  return {
    label,
    isOverdue,
    timer: `${String(diffH).padStart(2, "0")}:${String(diffM).padStart(2, "0")}:00`,
  };
}
function byLabel(tfv?: Record<string, { label: string; value: string }>) {
  const map: Record<string, string> = {};
  if (!tfv) return map;
  Object.values(tfv).forEach((e) => {
    if (e?.label) map[e.label] = e.value ?? "";
  });
  return map;
}
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
    value:
      parseFloat(String(ed.finalAssetValue ?? tx.finalAssetValue ?? 0)) || 0,
    status: (ed.status || tx.status || "new") as ValuationStatus,
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
    rawData: tx,
  };
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  author,
  size = "md",
}: {
  author: NoteAuthor;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "h-6 w-6 text-[10px]"
      : size === "lg"
        ? "h-10 w-10 text-sm"
        : "h-8 w-8 text-xs";
  const initials = author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  return (
    <div
      className={cn(
        "shrink-0 rounded-full flex items-center justify-center font-bold text-white",
        author.color,
        sizeClass,
      )}
    >
      {initials}
    </div>
  );
}

// ─── Images Modal ─────────────────────────────────────────────────────────────

function ImagesModal({
  transactionId,
  requester,
  onClose,
  t,
  isRtl,
}: {
  transactionId: string;
  requester: string;
  onClose: () => void;
  t: Copy;
  isRtl: boolean;
}) {
  const [images, setImages] = useState<ImageFile[]>(
    [...DUMMY_IMAGES].sort((a, b) => a.sortIndex - b.sortIndex),
  );
  const [pending, setPending] = useState<PendingImageUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = useState<ImageFile | null>(null);

  // Drag-to-reorder state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep images sorted by sortIndex
  const sortedImages = useMemo(
    () => [...images].sort((a, b) => a.sortIndex - b.sortIndex),
    [images],
  );

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const preview = URL.createObjectURL(file);
      setPending((prev) => [
        ...prev,
        {
          id: `p-${Date.now()}-${Math.random()}`,
          file,
          name: file.name.replace(/\.[^.]+$/, ""),
          preview,
        },
      ]);
    });
  };

  const confirmUpload = (p: PendingImageUpload) => {
    const maxIndex = images.reduce((m, img) => Math.max(m, img.sortIndex), 0);
    setImages((prev) => [
      ...prev,
      {
        id: `img-${Date.now()}`,
        name: p.name || p.file.name,
        originalName: p.file.name,
        preview: p.preview,
        size: p.file.size,
        uploadedAt: new Date().toISOString(),
        sortIndex: maxIndex + 1,
      },
    ]);
    setPending((prev) => prev.filter((x) => x.id !== p.id));
  };

  // Direct index editing — renumber others to keep indices consistent
  const setImageIndex = (id: string, newIndex: number) => {
    if (newIndex < 1) return;
    setImages((prev) => {
      const clamped = Math.min(newIndex, prev.length);
      const sorted = [...prev].sort((a, b) => a.sortIndex - b.sortIndex);
      const moving = sorted.find((img) => img.id === id);
      if (!moving) return prev;
      const others = sorted.filter((img) => img.id !== id);
      others.splice(clamped - 1, 0, moving);
      return others.map((img, i) => ({ ...img, sortIndex: i + 1 }));
    });
  };

  // Drag-to-reorder handlers
  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== draggedId) setDragOverId(id);
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    setImages((prev) => {
      const sorted = [...prev].sort((a, b) => a.sortIndex - b.sortIndex);
      const fromIdx = sorted.findIndex((img) => img.id === draggedId);
      const toIdx = sorted.findIndex((img) => img.id === targetId);
      const reordered = [...sorted];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      return reordered.map((img, i) => ({ ...img, sortIndex: i + 1 }));
    });
    setDraggedId(null);
    setDragOverId(null);
  };

  const toggleSel = (id: string) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allSel =
    images.length > 0 && images.every((a) => selectedIds.has(a.id));
  const toggleSelAll = () =>
    setSelectedIds(allSel ? new Set() : new Set(images.map((a) => a.id)));
  const deleteSelected = () => {
    setImages((prev) => {
      const filtered = prev.filter((a) => !selectedIds.has(a.id));
      return filtered.map((img, i) => ({ ...img, sortIndex: i + 1 }));
    });
    setSelectedIds(new Set());
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div
          className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          style={{ maxHeight: "90vh" }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
                <ImageIcon className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  {t.imagesModal}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">{requester}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                {images.length} {isRtl ? "صورة" : "images"}
              </span>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* Upload zone */}
            <div className="px-6 pt-5 pb-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-7 transition-all",
                  isDragging
                    ? "border-violet-400 bg-violet-50/70"
                    : "border-slate-200 bg-slate-50/50 hover:border-violet-300 hover:bg-violet-50/30",
                )}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                    isDragging
                      ? "bg-violet-100"
                      : "border border-slate-200 bg-white",
                  )}
                >
                  <Upload
                    className={cn(
                      "h-5 w-5",
                      isDragging ? "text-violet-600" : "text-slate-400",
                    )}
                  />
                </div>
                <p className="text-sm font-medium text-slate-600">
                  {t.dropImages}
                </p>
                <p className="text-xs text-slate-400">
                  {t.supportedImageFormats}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {/* Pending queue */}
            {pending.length > 0 && (
              <div className="px-6 pb-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t.pendingLabel} ({pending.length})
                </p>
                <div className="space-y-3">
                  {pending.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <img
                          src={p.preview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) =>
                            setPending((prev) =>
                              prev.map((x) =>
                                x.id === p.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            )
                          }
                          placeholder={t.enterImageName}
                          className="w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                          {p.file.name} · {formatBytes(p.file.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => confirmUpload(p)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            setPending((prev) =>
                              prev.filter((x) => x.id !== p.id),
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Images grid */}
            <div className="px-6 pb-6">
              {images.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                  {t.noImages}
                </div>
              ) : (
                <>
                  {/* Bulk action bar */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allSel}
                        onCheckedChange={toggleSelAll}
                        className="h-4 w-4"
                      />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {isRtl ? "الصور" : "Images"} ({images.length})
                        {selectedIds.size > 0 && (
                          <span className="ms-1 text-violet-600">
                            · {selectedIds.size} {isRtl ? "محدد" : "selected"}
                          </span>
                        )}
                      </span>
                    </div>
                    {selectedIds.size > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {}}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {t.downloadSelected}
                        </button>
                        <button
                          onClick={deleteSelected}
                          className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t.deleteSelected}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Drag hint */}
                  <p className="mb-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <GripVertical className="h-3 w-3" />
                    {isRtl
                      ? "اسحب الصور لإعادة ترتيبها أو عدّل الرقم مباشرة"
                      : "Drag images to reorder or edit the index number directly"}
                  </p>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {sortedImages.map((img) => (
                      <div
                        key={img.id}
                        draggable
                        onDragStart={() => handleDragStart(img.id)}
                        onDragOver={(e) => handleDragOver(e, img.id)}
                        onDrop={(e) => handleDrop(e, img.id)}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverId(null);
                        }}
                        className={cn(
                          "group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all",
                          selectedIds.has(img.id)
                            ? "border-violet-400 ring-2 ring-violet-100"
                            : "border-slate-200 hover:shadow-md",
                          draggedId === img.id && "opacity-40 scale-95",
                          dragOverId === img.id &&
                            "border-violet-400 ring-2 ring-violet-200 scale-[1.02]",
                        )}
                      >
                        {/* Checkbox */}
                        <div className="absolute start-2 top-2 z-10">
                          <Checkbox
                            checked={selectedIds.has(img.id)}
                            onCheckedChange={() => toggleSel(img.id)}
                            className="h-4 w-4 border-white bg-white/80 data-[state=checked]:border-violet-600 data-[state=checked]:bg-violet-600"
                          />
                        </div>

                        {/* Drag handle */}
                        <div className="absolute end-2 top-2 z-10 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-black/40 text-white">
                            <GripVertical className="h-3.5 w-3.5" />
                          </div>
                        </div>

                        {/* Image preview */}
                        <div
                          className="relative aspect-[4/3] cursor-pointer overflow-hidden bg-slate-100"
                          onClick={() => setLightboxImg(img)}
                        >
                          <img
                            src={img.preview}
                            alt={img.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          {/* Delete on hover */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setImages((prev) => {
                                const filtered = prev.filter(
                                  (a) => a.id !== img.id,
                                );
                                return filtered.map((x, i) => ({
                                  ...x,
                                  sortIndex: i + 1,
                                }));
                              });
                              setSelectedIds((p) => {
                                const n = new Set(p);
                                n.delete(img.id);
                                return n;
                              });
                            }}
                            className="absolute bottom-2 end-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Name + index */}
                        <div className="p-2">
                          {editingNameId === img.id ? (
                            <input
                              autoFocus
                              type="text"
                              value={img.name}
                              onChange={(e) =>
                                setImages((prev) =>
                                  prev.map((a) =>
                                    a.id === img.id
                                      ? { ...a, name: e.target.value }
                                      : a,
                                  ),
                                )
                              }
                              onBlur={() => setEditingNameId(null)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && setEditingNameId(null)
                              }
                              className="w-full rounded border border-violet-300 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-200"
                            />
                          ) : (
                            <button
                              onClick={() => setEditingNameId(img.id)}
                              className="w-full truncate text-start text-xs font-medium text-slate-700 hover:text-violet-600 transition-colors"
                              title={img.name}
                            >
                              {img.name}
                            </button>
                          )}

                          {/* Index row */}
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {t.imageIndex}:
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={images.length}
                              value={img.sortIndex}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) setImageIndex(img.id, val);
                              }}
                              className="w-12 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-center text-[11px] font-bold text-violet-700 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-100"
                            />
                            <span className="ms-auto text-[10px] text-slate-400">
                              {formatBytes(img.size)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3">
            <p className="text-xs text-slate-400">
              {images.length} {isRtl ? "صورة" : "images"}
            </p>
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              {isRtl ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxImg(null)}
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImg.preview}
              alt={lightboxImg.name}
              className="w-full rounded-2xl object-contain max-h-[80vh]"
            />
            <div className="absolute bottom-0 inset-x-0 rounded-b-2xl bg-gradient-to-t from-black/70 to-transparent px-5 py-4">
              <p className="text-white font-semibold">{lightboxImg.name}</p>
              <p className="text-white/60 text-xs mt-0.5">
                {isRtl ? "الترتيب" : "Order"}: {lightboxImg.sortIndex} ·{" "}
                {formatBytes(lightboxImg.size)}
              </p>
            </div>
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute -top-3 -end-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Edit Transaction Modal ───────────────────────────────────────────────────

const FIELD_ICONS: Record<string, React.ComponentType<any>> = {
  assignmentNumber: Hash,
  authorizationNumber: BookOpen,
  assignmentDate: Calendar,
  valuationPurpose: Target,
  intendedUse: FileText,
  valuationBasis: Layers,
  ownershipType: Users,
  valuationHypothesis: GitBranch,
  clientId: User,
  branch: Building2,
  priority: AlertTriangle,
  status: CheckCircle2,
};

const STATUS_OPTIONS: ValuationStatus[] = [
  "new",
  "inspection",
  "review",
  "audit",
  "approved",
  "sent",
  "cancelled",
  "pending",
];
const PRIORITY_OPTIONS: Priority[] = ["normal", "urgent"];

function EditTransactionModal({
  row,
  onClose,
  onSave,
  t,
  isRtl,
}: {
  row: ValuationRow;
  onClose: () => void;
  onSave: (data: EditableTransactionData) => void;
  t: Copy;
  isRtl: boolean;
}) {
  const raw = row.rawData ?? {};
  const [form, setForm] = useState<EditableTransactionData>({
    assignmentNumber:
      raw.assignmentNumber ?? row.assignment.assignmentNumber ?? "",
    authorizationNumber:
      raw.authorizationNumber ?? row.assignment.authorizationNumber ?? "",
    assignmentDate: raw.assignmentDate ?? row.assignment.assignmentDate ?? "",
    valuationPurpose: raw.valuationPurpose ?? "",
    intendedUse: raw.intendedUse ?? "",
    valuationBasis: raw.valuationBasis ?? "",
    ownershipType: raw.ownershipType ?? "",
    valuationHypothesis: raw.valuationHypothesis ?? "",
    clientId: raw.clientId ?? "",
    branch: raw.branch ?? "",
    priority: raw.priority ?? row.priority ?? "normal",
    status: raw.status ?? row.status ?? "new",
  });

  const [isDirty, setIsDirty] = useState(false);

  const update = (key: keyof EditableTransactionData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  const fields: {
    key: keyof EditableTransactionData;
    labelKey: keyof Copy;
    type: "text" | "date" | "select";
    options?: string[];
    optionLabels?: string[];
  }[] = [
    {
      key: "assignmentNumber",
      labelKey: "assignmentNumberLabel",
      type: "text",
    },
    {
      key: "authorizationNumber",
      labelKey: "authorizationNumberLabel",
      type: "text",
    },
    { key: "assignmentDate", labelKey: "assignmentDateLabel", type: "date" },
    {
      key: "valuationPurpose",
      labelKey: "valuationPurposeLabel",
      type: "text",
    },
    { key: "intendedUse", labelKey: "intendedUseLabel", type: "text" },
    { key: "valuationBasis", labelKey: "valuationBasisLabel", type: "text" },
    { key: "ownershipType", labelKey: "ownershipTypeLabel", type: "text" },
    {
      key: "valuationHypothesis",
      labelKey: "valuationHypothesisLabel",
      type: "text",
    },
    { key: "clientId", labelKey: "clientIdLabel", type: "text" },
    { key: "branch", labelKey: "branchLabel", type: "text" },
    {
      key: "priority",
      labelKey: "priorityLabel",
      type: "select",
      options: PRIORITY_OPTIONS,
      optionLabels: PRIORITY_OPTIONS.map((p) => (t as any)[p] ?? p),
    },
    {
      key: "status",
      labelKey: "statusLabel",
      type: "select",
      options: STATUS_OPTIONS,
      optionLabels: STATUS_OPTIONS.map((s) => (t as any)[s] ?? s),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
              <Pencil className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {t.editTransactionModal}
              </h2>
              <p className="text-xs text-slate-400">
                {row.assignment.requester} ·{" "}
                <span className="font-mono text-slate-500">
                  #{row.assignment.referenceNumber}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600 ring-1 ring-amber-200">
                {isRtl ? "تغييرات غير محفوظة" : "Unsaved changes"}
              </span>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map(({ key, labelKey, type, options, optionLabels }) => {
              const Icon = FIELD_ICONS[key] ?? Hash;
              const label = (t as any)[labelKey] ?? key;
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Icon className="h-3.5 w-3.5 text-slate-400" />
                    {label}
                  </label>
                  {type === "select" ? (
                    <select
                      value={form[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 transition-colors"
                    >
                      {options?.map((opt, i) => (
                        <option key={opt} value={opt}>
                          {optionLabels?.[i] ?? opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={type}
                      value={form[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 transition-colors"
                      placeholder={`${isRtl ? "أدخل" : "Enter"} ${label}...`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Info note */}
          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              {isRtl
                ? "هذه البيانات الأساسية للمعاملة. البيانات الإضافية المرتبطة بنموذج التقييم تُعدَّل من داخل المعاملة."
                : "These are the core transaction fields. Template-specific evaluation data is edited from within the transaction itself."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            <Save className="h-4 w-4" />
            {t.saveChanges}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Attachments Modal ────────────────────────────────────────────────────────

function AttachmentsModal({
  requester,
  onClose,
  t,
  isRtl,
}: {
  transactionId: string;
  requester: string;
  onClose: () => void;
  t: Copy;
  isRtl: boolean;
}) {
  const [attachments, setAttachments] =
    useState<AttachmentFile[]>(DUMMY_ATTACHMENTS);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      const type: PendingUpload["type"] = isImage
        ? "image"
        : isPdf
          ? "pdf"
          : "other";
      const preview = isImage
        ? URL.createObjectURL(file)
        : isPdf
          ? "https://placehold.co/300x400/1e3a5f/ffffff?text=PDF"
          : null;
      setPending((prev) => [
        ...prev,
        {
          id: `p-${Date.now()}-${Math.random()}`,
          file,
          name: file.name.replace(/\.[^.]+$/, ""),
          preview,
          type,
        },
      ]);
    });
  };

  const confirmUpload = (p: PendingUpload) => {
    setAttachments((prev) => [
      ...prev,
      {
        id: `att-${Date.now()}`,
        name: p.name || p.file.name,
        originalName: p.file.name,
        type: p.type,
        preview: p.preview,
        size: p.file.size,
        uploadedAt: new Date().toISOString(),
      },
    ]);
    setPending((prev) => prev.filter((x) => x.id !== p.id));
  };

  const toggleSel = (id: string) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allSel =
    attachments.length > 0 && attachments.every((a) => selectedIds.has(a.id));
  const toggleSelAll = () =>
    setSelectedIds(allSel ? new Set() : new Set(attachments.map((a) => a.id)));
  const deleteSelected = () => {
    setAttachments((prev) => prev.filter((a) => !selectedIds.has(a.id)));
    setSelectedIds(new Set());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {t.attachmentsModal}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{requester}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {attachments.length} {t.attachments}
            </span>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Upload zone */}
          <div className="px-6 pt-5 pb-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-7 transition-all",
                isDragging
                  ? "border-cyan-400 bg-cyan-50/70"
                  : "border-slate-200 bg-slate-50/50 hover:border-cyan-300 hover:bg-cyan-50/30",
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                  isDragging
                    ? "bg-cyan-100"
                    : "border border-slate-200 bg-white",
                )}
              >
                <Upload
                  className={cn(
                    "h-5 w-5",
                    isDragging ? "text-cyan-600" : "text-slate-400",
                  )}
                />
              </div>
              <p className="text-sm font-medium text-slate-600">
                {t.dropFiles}
              </p>
              <p className="text-xs text-slate-400">{t.supportedFormats}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Pending queue */}
          {pending.length > 0 && (
            <div className="px-6 pb-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                {t.pendingLabel} ({pending.length})
              </p>
              <div className="space-y-3">
                {pending.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3"
                  >
                    <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {p.preview ? (
                        <img
                          src={p.preview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-100">
                          <File className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) =>
                          setPending((prev) =>
                            prev.map((x) =>
                              x.id === p.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          )
                        }
                        placeholder={t.enterFileName}
                        className="w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        {p.file.name} · {formatBytes(p.file.size)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => confirmUpload(p)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          setPending((prev) =>
                            prev.filter((x) => x.id !== p.id),
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachment grid */}
          <div className="px-6 pb-6">
            {attachments.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                {t.noAttachments}
              </div>
            ) : (
              <>
                {/* Bulk action bar */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSel}
                      onCheckedChange={toggleSelAll}
                      className="h-4 w-4"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {t.attachments} ({attachments.length})
                      {selectedIds.size > 0 && (
                        <span className="ms-1 text-cyan-600">
                          · {selectedIds.size} {isRtl ? "محدد" : "selected"}
                        </span>
                      )}
                    </span>
                  </div>
                  {selectedIds.size > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {}}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t.downloadSelected}
                      </button>
                      <button
                        onClick={deleteSelected}
                        className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t.deleteSelected}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md",
                        selectedIds.has(att.id)
                          ? "border-cyan-400 ring-2 ring-cyan-100"
                          : "border-slate-200",
                      )}
                    >
                      {/* Checkbox overlay */}
                      <div className="absolute start-2 top-2 z-10">
                        <Checkbox
                          checked={selectedIds.has(att.id)}
                          onCheckedChange={() => toggleSel(att.id)}
                          className="h-4 w-4 border-white bg-white/80 data-[state=checked]:border-cyan-600 data-[state=checked]:bg-cyan-600"
                        />
                      </div>
                      {/* Preview */}
                      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
                        {att.preview ? (
                          <img
                            src={att.preview}
                            alt={att.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <File className="h-8 w-8 text-slate-300" />
                          </div>
                        )}
                        <span className="absolute end-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          {att.type}
                        </span>
                        <button
                          onClick={() => {
                            setAttachments((prev) =>
                              prev.filter((a) => a.id !== att.id),
                            );
                            setSelectedIds((p) => {
                              const n = new Set(p);
                              n.delete(att.id);
                              return n;
                            });
                          }}
                          className="absolute bottom-2 end-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Name */}
                      <div className="p-2">
                        {editingId === att.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={att.name}
                            onChange={(e) =>
                              setAttachments((prev) =>
                                prev.map((a) =>
                                  a.id === att.id
                                    ? { ...a, name: e.target.value }
                                    : a,
                                ),
                              )
                            }
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && setEditingId(null)
                            }
                            className="w-full rounded border border-cyan-300 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-200"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingId(att.id)}
                            className="w-full truncate text-start text-xs font-medium text-slate-700 hover:text-cyan-600 transition-colors"
                            title={att.name}
                          >
                            {att.name}
                          </button>
                        )}
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {formatBytes(att.size)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3">
          <p className="text-xs text-slate-400">
            {attachments.length} {t.attachments}
          </p>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            {isRtl ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notes Modal ──────────────────────────────────────────────────────────────

function NotesModal({
  requester,
  onClose,
  t,
  isRtl,
}: {
  transactionId: string;
  requester: string;
  onClose: () => void;
  t: Copy;
  isRtl: boolean;
}) {
  const [notes, setNotes] = useState<NoteMessage[]>(DUMMY_NOTES);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<NoteMessage | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes]);

  const send = () => {
    const content = input.trim();
    if (!content) return;
    setNotes((prev) => [
      ...prev,
      {
        id: `n-${Date.now()}`,
        author: ME,
        content,
        timestamp: new Date().toISOString(),
        isPinned: false,
        replyTo: replyTo
          ? {
              id: replyTo.id,
              content: replyTo.content,
              authorName: replyTo.author.name,
            }
          : undefined,
      },
    ]);
    setInput("");
    setReplyTo(null);
  };

  const togglePin = (id: string) =>
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n)),
    );
  const pinnedNotes = notes.filter((n) => n.isPinned);

  // Group by day
  const grouped: { date: string; messages: NoteMessage[] }[] = [];
  notes.forEach((note) => {
    const d = formatDate(note.timestamp);
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== d) grouped.push({ date: d, messages: [note] });
    else last.messages.push(note);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ height: "min(85vh, 700px)" }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 bg-white px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50">
                <MessageCircle className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  {t.notesModal}
                </h2>
                <p className="text-xs text-slate-400">{requester}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowParticipants((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  showParticipants
                    ? "bg-slate-100 text-slate-700"
                    : "text-slate-500 hover:bg-slate-100",
                )}
              >
                <div className="flex -space-x-1 rtl:space-x-reverse">
                  {DUMMY_AUTHORS.map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[8px] font-bold text-white",
                        a.color,
                      )}
                    >
                      {a.name[0]}
                    </div>
                  ))}
                </div>
                <span>
                  {DUMMY_AUTHORS.length} {t.participants}
                </span>
              </button>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Participants panel */}
          {showParticipants && (
            <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-slate-50 p-3">
              {DUMMY_AUTHORS.map((author) => (
                <div
                  key={author.id}
                  className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 shadow-sm"
                >
                  <Avatar author={author} size="sm" />
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      {author.name}
                    </p>
                    <p className="text-[10px] text-slate-400">{author.role}</p>
                  </div>
                  {author.id === ME.id && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
                      {t.online}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pinned bar */}
        {pinnedNotes.length > 0 && (
          <div className="shrink-0 border-b border-amber-100 bg-amber-50/60 px-5 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600">
              <Pin className="h-3 w-3" />
              {t.pinned}
            </div>
            <div className="space-y-1">
              {pinnedNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center gap-2 text-xs text-amber-800"
                >
                  <Avatar author={note.author} size="sm" />
                  <p className="flex-1 truncate">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {notes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {t.noNotes}
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.date}>
                  {/* Day divider */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="whitespace-nowrap text-[11px] font-semibold text-slate-400">
                      {group.date}
                    </span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  <div className="space-y-4">
                    {group.messages.map((note) => {
                      const mine = note.author.id === ME.id;
                      return (
                        <div
                          key={note.id}
                          className={cn(
                            "flex gap-2.5",
                            mine ? "flex-row-reverse" : "flex-row",
                          )}
                        >
                          {!mine && <Avatar author={note.author} size="md" />}
                          <div
                            className={cn(
                              "group flex max-w-[75%] flex-col gap-1",
                              mine ? "items-end" : "items-start",
                            )}
                          >
                            {!mine && (
                              <span className="text-[11px] font-semibold text-slate-500">
                                {note.author.name} · {note.author.role}
                              </span>
                            )}
                            {/* Reply preview */}
                            {note.replyTo && (
                              <div
                                className={cn(
                                  "rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500",
                                  mine
                                    ? "border-e-2 border-cyan-300 text-end"
                                    : "border-s-2 border-slate-300",
                                )}
                              >
                                <p className="font-semibold">
                                  {note.replyTo.authorName}
                                </p>
                                <p className="truncate opacity-75">
                                  {note.replyTo.content}
                                </p>
                              </div>
                            )}
                            {/* Bubble */}
                            <div
                              className={cn(
                                "relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                                mine
                                  ? "rounded-te-sm bg-cyan-600 text-white"
                                  : "rounded-ts-sm bg-slate-100 text-slate-800",
                              )}
                            >
                              {note.isPinned && (
                                <Pin
                                  className={cn(
                                    "absolute -top-1.5 h-3 w-3 text-amber-400",
                                    mine ? "-start-1.5" : "-end-1.5",
                                  )}
                                />
                              )}
                              {note.content}
                            </div>
                            {/* Time + hover actions */}
                            <div
                              className={cn(
                                "flex items-center gap-2",
                                mine ? "flex-row-reverse" : "flex-row",
                              )}
                            >
                              <span className="text-[10px] text-slate-400">
                                {formatTime(note.timestamp)}
                              </span>
                              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  onClick={() => {
                                    setReplyTo(note);
                                    inputRef.current?.focus();
                                  }}
                                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                  title={t.reply}
                                >
                                  <Reply className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => togglePin(note.id)}
                                  className={cn(
                                    "flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-slate-100",
                                    note.isPinned
                                      ? "text-amber-500"
                                      : "text-slate-400 hover:text-slate-600",
                                  )}
                                  title={t.pin}
                                >
                                  <Pin className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Reply strip */}
        {replyTo && (
          <div className="shrink-0 flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-5 py-2">
            <div
              className={cn(
                "flex-1 rounded-lg bg-white px-3 py-1.5 text-xs",
                isRtl
                  ? "border-e-2 border-cyan-400"
                  : "border-s-2 border-cyan-400",
              )}
            >
              <p className="font-semibold text-cyan-700">
                {replyTo.author.name}
              </p>
              <p className="truncate text-slate-500">{replyTo.content}</p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Composer */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-cyan-300 focus-within:bg-white transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={t.notesPlaceholder}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              style={{ maxHeight: "120px", overflowY: "auto" }}
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white transition-all hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send
                className="h-4 w-4"
                style={{ transform: isRtl ? "scaleX(-1)" : undefined }}
              />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">
            Enter {isRtl ? "للإرسال" : "to send"} · Shift+Enter{" "}
            {isRtl ? "لسطر جديد" : "for new line"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── ActionButton ─────────────────────────────────────────────────────────────

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
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        config.bg,
        config.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dot)} />
      {(t as any)[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority, t }: { priority: Priority; t: Copy }) {
  if (priority === "urgent")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-inset ring-red-200 whitespace-nowrap">
        <AlertTriangle className="h-3 w-3" />
        {t.urgent}
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-200 whitespace-nowrap">
      {t.normal}
    </span>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ValuationTableRow({
  row,
  isSelected,
  onToggleSelect,
  onOpen,
  onOpenAttachments,
  onOpenNotes,
  onOpenImages,
  onEditTransaction,
  t,
}: {
  row: ValuationRow;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpen: (id: string) => void;
  onOpenAttachments: (row: ValuationRow) => void;
  onOpenNotes: (row: ValuationRow) => void;
  onOpenImages: (row: ValuationRow) => void;
  onEditTransaction: (row: ValuationRow) => void;
  t: Copy;
}) {
  return (
    <div
      className={cn(
        "group border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/50",
        isSelected && "bg-cyan-50/40",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="shrink-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="h-4 w-4"
          />
        </div>

        {/* Logo + priority */}
        <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
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
        </div>

        {/* Assignment */}
        <div className="w-44 min-w-0 shrink-0">
          <span className="truncate text-sm font-semibold text-slate-800">
            {row.assignment.requester}
          </span>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
            <span className="font-mono">#{row.assignment.referenceNumber}</span>
            <span>·</span>
            <span className="truncate">{row.assignment.template}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{row.assignment.assignmentDate}</span>
          </div>
          {row.assignment.assignmentNumber !== "—" && (
            <div className="mt-0.5 text-[11px] text-slate-400">
              <span className="font-medium">{t.assignmentNo}:</span>{" "}
              {row.assignment.assignmentNumber}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="w-48 min-w-0 shrink-0 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <User className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate">{row.details.ownerName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate">{row.details.propertyType}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate">{row.details.address}</span>
          </div>
          {row.details.deedNumber && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Hash className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {t.deedNo}: {row.details.deedNumber}
              </span>
            </div>
          )}
        </div>

        {/* Inspector + timer */}
        <div className="w-32 shrink-0 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <User className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate">{row.inspector}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <Clock
              className={cn(
                "h-3 w-3 shrink-0",
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
          <span className="block text-[10px] text-slate-400">
            {row.elapsedLabel}
          </span>
        </div>

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

        {/* Status */}
        <div className="flex w-24 shrink-0 items-center justify-center">
          <StatusBadge status={row.status} t={t} />
        </div>

        {/* Actions — 4-column grid, wraps to 2 rows */}
        <div className="shrink-0">
          <div className="grid grid-cols-4 gap-0.5">
            <ActionButton
              tooltip={t.openTransaction}
              onClick={() => onOpen(row.id)}
            >
              <Eye className="h-4 w-4" />
            </ActionButton>
            <ActionButton tooltip={t.viewReport}>
              <Printer className="h-4 w-4" />
            </ActionButton>
            <ActionButton tooltip={t.downloadPdf}>
              <FileDown className="h-4 w-4" />
            </ActionButton>
            <ActionButton
              tooltip={`${t.attachments} (${row.attachmentsCount})`}
              className="relative"
              onClick={() => onOpenAttachments(row)}
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
              onClick={() => onOpenNotes(row)}
            >
              <MessageCircle className="h-4 w-4" />
              {row.hasUnreadNotes && (
                <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </ActionButton>
            <ActionButton
              tooltip={`${t.images} (${row.imagesCount})`}
              className="relative"
              onClick={() => onOpenImages(row)}
            >
              <ImageIcon className="h-4 w-4" />
              {row.imagesCount > 0 && (
                <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">
                  {row.imagesCount}
                </span>
              )}
            </ActionButton>
            <ActionButton
              tooltip={t.editTransaction}
              onClick={() => onEditTransaction(row)}
            >
              <Pencil className="h-4 w-4" />
            </ActionButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem className="gap-2 text-sm">
                  <History className="h-4 w-4" />
                  {t.editLog}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-sm">
                  <Copy className="h-4 w-4" />
                  {t.duplicate}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

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
      <span className="text-xs text-slate-500">
        {t.showing} {start}-{end} {t.of} {totalItems} {t.entries}
      </span>
      <div className="hidden items-center gap-2 sm:flex">
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
        {[
          {
            icon: <ChevronsRight className="h-4 w-4 rtl:rotate-180" />,
            action: () => onPageChange(1),
            disabled: currentPage === 1,
          },
          {
            icon: <ChevronRight className="h-4 w-4 rtl:rotate-180" />,
            action: () => onPageChange(currentPage - 1),
            disabled: currentPage === 1,
          },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            disabled={btn.disabled}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {btn.icon}
          </button>
        ))}
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(
          (page) => (
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
          ),
        )}
        {[
          {
            icon: <ChevronLeft className="h-4 w-4 rtl:rotate-180" />,
            action: () => onPageChange(currentPage + 1),
            disabled: currentPage === totalPages,
          },
          {
            icon: <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />,
            action: () => onPageChange(totalPages),
            disabled: currentPage === totalPages,
          },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            disabled={btn.disabled}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {btn.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

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

// ─── Main export ──────────────────────────────────────────────────────────────

type ValuationTableProps = {
  className?: string;
  onOpenTransaction?: (id: string) => void;
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
  const [attachmentsModal, setAttachmentsModal] = useState<{
    open: boolean;
    row: ValuationRow | null;
  }>({ open: false, row: null });
  const [notesModal, setNotesModal] = useState<{
    open: boolean;
    row: ValuationRow | null;
  }>({ open: false, row: null });
  // NEW modal states
  const [imagesModal, setImagesModal] = useState<{
    open: boolean;
    row: ValuationRow | null;
  }>({ open: false, row: null });
  const [editModal, setEditModal] = useState<{
    open: boolean;
    row: ValuationRow | null;
  }>({ open: false, row: null });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paginatedData = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [rows, currentPage, pageSize],
  );
  const allSelected =
    paginatedData.length > 0 && paginatedData.every((r) => selected.has(r.id));

  const toggleSelectAll = useCallback(
    () =>
      setSelected((prev) => {
        const n = new Set(prev);
        allSelected
          ? paginatedData.forEach((r) => n.delete(r.id))
          : paginatedData.forEach((r) => n.add(r.id));
        return n;
      }),
    [allSelected, paginatedData],
  );
  const toggleSelect = useCallback(
    (id: string) =>
      setSelected((prev) => {
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

  // NEW: Handle save from edit modal — updates the row in local state
  const handleSaveEdit = useCallback(
    (data: EditableTransactionData) => {
      if (!editModal.row) return;
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== editModal.row!.id) return r;
          return {
            ...r,
            priority: data.priority as Priority,
            status: data.status as ValuationStatus,
            assignment: {
              ...r.assignment,
              assignmentNumber:
                data.assignmentNumber || r.assignment.assignmentNumber,
              assignmentDate:
                data.assignmentDate || r.assignment.assignmentDate,
              authorizationNumber:
                data.authorizationNumber || r.assignment.authorizationNumber,
            },
            rawData: { ...(r.rawData ?? {}), ...data },
          };
        }),
      );
    },
    [editModal.row],
  );

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
          <div className="min-w-[1100px]">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
              <div className="shrink-0">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  className="h-4 w-4"
                />
              </div>
              <div className="w-14 shrink-0" />
              <div className="w-44 shrink-0">
                <ColumnHeader label={t.assignment} sortable />
              </div>
              <div className="w-48 shrink-0">
                <ColumnHeader label={t.details} />
              </div>
              <div className="w-32 shrink-0">
                <ColumnHeader label={t.inspector} />
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
              <div className="shrink-0">
                <ColumnHeader label={t.actions} />
              </div>
            </div>

            {/* Rows */}
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
                    onToggleSelect={() => toggleSelect(row.id)}
                    onOpen={(id) => onOpenTransaction?.(id)}
                    onOpenAttachments={(r) =>
                      setAttachmentsModal({ open: true, row: r })
                    }
                    onOpenNotes={(r) => setNotesModal({ open: true, row: r })}
                    onOpenImages={(r) => setImagesModal({ open: true, row: r })}
                    onEditTransaction={(r) =>
                      setEditModal({ open: true, row: r })
                    }
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

      {/* Existing modals */}
      {attachmentsModal.open && attachmentsModal.row && (
        <AttachmentsModal
          transactionId={attachmentsModal.row.id}
          requester={attachmentsModal.row.assignment.requester}
          onClose={() => setAttachmentsModal({ open: false, row: null })}
          t={t}
          isRtl={isArabic}
        />
      )}
      {notesModal.open && notesModal.row && (
        <NotesModal
          transactionId={notesModal.row.id}
          requester={notesModal.row.assignment.requester}
          onClose={() => setNotesModal({ open: false, row: null })}
          t={t}
          isRtl={isArabic}
        />
      )}

      {/* NEW: Images modal */}
      {imagesModal.open && imagesModal.row && (
        <ImagesModal
          transactionId={imagesModal.row.id}
          requester={imagesModal.row.assignment.requester}
          onClose={() => setImagesModal({ open: false, row: null })}
          t={t}
          isRtl={isArabic}
        />
      )}

      {/* NEW: Edit transaction modal */}
      {editModal.open && editModal.row && (
        <EditTransactionModal
          row={editModal.row}
          onClose={() => setEditModal({ open: false, row: null })}
          onSave={handleSaveEdit}
          t={t}
          isRtl={isArabic}
        />
      )}
    </TooltipProvider>
  );
}
