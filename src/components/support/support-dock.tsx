"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bot, ChevronLeft, FileCog, MousePointer2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type SupportArticle } from "./support-types";
import { useHelperRecording } from "@/components/helper-recording-provider";
import ScreenRecorder from "./screen-recorder";
import { ValueTechAssistantChat } from "./value-tech-assistant-chat";

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
  const pathname = usePathname() || "/";
  const [guide, setGuide] = useState<SupportArticle | null>(null);
  const dock = useRef<HTMLDivElement>(null);
  const placement = useDockPlacement(dock);
  const { helperToolsOpen, openHelperTools } = useHelperRecording();
  const onHelperTools = pathname === "/helper-tools" || pathname.startsWith("/helper-tools/") || helperToolsOpen;
  const hideDock = recorderOpen;
  const recorderChange = useCallback((value: boolean) => onRecorderOpen(value), [onRecorderOpen]);
  return <>
    <div ref={dock} style={{ bottom: placement.edge === "bottom" ? placement.offset : undefined, top: placement.edge === "top" ? placement.offset : undefined, left: placement.side === "left" ? 16 : "auto", right: placement.side === "right" ? 16 : "auto" }} className={cn("fixed z-[65] flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2 transition-all duration-200 print:hidden", hideDock && "pointer-events-none -translate-y-2 opacity-0")} dir="rtl" data-support-dock aria-hidden={hideDock}>
      <button
        type="button"
        onClick={() => onAssistantOpen(!assistantOpen)}
        aria-label="فتح مساعد فاليو تك"
        aria-expanded={assistantOpen}
        className={cn(
          "group relative flex h-[3.25rem] w-[4.55rem] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[1.2rem] border text-[#1c1917] transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/70",
          assistantOpen
            ? "border-yellow-500 bg-[linear-gradient(180deg,#facc15_0%,#eab308_52%,#ca8a04_100%)] shadow-[0_0_0_1px_rgba(255,255,255,0.28)_inset,0_8px_18px_rgba(202,138,4,0.45)]"
            : "border-yellow-400/90 bg-[linear-gradient(180deg,#fde047_0%,#facc15_50%,#eab308_100%)] shadow-[0_0_0_1px_rgba(255,255,255,0.35)_inset,0_6px_14px_rgba(234,179,8,0.38)] hover:bg-[linear-gradient(180deg,#fef08a_0%,#fde047_48%,#facc15_100%)] hover:shadow-[0_8px_18px_rgba(250,204,21,0.48)]",
        )}
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.42),transparent_58%)]" />
        <span className="relative">
          <Bot className="h-4 w-4" />
          <span className={cn("absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2", assistantOpen ? "ring-yellow-700" : "ring-yellow-300")} />
        </span>
        <span className="relative px-1 text-center text-[11px] font-extrabold leading-tight tracking-tight">اسأل<br />فاليو تك</span>
      </button>
      {!onHelperTools && (
        <button
          type="button"
          onClick={openHelperTools}
          title="الأدوات المساعدة: تصوير الشاشة وتحويل الملفات"
          aria-label="فتح الأدوات المساعدة"
          className="group relative flex h-[3.25rem] w-[4.55rem] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[1.2rem] border border-yellow-400/90 bg-[linear-gradient(180deg,#fde047_0%,#facc15_50%,#eab308_100%)] text-[#1c1917] shadow-[0_0_0_1px_rgba(255,255,255,0.35)_inset,0_6px_14px_rgba(234,179,8,0.38)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#fef08a_0%,#fde047_48%,#facc15_100%)] hover:shadow-[0_8px_18px_rgba(250,204,21,0.48)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/70"
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.42),transparent_58%)]" />
          <FileCog className="relative h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-12" />
          <span className="relative px-1 text-center text-[11px] font-extrabold leading-tight tracking-tight">أدوات<br />مساعدة</span>
        </button>
      )}
    </div>
    <ValueTechAssistantChat open={assistantOpen} onOpenChange={onAssistantOpen} placement={placement} onStartGuide={setGuide} />
    <ScreenRecorder open={recorderOpen} onOpenChange={recorderChange} />
    {guide && <Guide key={guide.id} article={guide} onClose={() => setGuide(null)} />}
  </>;
}
