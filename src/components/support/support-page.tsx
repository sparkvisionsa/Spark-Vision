"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bug, Check, ChevronLeft, ChevronRight, Code2, Headset, Lightbulb, Loader2, MessageCircle, Plus, RefreshCw, Search, ShieldCheck, Sparkles, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSupport } from "./support-provider";
import { useRealtime } from "./realtime-provider";
import { useSupportApi, supportError } from "./support-api";
import { SUPPORT_KINDS, SUPPORT_PRODUCTS, SUPPORT_STATUSES, productFromPath, type SupportAgent, type SupportProduct, type SupportTicket } from "./support-types";
import TicketThread, { StatusBadge } from "./ticket-thread";
import { cn } from "@/lib/utils";

function NewTicket({ open, onOpenChange, product, onCreated }: { open: boolean; onOpenChange: (value: boolean) => void; product: SupportProduct; onCreated: (ticket: SupportTicket) => void }) {
  const api = useSupportApi(); const [subject, setSubject] = useState(""); const [text, setText] = useState("");
  const [selectedProduct, setProduct] = useState(product); const [priority, setPriority] = useState("normal"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const clientId = useRef(crypto.randomUUID());
  useEffect(() => { if (open) setProduct(product); }, [open, product]);
  const submit = async () => {
    if (busy || subject.trim().length < 3 || !text.trim()) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ ticket: SupportTicket }>("/tickets", { method: "POST", body: JSON.stringify({ subject: subject.trim(), text: text.trim(), priority, product: selectedProduct, page: window.location.pathname, clientId: clientId.current }) });
      onCreated(result.ticket); onOpenChange(false); setSubject(""); setText(""); clientId.current = crypto.randomUUID();
    } catch (cause) { setError(supportError(cause)); } finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}><DialogContent dir="rtl" className="max-w-lg gap-3 rounded-2xl p-4"><DialogTitle className="flex items-center gap-2 text-base"><Headset className="h-5 w-5 text-cyan-600" />تذكرة جديدة</DialogTitle><DialogDescription className="sr-only">ارسل طلباً لفريق الدعم؛ تُضاف بيانات الشركة والحساب تلقائياً</DialogDescription><form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-3"><label className="block space-y-1 text-xs text-slate-500"><span>العنوان</span><Input autoFocus value={subject} onChange={e => setSubject(e.target.value)} minLength={3} maxLength={160} required disabled={busy} placeholder="كيف نساعدك؟" className="h-9" /></label><label className="block space-y-1 text-xs text-slate-500"><span>الرسالة</span><Textarea value={text} onChange={e => setText(e.target.value)} required maxLength={8000} rows={4} disabled={busy} placeholder="اكتب طلبك أو المشكلة التي واجهتك…" className="resize-none" /></label><div className="flex gap-2"><select aria-label="المنتج" value={selectedProduct} onChange={e => setProduct(e.target.value as SupportProduct)} disabled={busy} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs">{Object.entries(SUPPORT_PRODUCTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select aria-label="الأولوية" value={priority} onChange={e => setPriority(e.target.value)} disabled={busy} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="normal">عادية</option><option value="high">مرتفعة</option><option value="urgent">عاجلة</option></select></div>{error && <p role="alert" className="text-xs text-rose-600">{error}</p>}<Button type="submit" disabled={busy || subject.trim().length < 3 || !text.trim()} className="h-9 w-full bg-cyan-600 hover:bg-cyan-700">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}فتح التذكرة</Button></form></DialogContent></Dialog>;
}
function AgentManagement({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const api = useSupportApi(); const [agents, setAgents] = useState<SupportAgent[]>([]); const [phone, setPhone] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) void api<{ agents: SupportAgent[] }>("/agents").then(data => setAgents(data.agents)).catch(cause => setError(supportError(cause))); }, [api, open]);
  const change = async (value: string, enabled: boolean) => {
    setBusy(true); setError("");
    try { const data = await api<{ agents: SupportAgent[] }>("/agents", { method: "PATCH", body: JSON.stringify({ phone: value, enabled }) }); setAgents(data.agents); setPhone(""); }
    catch (cause) { setError(supportError(cause)); } finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="max-w-md gap-3 rounded-2xl p-4"><DialogTitle className="text-base">فريق الدعم</DialogTitle><DialogDescription className="text-xs">موظف الدعم يستطيع متابعة تذاكر جميع الشركات ومرفقاتها.</DialogDescription><form onSubmit={e => { e.preventDefault(); void change(phone.trim(), true); }} className="flex gap-2"><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="رقم الهاتف أو اسم مستخدم موجود" aria-label="رقم موظف الدعم" className="h-9" maxLength={60} /><Button type="submit" size="icon" disabled={busy || phone.trim().length < 3} className="h-9 w-9 shrink-0" aria-label="إضافة موظف دعم"><UserPlus className="h-4 w-4" /></Button></form>{error && <p role="alert" className="text-xs text-rose-600">{error}</p>}<div className="max-h-64 space-y-1 overflow-y-auto">{agents.map(agent => <div key={agent.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs"><ShieldCheck className="h-4 w-4 text-cyan-600" /><span>{agent.name}</span><span className="text-slate-400" dir="ltr">{agent.phone}</span>{agent.superAdmin ? <span className="ms-auto text-[10px] text-violet-600">مالك النظام</span> : <button disabled={busy} onClick={() => void change(agent.phone || agent.name, false)} className="ms-auto rounded p-1 text-rose-500 hover:bg-rose-50" aria-label={`إلغاء صلاحية ${agent.name}`}><X className="h-3.5 w-3.5" /></button>}</div>)}</div></DialogContent></Dialog>;
}

export default function SupportPage({ mode = "support", embedded = false, productOverride }: { mode?: "support" | "developer"; embedded?: boolean; productOverride?: SupportProduct }) {
  const api = useSupportApi(); const pathname = usePathname(); const query = useSearchParams();
  const { summary, refresh, openRecorder, openAssistant } = useSupport(); const { socket } = useRealtime();
  const developer = mode === "developer";
  const initialProduct = productOverride ?? productFromPath(pathname);
  const requestedProduct = query.get("product");
  const product = productOverride ?? (requestedProduct && requestedProduct in SUPPORT_PRODUCTS ? requestedProduct as SupportProduct : initialProduct);
  const [selected, setSelected] = useState<string | null>(query.get("ticket")); const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [status, setStatus] = useState("all"); const [kind, setKind] = useState(developer ? "developer" : "ticket"); const [productFilter, setProductFilter] = useState<string>(product === "general" ? "all" : product);
  const [search, setSearch] = useState(""); const [debounced, setDebounced] = useState(""); const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [hasMore, setHasMore] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [newOpen, setNewOpen] = useState(false); const [agentsOpen, setAgentsOpen] = useState(false); const version = useRef(0);
  useEffect(() => { const id = query.get("ticket"); if (id) setSelected(id); }, [query]);
  useEffect(() => { const timer = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async (quiet = false) => {
    const run = ++version.current;
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams({ status, kind, product: productFilter, q: debounced, page: String(page), mine: mine ? "1" : "0" });
      const data = await api<{ tickets: SupportTicket[]; total: number; hasMore: boolean }>(`/tickets?${params}`);
      if (run !== version.current) return;
      setTickets(data.tickets); setTotal(data.total); setHasMore(data.hasMore); setError("");
    } catch (cause) { if (run === version.current) setError(supportError(cause)); }
    finally { if (run === version.current) setLoading(false); }
  }, [api, status, kind, productFilter, debounced, page, mine]);
  useEffect(() => { void load(); return () => { version.current++; }; }, [load]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void load(true), 250); };
    const visibility = () => { if (document.visibilityState === "visible") changed(); };
    socket?.on("support:changed", changed).on("connect", changed);
    document.addEventListener("visibilitychange", visibility);
    const fallback = setInterval(() => { if (!socket?.connected && document.visibilityState === "visible") changed(); }, 20_000);
    return () => { if (timer) clearTimeout(timer); clearInterval(fallback); socket?.off("support:changed", changed).off("connect", changed); document.removeEventListener("visibilitychange", visibility); };
  }, [socket, load]);
  const select = (id: string | null) => {
    setSelected(id);
    if (embedded) return;
    const url = new URL(window.location.href); if (id) url.searchParams.set("ticket", id); else url.searchParams.delete("ticket");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  };
  const changed = useCallback(() => { void load(true); refresh(); }, [load, refresh]);
  return <main dir="rtl" className="flex min-h-0 w-full flex-col gap-3 p-1 text-slate-800 sm:p-2">
    <header className="flex flex-wrap items-center gap-2"><span className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white", developer ? "bg-violet-600" : "bg-slate-950 text-cyan-300")}>{developer ? <Code2 className="h-5 w-5" /> : <Headset className="h-5 w-5" />}</span><h1 className="text-lg font-bold">{developer ? "طلبات كن مطور" : summary.staff ? "مركز الدعم" : "الدعم والتذاكر"}</h1>{!developer && <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] text-slate-500"><span className={cn("h-1.5 w-1.5 rounded-full", summary.online ? "bg-emerald-500" : "bg-slate-300")} />{summary.online ? "فريق الدعم متصل" : "اترك رسالتك للدعم"}</span>}<div className="ms-auto flex flex-wrap gap-1.5">{summary.superAdmin && <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" aria-label="إدارة فريق الدعم" onClick={() => setAgentsOpen(true)}><ShieldCheck className="h-4 w-4" /></Button>}{developer && !summary.superAdmin && <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-xl text-xs text-violet-700" onClick={openRecorder}><Code2 className="h-4 w-4" />تسجيل جديد</Button>}{!developer && <Button size="sm" className="h-9 gap-1.5 rounded-xl bg-cyan-600 text-xs hover:bg-cyan-700" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" />تذكرة جديدة</Button>}</div></header>
    <div className="flex flex-wrap gap-1.5">{[{ key: "all", label: "الكل" }, ...Object.entries(SUPPORT_STATUSES).map(([key, label]) => ({ key, label: key === "waiting_user" && summary.staff ? "بانتظار المستخدم" : label }))].map(item => <button key={item.key} onClick={() => { setStatus(item.key); setPage(1); }} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition", status === item.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")}>{item.label}<span className={cn("rounded px-1 text-[10px]", status === item.key ? "bg-white/15" : "bg-slate-100")}>{item.key === "all" ? Object.values(summary.counts).reduce((a, b) => a + (b ?? 0), 0) : summary.counts[item.key as keyof typeof SUPPORT_STATUSES] ?? 0}</span></button>)}</div>
    <section className={cn("grid min-h-[420px] min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[310px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]", embedded ? "h-[min(720px,calc(100dvh-10rem))]" : "h-[calc(100dvh-15rem)]")}>
      <aside className={cn("flex min-h-0 flex-col border-e border-slate-100", selected && "hidden lg:flex")} aria-label="قائمة التذاكر">
        <div className="space-y-2 border-b border-slate-100 p-2.5"><div className="relative"><Search className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder={developer ? "بحث بالعنوان أو رقم الطلب" : "بحث بالعنوان أو رقم التذكرة"} aria-label={developer ? "البحث في طلبات كن مطور" : "البحث في التذاكر"} maxLength={120} className="h-9 rounded-lg border-slate-200 bg-slate-50 pr-9 text-xs" /></div><div className="flex gap-1.5"><select aria-label="تصفية المنتج" value={productFilter} onChange={e => { setProductFilter(e.target.value); setPage(1); }} className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1.5 text-[11px]"><option value="all">كل المنتجات</option>{Object.entries(SUPPORT_PRODUCTS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><Button size="icon" variant="ghost" className="h-8 w-7 shrink-0 text-slate-400" onClick={() => void load()} aria-label={developer ? "تحديث الطلبات" : "تحديث التذاكر"}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /></Button></div>{summary.staff && <label className="flex items-center gap-1.5 text-[11px] text-slate-500"><input type="checkbox" checked={mine} onChange={e => { setMine(e.target.checked); setPage(1); }} className="accent-cyan-600" />المسندة إليّ</label>}</div>
        {error && <p role="alert" className="bg-rose-50 p-2 text-xs text-rose-600">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
          {loading && !tickets.length ? <div className="space-y-2 p-1">{[1, 2, 3, 4].map(n => <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div> : !tickets.length ? <div className="flex flex-col items-center gap-2 px-3 py-8 text-center"><MessageCircle className="h-7 w-7 text-slate-200" /><p className="text-xs text-slate-400">{debounced || status !== "all" ? "لا توجد نتائج مطابقة" : developer ? "لا توجد طلبات كن مطور هنا بعد" : "لا توجد تذاكر هنا بعد"}</p>{!summary.superAdmin && <button onClick={() => developer ? openRecorder() : setNewOpen(true)} className="text-xs text-cyan-600">{developer ? "إرسال طلب جديد" : "فتح تذكرة"}</button>}</div> : tickets.map(row => { const Icon = row.kind === "bug" ? Bug : row.kind === "idea" ? Lightbulb : MessageCircle; return <button key={row._id} onClick={() => select(row._id)} className={cn("mb-1 w-full rounded-xl border p-2.5 text-start transition", row._id === selected ? "border-cyan-200 bg-cyan-50/60" : "border-transparent hover:bg-slate-50")} aria-current={row._id === selected ? "true" : undefined}><div className="flex items-center gap-1.5"><Icon className={cn("h-3.5 w-3.5 shrink-0", row.kind === "idea" ? "text-violet-500" : "text-cyan-600")} /><span className="truncate text-xs font-semibold">{row.subject}</span>{row.unread > 0 && <span className="ms-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-600 px-1 text-[9px] text-white">{row.unread > 99 ? "99+" : row.unread}</span>}</div><p className="mt-1 truncate text-[11px] text-slate-400">{row.lastMessage || row.companyName || row.number}</p><div className="mt-1.5 flex items-center gap-1"><StatusBadge status={row.status} />{row.priority !== "normal" && <span className="text-[9px] text-rose-500">{row.priority === "urgent" ? "عاجلة" : "مرتفعة"}</span>}<time className="ms-auto text-[9px] text-slate-400">{new Intl.DateTimeFormat("ar-SA", { month: "short", day: "numeric" }).format(new Date(row.updatedAt))}</time></div>{summary.staff && <div className="mt-1 truncate text-[9px] text-slate-400">{row.companyName || "حساب شخصي"} · {row.ownerPhone}</div>}</button>; })}
        </div>
        <div className="flex items-center gap-1 border-t border-slate-100 px-2 py-1.5 text-[10px] text-slate-400"><span>{total} طلب</span><span className="ms-auto">{page}</span><Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 1} aria-label="الصفحة السابقة" onClick={() => setPage(p => p - 1)}><ChevronRight className="h-3 w-3" /></Button><Button variant="ghost" size="icon" className="h-6 w-6" disabled={!hasMore} aria-label="الصفحة التالية" onClick={() => setPage(p => p + 1)}><ChevronLeft className="h-3 w-3" /></Button></div>
      </aside>
      <div className={cn("min-h-0 min-w-0", !selected && "hidden lg:block")}>
        {selected ? <TicketThread key={selected} id={selected} onBack={() => select(null)} onChanged={changed} /> : developer ? <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_center,#f5f3ff_0%,#fff_65%)] px-5 text-center"><span className="rounded-2xl border border-violet-100 bg-white p-4 text-violet-600 shadow-sm"><Code2 className="h-9 w-9" /></span><p className="text-sm font-semibold text-slate-700">التسجيلات والأفكار في مساحة مستقلة</p>{!summary.superAdmin && <Button size="sm" className="h-8 bg-violet-600 text-xs hover:bg-violet-700" onClick={openRecorder}><Code2 className="h-3.5 w-3.5" />تسجيل جديد</Button>}</div> : <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_center,#ecfeff_0%,#fff_65%)] px-5 text-center"><span className="rounded-2xl border border-cyan-100 bg-white p-4 text-cyan-600 shadow-sm"><Headset className="h-9 w-9" /></span><p className="text-sm font-semibold text-slate-700">كل محادثة، حتى الحل</p><div className="flex flex-wrap justify-center gap-2"><Button variant="outline" size="sm" className="h-8 text-xs" onClick={openAssistant}><Sparkles className="h-3.5 w-3.5" />اسأل المساعد</Button><Button size="sm" className="h-8 bg-cyan-600 text-xs hover:bg-cyan-700" onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5" />تذكرة جديدة</Button></div></div>}
      </div>
    </section>
    {!developer && <NewTicket open={newOpen} onOpenChange={setNewOpen} product={product} onCreated={ticket => { select(ticket._id); changed(); }} />}
    {summary.superAdmin && <AgentManagement open={agentsOpen} onOpenChange={setAgentsOpen} />}
  </main>;
}
