"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCheck, Download, History, Loader2, Paperclip, Send, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { useRealtime } from "./realtime-provider";
import { useSupport } from "./support-provider";
import { useSupportApi, supportError, uploadSupportFile } from "./support-api";
import { SUPPORT_KINDS, SUPPORT_PRODUCTS, SUPPORT_STATUSES, type SupportAgent, type SupportFile, type SupportMessage, type SupportTicket } from "./support-types";
import { cn } from "@/lib/utils";

const date = (raw: string) => new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(raw));
export function StatusBadge({ status }: { status: SupportTicket["status"] }) {
  return <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", status === "resolved" ? "bg-emerald-50 text-emerald-700" : status === "closed" ? "bg-slate-100 text-slate-500" : status === "waiting_user" ? "bg-amber-50 text-amber-700" : status === "planned" ? "bg-violet-50 text-violet-700" : "bg-cyan-50 text-cyan-700")}><span className="h-1 w-1 rounded-full bg-current" />{SUPPORT_STATUSES[status]}</span>;
}
function Attachment({ file }: { file: SupportFile }) {
  const url = `/api/support/files/${file.id}`;
  return <div className="mt-2 overflow-hidden rounded-lg border border-slate-200/60 bg-white/90 text-slate-700">
    {file.mime.startsWith("video/") && <video controls playsInline preload="metadata" src={url} className="max-h-64 w-full bg-slate-950" aria-label={file.name} />}
    {file.mime.startsWith("image/") && <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={file.name} loading="lazy" className="max-h-56 w-full object-contain" /></a>}
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2 py-1.5 text-[10px] hover:bg-slate-50"><Download className="h-3 w-3 shrink-0" /><span className="truncate">{file.name}</span><span className="ms-auto shrink-0 text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span></a>
  </div>;
}

export default function TicketThread({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const api = useSupportApi(); const { user, csrfToken } = useAuthTracking(); const { socket, connected } = useRealtime(); const { summary, refresh } = useSupport();
  const [ticket, setTicket] = useState<SupportTicket | null>(null); const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [more, setMore] = useState(false); const [olderLoading, setOlderLoading] = useState(false);
  const [text, setText] = useState(""); const [sending, setSending] = useState(false); const [uploading, setUploading] = useState(false); const [progress, setProgress] = useState(0);
  const [attachments, setAttachments] = useState<SupportFile[]>([]); const [agents, setAgents] = useState<SupportAgent[]>([]); const [typing, setTyping] = useState("");
  const [audit, setAudit] = useState(false); const [updating, setUpdating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null); const scroller = useRef<HTMLDivElement>(null); const nearBottom = useRef(true);
  const requestId = useRef(crypto.randomUUID()); const lastTyping = useRef(0); const loadVersion = useRef(0); const uploadController = useRef<AbortController>();
  const callbacks = useRef({ onChanged, refresh }); callbacks.current = { onChanged, refresh };
  const load = useCallback(async (quiet = false) => {
    const version = ++loadVersion.current;
    try {
      const result = await api<{ ticket: SupportTicket; messages: SupportMessage[]; hasMore: boolean }>(`/tickets/${id}`);
      if (version !== loadVersion.current) return;
      setTicket(result.ticket); setMore(result.hasMore); setError("");
      setMessages(current => {
        const latest = new Map(current.map(m => [m._id, m]));
        result.messages.forEach(m => latest.set(m._id, m));
        return [...latest.values()].sort((a, b) => a._id.localeCompare(b._id));
      });
      if (!quiet || nearBottom.current) requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; });
    } catch (cause) { if (version === loadVersion.current) setError(supportError(cause)); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, [api, id]);
  useEffect(() => { void load(); return () => { loadVersion.current++; uploadController.current?.abort(); }; }, [load]);
  useEffect(() => {
    if (!summary.staff) return;
    void api<{ agents: SupportAgent[] }>("/agents").then(data => setAgents(data.agents)).catch(() => {});
  }, [api, summary.staff]);
  useEffect(() => {
    if (!ticket) return;
    let timer: ReturnType<typeof setTimeout> | undefined; let typingTimer: ReturnType<typeof setTimeout> | undefined;
    const watch = () => { socket?.emit("support:watch", id, () => {}); void load(true); };
    if (socket?.connected) socket.emit("support:watch", id, () => {});
    const changed = (event: { ticketId: string }) => { if (event.ticketId !== id) return; if (timer) clearTimeout(timer); timer = setTimeout(() => void load(true), 180); };
    const showTyping = (event: { ticketId: string; userId: string; name: string; typing: boolean }) => {
      if (event.ticketId !== id || event.userId === user?.id) return;
      setTyping(event.typing ? event.name : ""); if (typingTimer) clearTimeout(typingTimer); typingTimer = setTimeout(() => setTyping(""), 3000);
    };
    socket?.on("support:changed", changed).on("support:typing", showTyping).on("connect", watch);
    const visibility = () => { if (document.visibilityState === "visible") void load(true); };
    document.addEventListener("visibilitychange", visibility);
    const fallback = setInterval(() => { if (!socket?.connected && document.visibilityState === "visible") void load(true); }, 15_000);
    return () => { if (timer) clearTimeout(timer); if (typingTimer) clearTimeout(typingTimer); clearInterval(fallback); socket?.off("support:changed", changed).off("support:typing", showTyping).off("connect", watch); socket?.emit("support:typing", { ticketId: id, typing: false }); socket?.emit("support:unwatch"); document.removeEventListener("visibilitychange", visibility); };
  }, [ticket?._id, socket, id, user?.id, load]);
  useEffect(() => {
    if (!messages.length || document.visibilityState !== "visible") return;
    const unread = messages.filter(m => summary.staff ? !m.staff && !m.readByStaff : m.staff && !m.readByOwner).slice(-200).map(m => m._id);
    if (unread.length) void api(`/tickets/${id}/read`, { method: "POST", body: JSON.stringify({ ids: unread }) }).then(() => callbacks.current.refresh()).catch(() => {});
  }, [api, id, messages, summary.staff]);
  const send = async () => {
    if (sending || uploading || (!text.trim() && !attachments.length)) return;
    setSending(true); setError("");
    try {
      await api(`/tickets/${id}/messages`, { method: "POST", body: JSON.stringify({ text: text.trim(), attachments: attachments.map(a => a.id), clientId: requestId.current }) });
      setText(""); setAttachments([]); requestId.current = crypto.randomUUID(); nearBottom.current = true;
      socket?.emit("support:typing", { ticketId: id, typing: false });
      await load(true); callbacks.current.onChanged(); callbacks.current.refresh();
    } catch (cause) { setError(supportError(cause)); } finally { setSending(false); }
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length || uploading) return;
    if (files.length + attachments.length > 4) { setError("يمكن إرفاق 4 ملفات في الرسالة الواحدة"); return; }
    if (Array.from(files).some(file => file.size > 100 * 1024 * 1024)) { setError("الحد الأقصى 100 ميجابايت لكل ملف"); return; }
    setUploading(true); setError(""); const abort = new AbortController(); uploadController.current = abort;
    try {
      for (const file of Array.from(files)) {
        setProgress(0); const saved = await uploadSupportFile(id, file, file.name, csrfToken, setProgress, abort.signal);
        setAttachments(current => [...current, saved]); requestId.current = crypto.randomUUID();
      }
    } catch (cause) { setError(cause instanceof DOMException && cause.name === "AbortError" ? "تم إيقاف الرفع" : supportError(cause)); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  const update = async (patch: object) => {
    if (!ticket || updating) return;
    setUpdating(true); setError("");
    try { await api(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ ...patch, revision: Number.isInteger(ticket.revision) ? ticket.revision : 0 }) }); await load(true); callbacks.current.onChanged(); callbacks.current.refresh(); }
    catch (cause) { setError(supportError(cause)); } finally { setUpdating(false); }
  };
  const older = async () => {
    if (olderLoading) return; setOlderLoading(true);
    const container = scroller.current; const previousHeight = container?.scrollHeight ?? 0;
    try {
      const result = await api<{ messages: SupportMessage[]; hasMore: boolean }>(`/tickets/${id}?before=${messages[0]?._id}`);
      setMessages(current => [...result.messages, ...current]); setMore(result.hasMore);
      requestAnimationFrame(() => { if (container) container.scrollTop += container.scrollHeight - previousHeight; });
    } catch (cause) { setError(supportError(cause)); } finally { setOlderLoading(false); }
  };
  if (loading) return <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" />تحميل المحادثة…</div>;
  if (!ticket) return <div className="p-4"><p role="alert" className="text-sm text-rose-600">{error}</p><Button variant="outline" size="sm" onClick={() => void load()}>إعادة المحاولة</Button></div>;
  return <div data-support-conversation className="flex h-full min-h-0 flex-col bg-white" dir="rtl">
    <div className="shrink-0 border-b border-slate-100 p-3">
      <div className="flex items-center gap-2"><Button size="icon" variant="ghost" className="h-7 w-7 lg:hidden" aria-label="العودة للتذاكر" onClick={onBack}><ArrowRight className="h-4 w-4" /></Button><span className="font-mono text-[10px] text-slate-400">{ticket.number}</span><StatusBadge status={ticket.status} /><button onClick={() => setAudit(!audit)} aria-label="سجل المتابعة" aria-expanded={audit} className="ms-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><History className="h-4 w-4" /></button></div>
      <h2 className="mt-1 truncate text-sm font-bold text-slate-800" title={ticket.subject}>{ticket.subject}</h2>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500"><span>{SUPPORT_PRODUCTS[ticket.product]}</span><span>·</span><span>{SUPPORT_KINDS[ticket.kind]}</span>{summary.staff && <><span>·</span><span>{ticket.companyName || "حساب شخصي"}</span><span dir="ltr">{ticket.ownerPhone}</span></>}<span className="ms-auto flex items-center gap-1"><span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-emerald-400" : "bg-amber-400")} />{connected ? "متصل" : "إعادة الاتصال…"}</span></div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {summary.staff ? <><Button variant="outline" size="sm" className="h-7 gap-1 border-cyan-200 px-2 text-[11px] text-cyan-700 hover:bg-cyan-50" disabled={updating || ticket.assigneeId === user?.id} onClick={() => user?.id && void update({ assigneeId: user.id })}><UserCheck className="h-3.5 w-3.5" />إسناد لي</Button><select aria-label="حالة التذكرة" value={ticket.status} disabled={updating} onChange={e => void update({ status: e.target.value })} className="h-7 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px]">{Object.entries(SUPPORT_STATUSES).map(([key, label]) => <option key={key} value={key}>{key === "waiting_user" ? "بانتظار المستخدم" : label}</option>)}</select><select aria-label="إسناد التذكرة" value={ticket.assigneeId ?? ""} disabled={updating} onChange={e => void update({ assigneeId: e.target.value || null })} className="h-7 max-w-44 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px]"><option value="">غير مسندة</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><select aria-label="أولوية التذكرة" value={ticket.priority} disabled={updating} onChange={e => void update({ priority: e.target.value })} className="h-7 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px]"><option value="normal">عادية</option><option value="high">مرتفعة</option><option value="urgent">عاجلة</option></select></> : <>{ticket.assigneeName && <span className="self-center text-[11px] text-slate-500">يتابعها: {ticket.assigneeName}</span>}<Button variant="outline" size="sm" className="ms-auto h-7 text-[11px]" disabled={updating} onClick={() => void update({ status: ticket.status === "closed" || ticket.status === "resolved" ? "open" : "closed" })}>{ticket.status === "closed" || ticket.status === "resolved" ? "إعادة فتح" : "إغلاق التذكرة"}</Button></>}
      </div>
      {audit && <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto rounded-lg bg-slate-50 p-2">{ticket.history.map((entry, i) => <div key={i} className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500"><Check className="h-3 w-3 text-cyan-600" /><span>{entry.status ? SUPPORT_STATUSES[entry.status] : "تحديث الإسناد أو الأولوية"}</span>{entry.assigneeName && <span>· {entry.assigneeName}</span>}<span>· {entry.by}</span><time className="ms-auto text-slate-400">{date(entry.at)}</time></div>)}</div>}
    </div>
    <div ref={scroller} onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50/70 p-3" role="log" aria-live="polite" aria-label="رسائل التذكرة">
      {more && <button disabled={olderLoading} onClick={() => void older()} className="block w-full text-center text-[11px] text-cyan-600">{olderLoading ? "جارٍ التحميل…" : "عرض رسائل أقدم"}</button>}
      {!messages.length && <p className="py-6 text-center text-xs text-slate-400">ابدأ المحادثة برسالة أو مرفق</p>}
      {messages.map(message => {
        const mine = message.senderId === user?.id;
        const read = message.staff ? message.readByOwner : message.readByStaff;
        return <div key={message._id} className={cn("w-fit max-w-[88%] rounded-2xl px-3 py-2 sm:max-w-[78%]", mine ? "ms-auto rounded-bl-sm bg-slate-900 text-white" : "me-auto rounded-br-sm border border-slate-200 bg-white text-slate-700")}>
          <div className={cn("mb-0.5 flex items-center gap-1.5 text-[10px]", mine ? "text-slate-300" : "text-slate-400")}><span>{mine ? "أنت" : message.senderName}</span>{message.staff && <span className={cn("rounded px-1 text-[9px]", mine ? "bg-cyan-800/60 text-cyan-100" : "bg-cyan-50 text-cyan-700")}>الدعم الفني</span>}</div>
          {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>}{message.attachments.map(file => <Attachment key={file.id} file={file} />)}
          <div className={cn("mt-1 flex items-center justify-end gap-1 text-[9px]", mine ? "text-slate-400" : "text-slate-400")}><time dateTime={message.createdAt}>{date(message.createdAt)}</time>{mine && (read ? <CheckCheck className="h-3.5 w-3.5 text-cyan-400" aria-label="مقروءة" /> : <Check className="h-3 w-3" aria-label="تم الإرسال" />)}</div>
        </div>;
      })}
    </div>
    {typing && <div role="status" className="px-3 py-1 text-[11px] text-cyan-600">{typing} يكتب الآن…</div>}
    {error && <div role="alert" className="flex items-start gap-2 bg-rose-50 px-3 py-2 text-xs text-rose-700"><span className="flex-1">{error}</span><button onClick={() => setError("")} aria-label="إغلاق رسالة الخطأ"><X className="h-3 w-3" /></button></div>}
    {ticket.status === "closed" ? <div className="flex shrink-0 items-center justify-center gap-2 border-t p-3 text-xs text-slate-500">التذكرة مغلقة<Button variant="outline" size="sm" className="h-7 text-xs" disabled={updating} onClick={() => void update({ status: "open" })}>إعادة فتح</Button></div> : <form className="shrink-0 border-t border-slate-100 p-2" onSubmit={event => { event.preventDefault(); void send(); }}>
      {attachments.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{attachments.map(file => <span key={file.id} className="flex max-w-44 items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px]"><Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{file.name}</span><button type="button" disabled={sending} onClick={() => { setAttachments(a => a.filter(x => x.id !== file.id)); requestId.current = crypto.randomUUID(); void api(`/files/${file.id}`, { method: "DELETE" }).catch(() => {}); }} aria-label={`إزالة ${file.name}`}><X className="h-3 w-3" /></button></span>)}</div>}
      {uploading && <div className="mb-2 flex items-center gap-2"><div role="progressbar" aria-label="رفع المرفق" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 flex-1 overflow-hidden rounded-full bg-cyan-100"><div className="h-full bg-cyan-600 transition-[width]" style={{ width: `${progress}%` }} /></div><span className="text-[10px] text-cyan-700">{progress}%</span><button type="button" aria-label="إلغاء الرفع" onClick={() => uploadController.current?.abort()}><X className="h-3 w-3" /></button></div>}
      <div className="flex items-end gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5"><input ref={fileInput} type="file" className="hidden" multiple accept="image/png,image/jpeg,image/webp,application/pdf,video/webm,video/mp4" onChange={event => void upload(event.target.files)} /><Button type="button" variant="ghost" size="icon" className="h-9 w-8 shrink-0 text-slate-500" aria-label="إرفاق ملف أو صورة" disabled={uploading || sending || attachments.length >= 4} onClick={() => fileInput.current?.click()}><Paperclip className="h-4 w-4" /></Button><Textarea value={text} disabled={sending} onChange={event => { setText(event.target.value); requestId.current = crypto.randomUUID(); if (Date.now() - lastTyping.current > 1500) { socket?.emit("support:typing", { ticketId: id, typing: true }); lastTyping.current = Date.now(); } }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} maxLength={8000} rows={1} placeholder="اكتب رسالتك…" aria-label="رسالتك للدعم" className="max-h-28 min-h-9 resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0" /><Button size="icon" type="submit" className="h-9 w-9 shrink-0 rounded-lg bg-cyan-600 hover:bg-cyan-700" disabled={sending || uploading || (!text.trim() && !attachments.length)} aria-label="إرسال الرسالة">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div>
    </form>}
  </div>;
}
