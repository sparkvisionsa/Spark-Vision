"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, Bot, Check, ChevronLeft, Code2, Headset, History, Loader2, MessageCircle, MousePointer2, RotateCcw, Sparkles, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSupportApi, supportError } from "./support-api";
import { useSupport } from "./support-provider";
import { developerRequestsHref, productFromPath, supportHref, type AssistantAnswer, type SupportArticle, type SupportTicket } from "./support-types";
import ScreenRecorder from "./screen-recorder";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string; response?: AssistantAnswer };

type DockPlacement = { side: "left" | "right"; edge: "top" | "bottom"; offset: number };
function intersectionArea(one: DOMRect, two: DOMRect) {
  const width = Math.max(0, Math.min(one.right, two.right) - Math.max(one.left, two.left));
  const height = Math.max(0, Math.min(one.bottom, two.bottom) - Math.max(one.top, two.top));
  return width * height;
}
/** Keeps persistent support controls available without sitting over a page action. */
function useDockPlacement(ref: React.RefObject<HTMLElement | null>) {
  const [placement, setPlacement] = useState<DockPlacement>({ side: "left", edge: "bottom", offset: 16 });
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const dock = ref.current;
      if (!dock || document.visibilityState === "hidden") return;
      const { width, height } = dock.getBoundingClientRect();
      if (!width || !height) return;
      const targets = Array.from(document.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [role='button']")).filter(node => {
        if (node.closest("[data-support-dock], [data-support-guide], [role='dialog'], [data-radix-popper-content-wrapper]")) return false;
        const rect = node.getBoundingClientRect();
        const styles = window.getComputedStyle(node);
        return rect.width > 4 && rect.height > 4 && styles.visibility !== "hidden" && styles.display !== "none";
      }).map(node => node.getBoundingClientRect());
      const readableAreas = Array.from(document.querySelectorAll<HTMLElement>("[role='log'], [data-support-conversation]")).filter(node => {
        const rect = node.getBoundingClientRect(); const styles = window.getComputedStyle(node);
        return rect.width > 4 && rect.height > 4 && styles.visibility !== "hidden" && styles.display !== "none";
      }).map(node => node.getBoundingClientRect());
      const offsets = [16, 88, 160, 232, 304];
      const candidates = offsets.flatMap(offset => [
        { side: "left" as const, edge: "bottom" as const, offset }, { side: "right" as const, edge: "bottom" as const, offset },
        { side: "left" as const, edge: "top" as const, offset }, { side: "right" as const, edge: "top" as const, offset },
      ]);
      let best = candidates[0]!; let bestScore = Number.POSITIVE_INFINITY;
      for (let index = 0; index < candidates.length; index++) {
        const candidate = candidates[index]!;
        const left = candidate.side === "left" ? 16 : window.innerWidth - width - 16;
        const top = candidate.edge === "bottom" ? window.innerHeight - height - candidate.offset : candidate.offset;
        const rect = new DOMRect(left, top, width, height);
        const score = targets.reduce((total, target) => total + intersectionArea(rect, target) * 8, 0) + readableAreas.reduce((total, area) => total + intersectionArea(rect, area) * 12, 0) + index * 0.25;
        if (score < bestScore) { best = candidate; bestScore = score; }
      }
      setPlacement(current => current.side === best.side && current.edge === best.edge && current.offset === best.offset ? current : best);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    schedule();
    const observer = new MutationObserver(schedule); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "disabled", "hidden"] });
    const resize = new ResizeObserver(schedule); if (ref.current) resize.observe(ref.current);
    window.addEventListener("resize", schedule); window.addEventListener("scroll", schedule, true);
    return () => { if (frame) cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect(); window.removeEventListener("resize", schedule); window.removeEventListener("scroll", schedule, true); };
  }, [ref]);
  return placement;
}

function useConversationSurface() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const surface = document.querySelector<HTMLElement>("[data-support-conversation]");
      if (!surface) { setVisible(false); return; }
      const rect = surface.getBoundingClientRect(); const styles = window.getComputedStyle(surface);
      setVisible(rect.width > 4 && rect.height > 4 && styles.visibility !== "hidden" && styles.display !== "none");
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    schedule();
    const observer = new MutationObserver(schedule); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    window.addEventListener("resize", schedule);
    return () => { if (frame) cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", schedule); };
  }, []);
  return visible;
}

function Guide({ article, onClose }: { article: SupportArticle; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const highlight = () => {
      const target = article.targets?.[Math.min(step, (article.targets?.length ?? 1) - 1)];
      if (!target) { setRect(null); return; }
      const node = Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="tab"]')).find(el => !el.closest("[data-support-guide]") && el.getBoundingClientRect().width > 0 && (el.textContent?.trim() === target || el.getAttribute("aria-label") === target));
      setRect(node?.getBoundingClientRect() ?? null);
    };
    highlight(); const timer = setInterval(highlight, 750);
    window.addEventListener("resize", highlight);
    return () => { clearInterval(timer); window.removeEventListener("resize", highlight); };
  }, [article, step]);
  return <div data-support-guide dir="rtl">
    {rect && <div className="pointer-events-none fixed z-[75] rounded-lg border-2 border-violet-500 shadow-[0_0_0_4px_rgba(139,92,246,0.18)]" style={{ top: rect.top - 3, left: rect.left - 3, width: rect.width + 6, height: rect.height + 6 }} />}
    <section className="fixed bottom-24 left-4 z-[80] w-[min(350px,calc(100vw-2rem))] rounded-2xl border border-violet-200 bg-white p-3 shadow-xl" aria-label="الدليل التفاعلي">
      <div className="flex items-center gap-2"><MousePointer2 className="h-4 w-4 text-violet-600" /><span className="flex-1 text-xs font-bold">{article.title}</span><button onClick={onClose} aria-label="إغلاق الدليل" className="rounded p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      <p className="my-2 text-sm leading-6 text-slate-600">{article.steps[step]}</p>
      <div className="flex items-center gap-2"><span className="text-xs text-slate-400">{step + 1} / {article.steps.length}</span><Button asChild variant="ghost" size="sm" className="h-7 text-xs"><Link href={article.href}>فتح الصفحة</Link></Button><Button size="sm" className="ms-auto h-7 bg-violet-600 text-xs hover:bg-violet-700" onClick={() => step + 1 < article.steps.length ? setStep(step + 1) : onClose()}>{step + 1 === article.steps.length ? "تم" : "التالي"}<ChevronLeft className="h-3 w-3" /></Button></div>
    </section>
  </div>;
}

export default function SupportDock({ assistantOpen, onAssistantOpen, recorderOpen, onRecorderOpen }: { assistantOpen: boolean; onAssistantOpen: (value: boolean) => void; recorderOpen: boolean; onRecorderOpen: (value: boolean) => void }) {
  const api = useSupportApi(); const router = useRouter(); const { summary, refresh, openSupport, openDeveloperRequests } = useSupport();
  const [messages, setMessages] = useState<ChatMessage[]>([]); const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false); const [handoff, setHandoff] = useState(false); const [error, setError] = useState("");
  const [guide, setGuide] = useState<SupportArticle | null>(null);
  const scroller = useRef<HTMLDivElement>(null); const textarea = useRef<HTMLTextAreaElement>(null);
  const controller = useRef<AbortController>(); const transferId = useRef(crypto.randomUUID());
  const dock = useRef<HTMLDivElement>(null); const placement = useDockPlacement(dock);
  const conversationVisible = useConversationSurface(); const hideDock = assistantOpen || recorderOpen || conversationVisible;
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [messages, busy, assistantOpen]);
  useEffect(() => () => controller.current?.abort(), []);
  const ask = async (question = input) => {
    if (!question.trim() || busy) return;
    const text = question.trim(); setInput(""); setBusy(true); setError("");
    const history = messages.slice(-10).map(m => ({ role: m.role, text: m.text.slice(0, 4000) }));
    setMessages(current => [...current, { id: crypto.randomUUID(), role: "user", text }]);
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await api<AssistantAnswer>("/assistant", { method: "POST", signal: abort.signal, body: JSON.stringify({ question: text, history, product: productFromPath(window.location.pathname), page: window.location.pathname }) });
      setMessages(current => [...current, { id: crypto.randomUUID(), role: "assistant", text: [response.answer, ...response.steps].join("\n"), response }]);
      transferId.current = crypto.randomUUID();
    } catch (cause) { if (!abort.signal.aborted) { setError(supportError(cause)); setInput(text); } }
    finally { setBusy(false); textarea.current?.focus(); }
  };
  const contactSupport = async () => {
    if (handoff) return;
    setHandoff(true); setError("");
    try {
      const product = productFromPath(window.location.pathname);
      const text = messages.length ? messages.slice(-10).map(m => `${m.role === "user" ? "المستخدم" : "المساعد"}: ${m.text}`).join("\n\n").slice(-7800) : "أرغب بالتواصل مع الدعم الفني.";
      const result = await api<{ ticket: SupportTicket }>("/tickets", { method: "POST", body: JSON.stringify({ subject: messages.find(m => m.role === "user")?.text.slice(0, 150) || "محادثة مباشرة مع الدعم الفني", text, product, page: window.location.pathname, clientId: transferId.current }) });
      refresh(); closeAssistant(false);
      if (product === "general") openSupport(); else router.push(supportHref(product, result.ticket._id));
    } catch (cause) { setError(supportError(cause)); } finally { setHandoff(false); }
  };
  const recorderChange = useCallback((value: boolean) => onRecorderOpen(value), [onRecorderOpen]);
  const openSupportTickets = () => {
    const product = productFromPath(window.location.pathname);
    if (product === "general") openSupport(); else router.push(supportHref(product));
  };
  const closeAssistant = (value: boolean) => {
    if (!value) { setMessages([]); setInput(""); setError(""); transferId.current = crypto.randomUUID(); }
    onAssistantOpen(value);
  };
  return <>
    <div ref={dock} style={{ bottom: placement.edge === "bottom" ? placement.offset : undefined, top: placement.edge === "top" ? placement.offset : undefined, left: placement.side === "left" ? 16 : "auto", right: placement.side === "right" ? 16 : "auto" }} className={cn("fixed z-[65] flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2 transition-all duration-200 print:hidden", hideDock && "pointer-events-none -translate-y-2 opacity-0")} dir="rtl" data-support-dock aria-hidden={hideDock}>
      <button onClick={() => assistantOpen ? closeAssistant(false) : onAssistantOpen(true)} aria-label="فتح مساعد فاليو تك" aria-expanded={assistantOpen} className={cn("group relative flex h-11 w-fit max-w-full items-center gap-1.5 rounded-full border px-2 text-right backdrop-blur-md transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/50", assistantOpen ? "border-slate-800 bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.28)]" : "border-cyan-300/90 bg-cyan-100/90 text-cyan-950 shadow-[0_8px_22px_rgba(8,145,178,0.18)] hover:-translate-y-1 hover:border-slate-200 hover:bg-slate-950 hover:text-white hover:shadow-[0_12px_28px_rgba(15,23,42,0.28)]")}>
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center"><Bot className={cn("h-[18px] w-[18px] transition-colors", assistantOpen ? "text-cyan-200" : "text-cyan-800 group-hover:text-cyan-200")} /><span className={cn("absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2", assistantOpen ? "ring-slate-950" : "ring-cyan-100 group-hover:ring-slate-950")} /></span>
        <span className="whitespace-nowrap text-xs font-bold">اسأل فاليو تك</span>
        {summary.unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-5 shadow-sm">{summary.unread > 99 ? "99+" : summary.unread}</span>}
      </button>
      <button title="الدعم الفني والتذاكر" onClick={openSupportTickets} className="group relative flex h-11 w-fit max-w-full items-center gap-1.5 rounded-full border border-cyan-300/90 bg-cyan-100/90 px-2 text-right text-cyan-950 shadow-[0_8px_22px_rgba(8,145,178,0.18)] backdrop-blur-md transition duration-200 hover:-translate-y-1 hover:border-cyan-400 hover:bg-cyan-200/90 hover:shadow-[0_12px_28px_rgba(8,145,178,0.24)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/50" aria-label="فتح الدعم الفني والتذاكر">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center"><Headset className="h-[18px] w-[18px] text-cyan-800 transition-transform group-hover:scale-110" /></span><span className="whitespace-nowrap text-xs font-bold">الدعم والتذاكر</span>
        {summary.unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-cyan-600 px-1 text-center text-[10px] font-bold leading-5 text-white shadow-sm">{summary.unread > 99 ? "99+" : summary.unread}</span>}
      </button>
      {summary.superAdmin ? <button title="متابعة طلبات المطورين" onClick={() => { const product = productFromPath(window.location.pathname); if (product === "general") openDeveloperRequests(); else router.push(developerRequestsHref(product)); }} className="group flex h-11 w-fit max-w-full items-center gap-1.5 rounded-full border border-violet-300/90 bg-violet-100/90 px-2 text-right text-violet-950 shadow-[0_8px_22px_rgba(109,40,217,0.18)] backdrop-blur-md transition duration-200 hover:-translate-y-1 hover:border-violet-400 hover:bg-violet-200/90 hover:shadow-[0_12px_28px_rgba(109,40,217,0.24)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300/50" aria-label="فتح طلبات المطورين"><span className="flex h-8 w-8 shrink-0 items-center justify-center"><History className="h-[18px] w-[18px] text-violet-800 transition-transform group-hover:scale-110" /></span><span className="whitespace-nowrap text-xs font-bold">طلبات المطورين</span></button> : <button title="كن مطور: سجّل مشكلة أو فكرة" onClick={() => { closeAssistant(false); onRecorderOpen(true); }} className="group flex h-11 w-fit max-w-full items-center gap-1.5 rounded-full border border-violet-300/90 bg-violet-100/90 px-2 text-right text-violet-950 shadow-[0_8px_22px_rgba(109,40,217,0.18)] backdrop-blur-md transition duration-200 hover:-translate-y-1 hover:border-violet-400 hover:bg-violet-200/90 hover:shadow-[0_12px_28px_rgba(109,40,217,0.24)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300/50" aria-label="كن مطور: تسجيل مشكلة أو فكرة"><span className="flex h-8 w-8 shrink-0 items-center justify-center"><Code2 className="h-[18px] w-[18px] text-violet-800 transition-transform group-hover:scale-110" /></span><span className="whitespace-nowrap text-xs font-bold">كن مطور</span></button>}
    </div>
    <Dialog open={assistantOpen} onOpenChange={closeAssistant} modal={false}>
      <DialogContent dir="rtl" data-support-chat className="fixed bottom-20 left-4 right-auto top-auto flex h-[min(650px,calc(100dvh-7rem))] w-[min(420px,calc(100vw-2rem))] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 p-0 shadow-2xl [&>button]:text-white" onInteractOutside={e => { if ((e.target as HTMLElement).closest("[data-support-dock]")) e.preventDefault(); }}>
        <div className="flex shrink-0 items-center gap-2 bg-slate-950 p-3 text-white"><span className="rounded-xl bg-white/10 p-2"><Sparkles className="h-5 w-5 text-cyan-300" /></span><DialogTitle className="text-sm">مساعد فاليو تك</DialogTitle><Button size="icon" variant="ghost" disabled={busy || handoff} className="ms-auto me-6 h-7 w-7 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="محادثة جديدة" onClick={() => { setMessages([]); setError(""); transferId.current = crypto.randomUUID(); }}><RotateCcw className="h-3.5 w-3.5" /></Button></div>
        <DialogDescription className="sr-only">مساعد عربي لشرح خطوات استخدام أنظمة فاليو تك والتواصل مع الدعم الفني</DialogDescription>
        <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50/70 p-3" role="log" aria-label="المحادثة مع المساعد" aria-live="polite">
          {!messages.length && <div className="space-y-3"><div className="rounded-xl border border-slate-100 bg-white p-3"><p className="text-sm font-semibold text-slate-800">أهلاً بك، كيف أساعدك؟</p><p className="mt-1 text-xs leading-6 text-slate-500">اسألني عن أي خطوة في النظام، أو تواصل مع فريق الدعم.</p></div><div><p className="mb-1.5 px-1 text-xs font-bold text-slate-700">الأسئلة الشائعة</p><div className="grid gap-2">{["كيف أنشئ مشروع تقييم آلات؟", "كيف أنزّل التقرير النهائي؟", "كيف أضيف مستخدمي التقرير والتوقيعات؟", "كيف أحوّل الصور إلى PDF؟"].map(question => <button key={question} onClick={() => void ask(question)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-start text-xs text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50"><MessageCircle className="h-3.5 w-3.5 shrink-0 text-cyan-600" />{question}<ChevronLeft className="ms-auto h-3 w-3 shrink-0" /></button>)}</div></div></div>}
          {messages.map(message => <div key={message.id} className={cn("max-w-[95%] rounded-2xl p-3 text-sm leading-7", message.role === "user" ? "ms-auto rounded-bl-sm bg-slate-900 text-white" : "me-auto rounded-br-sm border border-slate-200 bg-white text-slate-700")}>
            {message.response ? <><p className="whitespace-pre-wrap">{message.response.answer}</p>{message.response.steps.length > 0 && <ol className="mt-2 space-y-2">{message.response.steps.map((step, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-[10px] font-bold text-cyan-700">{i + 1}</span><span className="text-xs leading-6">{step}</span></li>)}</ol>}<div className="mt-2 flex flex-wrap gap-1.5">{message.response.sources.slice(0, 2).map(source => <button key={source.id} onClick={() => { setGuide(source); closeAssistant(false); }} className="flex items-center gap-1 rounded-lg border border-violet-100 bg-violet-50/60 px-2 py-1 text-[10px] leading-5 text-violet-700"><MousePointer2 className="h-3 w-3" />{source.title}</button>)}</div><span className="mt-1.5 block text-[10px] leading-4 text-slate-400">{message.response.mode === "guide" ? "من دليل النظام" : "إجابة ذكية تستند إلى دليل النظام"}</span></> : <p className="whitespace-pre-wrap break-words">{message.text}</p>}
          </div>)}
          {busy && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />أراجع خطوات النظام…</div>}
        </div>
        {error && <p role="alert" className="bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <form className="shrink-0 border-t bg-white p-2" onSubmit={event => { event.preventDefault(); void ask(); }}><div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5"><Textarea ref={textarea} value={input} onChange={e => setInput(e.target.value)} maxLength={2000} placeholder="اكتب سؤالك عن النظام…" aria-label="سؤالك عن النظام" rows={1} className="max-h-28 min-h-9 resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(); } }} /><Button size="icon" type="submit" disabled={busy || !input.trim()} className="h-9 w-9 shrink-0 rounded-lg bg-cyan-600 hover:bg-cyan-700" aria-label="إرسال السؤال"><ArrowUp className="h-4 w-4" /></Button></div><button type="button" disabled={handoff || busy} onClick={() => void contactSupport()} className="mt-1.5 flex w-full items-center justify-center gap-1.5 py-1 text-[11px] text-slate-500 hover:text-cyan-700">{handoff ? <Loader2 className="h-3 w-3 animate-spin" /> : <Headset className="h-3 w-3" />}تواصل مع الدعم{summary.online && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}</button></form>
      </DialogContent>
    </Dialog>
    <ScreenRecorder open={recorderOpen} onOpenChange={recorderChange} />
    {guide && <Guide key={guide.id} article={guide} onClose={() => setGuide(null)} />}
  </>;
}
