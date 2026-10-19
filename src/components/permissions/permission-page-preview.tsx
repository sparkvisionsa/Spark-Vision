"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Eye, Loader2, Monitor, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { permissionPreviewScreens, permissionPreviewWorkspaceUrl } from "@/lib/permission-page-previews";
import { VALUE_TECH_PRODUCT_LABELS_AR, type ValueTechProductId } from "@/lib/value-tech-products";
import { cn } from "@/lib/utils";

type PreviewProject = { projectId: string; name: string; created: boolean; version: number };
let machinePreviewProjectRequest: Promise<PreviewProject> | null = null;

async function ensureMachinePreviewProject(): Promise<PreviewProject> {
  if (!machinePreviewProjectRequest) {
    machinePreviewProjectRequest = fetch("/api/mv/permission-preview-project", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).then(async (response) => {
      const body = (await response.json().catch(() => ({}))) as Partial<PreviewProject> & { message?: string | string[] };
      if (!response.ok || !body.projectId) {
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message;
        throw new Error(message || "تعذر تجهيز مشروع المعاينة الحقيقي.");
      }
      return body as PreviewProject;
    }).catch((error) => {
      machinePreviewProjectRequest = null;
      throw error;
    });
  }
  return machinePreviewProjectRequest;
}

export function PermissionPagePreview({ productId, pageKey }: { productId: ValueTechProductId; pageKey: string; actions: Array<{ key: string; label: string }> }) {
  const destinations = permissionPreviewScreens(productId, pageKey);
  const [open, setOpen] = useState(false);
  const [destinationIndex, setDestinationIndex] = useState(0);
  const [previewProject, setPreviewProject] = useState<PreviewProject | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [frameLoading, setFrameLoading] = useState(false);
  const [frameVersion, setFrameVersion] = useState(0);
  const [error, setError] = useState("");
  const activeDestination = destinations[destinationIndex] ?? destinations[0];
  const workspaceUrl = useMemo(
    () => activeDestination ? permissionPreviewWorkspaceUrl(activeDestination.path, previewProject?.projectId) : null,
    [activeDestination, previewProject?.projectId],
  );

  useEffect(() => {
    if (!open || productId !== "machine-valuation") return;
    let active = true;
    setLoadingProject(true);
    setError("");
    void ensureMachinePreviewProject()
      .then((project) => { if (active) setPreviewProject(project); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "تعذر تجهيز مشروع المعاينة الحقيقي."); })
      .finally(() => { if (active) setLoadingProject(false); });
    return () => { active = false; };
  }, [open, productId]);

  useEffect(() => {
    if (workspaceUrl) setFrameLoading(true);
  }, [workspaceUrl, frameVersion]);

  if (!activeDestination) return null;

  const retry = () => {
    machinePreviewProjectRequest = null;
    setError("");
    setLoadingProject(true);
    void ensureMachinePreviewProject()
      .then(setPreviewProject)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "تعذر تجهيز مشروع المعاينة الحقيقي."))
      .finally(() => setLoadingProject(false));
  };

  return <Dialog open={open} onOpenChange={(next) => {
    setOpen(next);
    if (next) {
      setDestinationIndex(0);
      setError("");
      setFrameVersion((value) => value + 1);
    }
  }}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" size="sm" aria-label={`معاينة صفحة ${destinations[0].label}`} className="mt-3 gap-1.5 rounded-lg border-sky-200 text-xs text-[#0C447C] hover:bg-sky-50">
        <Eye className="h-3.5 w-3.5" />معاينة الصفحة
      </Button>
    </DialogTrigger>
    <DialogContent dir="rtl" hideOverlay style={{ zIndex: 980 }} className="flex h-[94dvh] max-h-[1100px] w-[calc(100%-0.75rem)] max-w-[1500px] flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 ring-1 ring-slate-900/10">
      <header className="shrink-0 border-b bg-slate-50 px-4 py-3 pl-12 sm:px-6 sm:pl-12">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <DialogTitle className="flex items-center gap-2 text-right text-base font-black">
              <Monitor className="h-5 w-5 text-[#0C447C]" />معاينة الصفحة الحقيقية: {activeDestination.label}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-right text-xs leading-5">
              هذه صفحة فعلية من {VALUE_TECH_PRODUCT_LABELS_AR[productId]} وليست نموذجًا مرسومًا. {productId === "machine-valuation" ? "تُعرض باستخدام مشروع معاينة حقيقي محفوظ داخل شركتك ببيانات تجريبية." : "تُعرض مباشرة من النظام ببيانات الشركة الحالية."}
            </DialogDescription>
          </div>
          {workspaceUrl ? <Button asChild type="button" variant="outline" size="sm" className="ml-8 gap-1.5 rounded-lg bg-white text-xs">
            <a href={workspaceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />فتح في تبويب مستقل</a>
          </Button> : null}
        </div>
        {destinations.length > 1 ? <div className="mt-3 flex flex-wrap gap-2" aria-label="صفحات الصلاحية الحقيقية">
          {destinations.map((item, index) => <button type="button" key={item.id} aria-pressed={index === destinationIndex} onClick={() => { setDestinationIndex(index); setError(""); }} className={cn("rounded-lg border px-3 py-2 text-xs font-semibold transition", index === destinationIndex ? "border-[#0C447C] bg-[#0C447C] text-white" : "border-sky-200 bg-white text-sky-800 hover:bg-sky-50")}>{item.label}</button>)}
        </div> : null}
      </header>

      <div className="relative min-h-0 flex-1 bg-slate-100" data-permission-real-preview>
        {loadingProject ? <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 text-sm font-semibold text-slate-600"><Loader2 className="h-8 w-8 animate-spin text-sky-700" /><span>جارٍ تجهيز مشروع المعاينة الحقيقي وبياناته التجريبية…</span></div> : error ? <div role="alert" className="mx-auto mt-12 max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm"><p className="text-sm font-bold text-red-700">{error}</p><Button type="button" className="mt-4" onClick={retry}>إعادة المحاولة</Button></div> : workspaceUrl ? <>
          {frameLoading ? <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/90"><div className="flex items-center gap-3 rounded-xl border bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm"><Loader2 className="h-5 w-5 animate-spin text-sky-700" />جارٍ تحميل الصفحة الحقيقية…</div></div> : null}
          <iframe key={`${workspaceUrl}:${frameVersion}`} src={workspaceUrl} title={`الصفحة الحقيقية: ${activeDestination.label}`} className="h-full min-h-[520px] w-full border-0 bg-white" onLoad={() => setFrameLoading(false)} />
        </> : null}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-white px-4 py-3 sm:px-6">
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" />أي تجربة داخل المعاينة تخص مشروع المعاينة التجريبي ولا تغيّر اختيار الصلاحيات الجاري تحريره.</p>
        <div className="flex items-center gap-2">
          {workspaceUrl ? <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setFrameVersion((value) => value + 1)}><RefreshCw className="h-3.5 w-3.5" />تحديث الصفحة</Button> : null}
          <DialogClose asChild><Button type="button" className="rounded-xl bg-[#0C447C] text-white hover:bg-[#093763]">العودة للصلاحيات</Button></DialogClose>
        </div>
      </footer>
    </DialogContent>
  </Dialog>;
}
