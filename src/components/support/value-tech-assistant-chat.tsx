"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUp,
  Check,
  ChevronLeft,
  Copy,
  FileCog,
  Headset,
  Loader2,
  MessageCircle,
  MousePointer2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSupportApi, supportError } from "./support-api";
import { ticketSubjectOrFallback } from "./support-validation";
import { useSupport } from "./support-provider";
import { productFromPath, supportHref, SUPPORT_PRODUCTS, type AssistantAnswer, type SupportArticle, type SupportTicket } from "./support-types";
import { useHelperRecording } from "@/components/helper-recording-provider";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string; response?: AssistantAnswer };
type DockPlacement = { side: "left" | "right"; edge: "top" | "bottom" };

const POPULAR = [
  "كيف أنشئ مشروع تقييم آلات؟",
  "كيف أنزّل تقرير تقييم الآلات والمعدات؟",
  "كيف أنشئ معاملة تقييم عقاري؟",
  "كيف أنزّل التقرير النهائي للعقارات؟",
] as const;

const TOPICS = [
  { id: "estate", label: "العقارات", questions: ["كيف أنشئ معاملة تقييم عقاري؟", "كيف أنزّل التقرير النهائي للعقارات؟", "كيف أضيف صور ومرفقات المعاملة؟"] },
  { id: "machines", label: "الآلات", questions: ["كيف أنشئ مشروع تقييم آلات؟", "كيف أنزّل تقرير تقييم الآلات والمعدات؟", "كيف أرفع صور الأصول؟"] },
  { id: "reports", label: "التقارير", questions: ["كيف أنزّل تقرير تقييم الآلات والمعدات؟", "كيف أنزّل التقرير النهائي للعقارات؟", "كيف أضيف مستخدمي التقرير والتوقيعات؟"] },
  { id: "tools", label: "الأدوات", questions: ["كيف أحوّل الصور إلى PDF؟", "كيف أسجّل الشاشة من الأدوات المساعدة؟", "كيف أفقّط مبلغاً بالريال؟"] },
  { id: "help", label: "الدعم", questions: ["كيف أفتح تذكرة دعم؟", "كيف أستخدم كن مطور؟"] },
] as const;

function contextualQuestions(path: string) {
  if (path.includes("real-estate")) return ["كيف أنشئ معاملة تقييم عقاري؟", "كيف أنزّل التقرير النهائي للعقارات؟", "كيف أضيف صور ومرفقات المعاملة؟"];
  if (path.includes("machine-valuation")) return ["كيف أنشئ مشروع تقييم آلات؟", "كيف أنزّل تقرير تقييم الآلات والمعدات؟", "كيف أضبط الترقيم المتسلسل؟"];
  if (path.includes("helper-tools")) return ["كيف أحوّل الصور إلى PDF؟", "كيف أسجّل الشاشة من الأدوات المساعدة؟", "كيف أفقّط مبلغاً بالريال؟"];
  return [...POPULAR];
}

export function ValueTechAssistantChat({
  open,
  onOpenChange,
  placement,
  onStartGuide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement: DockPlacement;
  onStartGuide: (article: SupportArticle) => void;
}) {
  const api = useSupportApi();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { summary, refresh, openSupport } = useSupport();
  const { openHelperTools } = useHelperRecording();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["id"] | "popular">("popular");
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const controller = useRef<AbortController>();
  const transferId = useRef(crypto.randomUUID());
  const product = productFromPath(pathname);
  const productLabel = SUPPORT_PRODUCTS[product];
  const suggestions = useMemo(() => (topic === "popular" ? contextualQuestions(pathname) : TOPICS.find((row) => row.id === topic)?.questions ?? POPULAR), [pathname, topic]);

  useLayoutEffect(() => {
    const root = scroller.current;
    const last = messages[messages.length - 1];
    if (!root) return;
    if (!last) {
      root.scrollTop = 0;
      return;
    }
    if (last.role === "user") {
      root.scrollTop = root.scrollHeight;
      return;
    }
    const anchor = messages.at(-2)?.role === "user" ? messages[messages.length - 2]! : last;
    const node = root.querySelector<HTMLElement>(`[data-chat-id="${anchor.id}"]`);
    if (!node) {
      root.scrollTop = root.scrollHeight;
      return;
    }
    const top = node.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 8;
    root.scrollTop = Math.max(0, top);
  }, [messages, open]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (open) window.setTimeout(() => textarea.current?.focus(), 80);
  }, [open]);
  useEffect(() => {
    if (open) return;
    controller.current?.abort();
    setBusy(false);
    setHandoff(false);
    setMessages([]);
    setInput("");
    setError("");
    setCopied("");
    setTopic("popular");
    transferId.current = crypto.randomUUID();
  }, [open]);

  const ask = async (question = input) => {
    if (!question.trim() || busy) return;
    const text = question.trim();
    setInput("");
    setBusy(true);
    setError("");
    const history = messages.slice(-10).map((message) => ({ role: message.role, text: message.text.slice(0, 4000) }));
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await api<AssistantAnswer>("/assistant", {
        method: "POST",
        signal: abort.signal,
        body: JSON.stringify({ question: text, history, product, page: window.location.pathname }),
      });
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: [response.answer, ...response.steps].join("\n"), response }]);
      transferId.current = crypto.randomUUID();
    } catch (cause) {
      if (!abort.signal.aborted) {
        setError(supportError(cause));
        setInput(text);
      }
    } finally {
      setBusy(false);
      textarea.current?.focus();
    }
  };

  const contactSupport = async () => {
    if (handoff) return;
    setHandoff(true);
    setError("");
    try {
      const text = messages.length
        ? messages.slice(-10).map((message) => `${message.role === "user" ? "المستخدم" : "المساعد"}: ${message.text}`).join("\n\n").slice(-7800)
        : "أرغب بالتواصل مع الدعم الفني.";
      const subject = ticketSubjectOrFallback(messages.find((message) => message.role === "user")?.text.slice(0, 150) ?? "", "محادثة مباشرة مع الدعم الفني");
      const result = await api<{ ticket: SupportTicket }>("/tickets", { method: "POST", body: JSON.stringify({ subject, text, product, page: window.location.pathname, clientId: transferId.current }) });
      refresh();
      onOpenChange(false);
      if (product === "general") openSupport();
      else router.push(supportHref(product, result.ticket._id));
    } catch (cause) {
      setError(supportError(cause));
    } finally {
      setHandoff(false);
    }
  };

  const openSource = (article: SupportArticle) => {
    if (article.product === "helper-tools") {
      onOpenChange(false);
      openHelperTools();
      return;
    }
    if (article.id === "support" || article.id === "be-developer") {
      onOpenChange(false);
      openSupport();
      return;
    }
    router.push(article.href);
  };

  const copyAnswer = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied((current) => (current === id ? "" : current)), 1800);
    } catch { /* ignore */ }
  };

  const reset = () => {
    controller.current?.abort();
    setBusy(false);
    setHandoff(false);
    setMessages([]);
    setInput("");
    setError("");
    setCopied("");
    setTopic("popular");
    transferId.current = crypto.randomUUID();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogContent
        hideCloseButton
        hideOverlay
        dir="rtl"
        data-support-chat
        className={cn(
          "fixed flex w-[min(460px,calc(100vw-1.25rem))] max-w-none flex-col gap-0 overflow-hidden rounded-[28px] border-cyan-100/80 bg-white p-0 shadow-[0_28px_80px_rgba(8,47,73,0.28)]",
          "h-[min(620px,calc(100dvh-12.5rem))] max-h-[calc(100dvh-12.5rem)]",
          "!translate-x-0 !translate-y-0",
          "data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100",
          placement.side === "left" ? "left-4 right-auto" : "right-4 left-auto",
          placement.edge === "bottom" ? "bottom-[8.5rem] !top-auto" : "top-[8.5rem] !bottom-auto",
        )}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
      >
        <div className="shrink-0 bg-[linear-gradient(135deg,#042f3a_0%,#0f172a_52%,#083344_100%)] px-4 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-200 ring-1 ring-cyan-200/25">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[15px] font-semibold tracking-tight">مساعد فاليو تك</DialogTitle>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-cyan-100/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {product === "general" ? "إجابات من دليل النظام" : productLabel}
              </p>
            </div>
            <Button size="icon" variant="ghost" disabled={busy || handoff} className="h-8 w-8 rounded-full text-slate-300 hover:bg-white/10 hover:text-white" aria-label="محادثة جديدة" title="محادثة جديدة" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <DialogClose className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-300 outline-none transition hover:bg-white/10 hover:text-white" aria-label="إغلاق" title="إغلاق">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
        </div>
        <DialogDescription className="sr-only">مساعد عربي لشرح خطوات استخدام أنظمة فاليو تك والتواصل مع الدعم الفني</DialogDescription>
        <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[radial-gradient(120%_80%_at_100%_0%,#ecfeff_0%,#f8fafc_38%,#ffffff_100%)] p-3" role="log" aria-label="المحادثة مع المساعد" aria-live="polite">
          {!messages.length && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-cyan-100 bg-white/95 p-3.5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">أهلاً بك، كيف أساعدك؟</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">اختر موضوعاً أو سؤالاً جاهزاً، أو اكتب اسم الزر أو الصفحة. إغلاق المساعد يبدأ محادثة جديدة في المرة القادمة.</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => setTopic("popular")} className={cn("h-8 rounded-full px-3 text-[11px] font-semibold transition", topic === "popular" ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>الأكثر طلباً</button>
                {TOPICS.map((row) => (
                  <button key={row.id} type="button" onClick={() => setTopic(row.id)} className={cn("h-8 rounded-full px-3 text-[11px] font-semibold transition", topic === row.id ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>{row.label}</button>
                ))}
              </div>
              <div className="grid gap-2">
                <p className="px-1 text-[11px] font-bold text-slate-500">{topic === "popular" ? "الأسئلة الشائعة" : "أسئلة هذا الموضوع"}</p>
                {suggestions.map((question) => (
                  <button key={question} type="button" onClick={() => void ask(question)} className="group flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-start text-xs text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50 hover:text-slate-800">
                    <MessageCircle className="h-3.5 w-3.5 shrink-0 text-cyan-600" />
                    <span className="flex-1">{question}</span>
                    <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-cyan-600" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div key={message.id} data-chat-id={message.id} className={cn("max-w-[96%] rounded-2xl p-3 text-sm leading-7", message.role === "user" ? "ms-auto rounded-bl-md bg-slate-900 text-white" : "me-auto rounded-br-md border border-slate-200 bg-white text-slate-700 shadow-sm")}>
              {message.response ? (
                <>
                  <p className="whitespace-pre-wrap">{message.response.answer}</p>
                  {message.response.steps.length > 0 && (
                    <ol className="mt-2 space-y-2">
                      {message.response.steps.map((step, index) => (
                        <li key={index} className="flex items-start gap-2 rounded-xl bg-slate-50 px-2 py-1.5">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-bold text-white">{index + 1}</span>
                          <span className="text-xs leading-6">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {message.response.sources.slice(0, 2).map((source) => (
                      <button key={source.id} type="button" onClick={() => { onStartGuide(source); onOpenChange(false); }} className="inline-flex items-center gap-1 rounded-lg border border-violet-100 bg-violet-50/80 px-2 py-1 text-[10px] font-semibold leading-5 text-violet-700">
                        <MousePointer2 className="h-3 w-3" />{source.title}
                      </button>
                    ))}
                    {message.response.sources[0] ? (
                      <button type="button" onClick={() => openSource(message.response!.sources[0]!)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-semibold leading-5 text-emerald-800">
                        {message.response.sources[0].product === "helper-tools" ? <FileCog className="h-3 w-3" /> : null}
                        فتح المكان
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void copyAnswer(message.id, [message.response!.answer, ...message.response!.steps].join("\n"))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold leading-5 text-slate-600">
                      {copied === message.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copied === message.id ? "تم النسخ" : "نسخ"}
                    </button>
                  </div>
                  {message.response.handoff ? (
                    <button type="button" disabled={handoff || busy} onClick={() => void contactSupport()} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800">
                      {handoff ? <Loader2 className="h-3 w-3 animate-spin" /> : <Headset className="h-3 w-3" />}
                      حوّل المحادثة للدعم الفني
                    </button>
                  ) : null}
                  {message.response.related?.length ? (
                    <div className="mt-2">
                      <p className="mb-1 text-[10px] font-bold text-slate-400">يمكنك أيضاً</p>
                      <div className="flex flex-wrap gap-1.5">
                        {message.response.related.map((item) => (
                          <button key={item} type="button" onClick={() => void ask(item)} className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-800 ring-1 ring-cyan-100">{item}</button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {message.response.sources.length > 0 || message.response.steps.length > 0 ? (
                    <span className="mt-1.5 block text-[10px] leading-4 text-slate-400">{message.response.mode === "guide" ? "من دليل النظام" : "إجابة ذكية تستند إلى دليل النظام"}</span>
                  ) : null}
                </>
              ) : (
                <p className="whitespace-pre-wrap break-words">{message.text}</p>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              أحلل سؤالك وأتأكد من خطوات النظام…
            </div>
          )}
        </div>
        {error && <p role="alert" className="bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <form className="shrink-0 border-t border-slate-100 bg-white p-2.5" onSubmit={(event) => { event.preventDefault(); void ask(); }}>
          {messages.length > 0 && (
            <div className="mb-2 flex gap-1 overflow-x-auto pb-0.5">
              {POPULAR.slice(0, 3).map((question) => (
                <button key={question} type="button" onClick={() => void ask(question)} className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">{question.replace("كيف ", "")}</button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-cyan-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-cyan-100">
            <Textarea
              ref={textarea}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={2000}
              placeholder="اسأل أي شيء: تحية، خطوة، أو مشكلة داخل النظام…"
              aria-label="سؤالك عن النظام"
              rows={1}
              className="max-h-28 min-h-10 resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void ask();
                }
              }}
            />
            <Button size="icon" type="submit" disabled={busy || !input.trim()} className="h-10 w-10 shrink-0 rounded-xl bg-cyan-600 hover:bg-cyan-700" aria-label="إرسال السؤال">
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
          <button type="button" disabled={handoff || busy} onClick={() => void contactSupport()} className="mt-1.5 flex w-full items-center justify-center gap-1.5 py-1 text-[11px] text-slate-500 hover:text-cyan-700">
            {handoff ? <Loader2 className="h-3 w-3 animate-spin" /> : <Headset className="h-3 w-3" />}
            تواصل مع الدعم
            {summary.online && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
