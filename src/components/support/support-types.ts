export const SUPPORT_STATUSES = { open: "مفتوحة", in_progress: "قيد العمل", waiting_user: "بانتظار ردك", planned: "مخطط لها", resolved: "تم الحل", closed: "مغلقة" } as const;
export const SUPPORT_PRODUCTS = { "machine-valuation": "الآلات والمعدات", "real-estate-valuation": "العقارات", "helper-tools": "الأدوات المساعدة", "evaluation-source": "مصادر المعلومات", "value-tech-app": "رفع التقارير", "asset-inventory": "حصر الأصول", "asset-inspection": "معاينة الأصول", general: "النظام" } as const;
export const SUPPORT_KINDS = { ticket: "تذكرة دعم", bug: "بلاغ مصوّر", idea: "فكرة تطوير" } as const;
export type SupportStatus = keyof typeof SUPPORT_STATUSES;
export type SupportProduct = keyof typeof SUPPORT_PRODUCTS;
export type SupportKind = keyof typeof SUPPORT_KINDS;
export type SupportCounts = Partial<Record<SupportStatus, number>>;
export type SupportTicketList = { tickets: SupportTicket[]; total: number; page: number; hasMore: boolean; counts: SupportCounts };
export type SupportFile = { id: string; name: string; mime: string; size: number };
export type SupportTicket = {
  _id: string; number: string; ownerId: string; ownerName: string; ownerPhone: string; companyId: string | null; companyName: string;
  subject: string; product: SupportProduct; kind: SupportKind; status: SupportStatus; priority: "normal" | "high" | "urgent";
  page: string; assigneeId: string | null; assigneeName: string | null; createdAt: string; updatedAt: string;
  lastMessage: string; unread: number; revision: number;
  history: { at: string; by: string; status?: SupportStatus; assigneeName?: string | null }[];
};
export type SupportMessage = { _id: string; ticketId: string; senderId: string; senderName: string; staff: boolean; text: string; attachments: SupportFile[]; createdAt: string; readByOwner: boolean; readByStaff: boolean };
export type SupportNotification = { _id: string; ticketId: string; channel: "support" | "developer"; event: "created" | "message" | "status" | "assignment"; title: string; body: string; createdAt: string; readAt: string | null };
export type SupportSummary = { staff: boolean; superAdmin: boolean; online: boolean; unread: number; notificationUnread: number; counts: Partial<Record<SupportStatus, number>> };
export type SupportArticle = { id: string; title: string; product: string; href: string; intro: string; steps: string[]; targets?: string[] };
export type AssistantAnswer = { answer: string; steps: string[]; handoff: boolean; sources: SupportArticle[]; mode: "ai" | "guide" };
export type SupportAgent = { id: string; name: string; phone?: string; superAdmin: boolean };
export function productFromPath(path: string): SupportProduct {
  const segment = path.split("/").filter(Boolean)[0];
  return segment && segment in SUPPORT_PRODUCTS ? segment as SupportProduct : "general";
}
export function supportHref(product: SupportProduct, ticketId?: string) {
  const base = product === "general" ? "/support" : `/${product}/support`;
  const query = new URLSearchParams({ product });
  if (ticketId) query.set("ticket", ticketId);
  return `${base}?${query}`;
}
export function developerRequestsHref(product?: SupportProduct, ticketId?: string) {
  const query = new URLSearchParams();
  if (product) query.set("product", product);
  if (ticketId) query.set("ticket", ticketId);
  const value = query.toString();
  const base = !product || product === "general" ? "/developer-requests" : `/${product}/developer-requests`;
  return `${base}${value ? `?${value}` : ""}`;
}
