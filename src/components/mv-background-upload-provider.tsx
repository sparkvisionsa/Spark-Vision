"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { useAuthTracking } from "./auth-tracking-provider";
import { useMvI18n } from "./workspace/workspace-sections/machine-valuation/mv-i18n";
import { useToast } from "@/hooks/use-toast";
import { dismissUpload, getUploads, retryUpload, setUploadAccount, subscribeUploads, uploadOwner, registerAttachmentProcessor, type UploadJob } from "@/lib/mv-background-uploads";

const empty: UploadJob[] = [];
export function MvBackgroundUploadProvider() {
  const { user } = useAuthTracking();
  const { isArabic, dir } = useMvI18n();
  const { toast } = useToast();
  const dismiss = (id: string) => { void dismissUpload(id).catch(error => toast({ variant: "destructive", description: String(error.message ?? error) })); };
  const jobs = useSyncExternalStore(subscribeUploads, getUploads, () => empty);
  const account = user ? uploadOwner(user) : "";
  useEffect(() => {
    registerAttachmentProcessor(async context => {
      const { processAttachment } = await import("@/lib/mv-attachment-upload-worker");
      await processAttachment(context);
    });
    setUploadAccount(account);
    return () => setUploadAccount("");
  }, [account]);
  if (!jobs.length) return null;
  return (
    <aside dir={dir} aria-label={isArabic ? "عمليات رفع الصور" : "Image uploads"}
      className="fixed bottom-5 right-5 z-[90] max-h-[45vh] w-[min(24rem,calc(100vw-2rem))] space-y-2 overflow-y-auto">
      {jobs.map(job => {
        const done = job.items.filter(item => item.done).length;
        const pages = job.items.flatMap(item => item.pages ?? []);
        const savedPages = pages.filter(page => page.saved).length;
        const progress = job.attachment ? job.items.reduce((sum, item) => sum + (item.done ? 1 :
          (item.pages?.filter(page => page.saved).length ?? 0) / Math.max(1, item.pages?.[0]?.total ?? 1)), 0) : done;
        const percent = job.state === "done" ? 100 : Math.min(99, Math.round(progress / Math.max(1, job.items.length) * 100));
        const failed = job.state === "error";
        const complete = job.state === "done";
        const waiting = job.state === "waiting";
        const staging = job.state === "staging";
        const phase = staging ? (isArabic ? "جارٍ تجهيز الملفات للاستئناف" : "Preparing files for resume")
          : complete ? (isArabic ? "اكتمل حفظ الصور" : "Images saved")
          : failed ? (isArabic ? "تعذّر إكمال الرفع" : "Upload needs attention")
          : waiting ? (isArabic ? "بانتظار الاتصال — سيُستأنف تلقائيًا" : "Waiting to reconnect — resumes automatically")
          : job.phase === "converting" ? (isArabic ? "جارٍ تحويل المرفقات إلى صور" : "Converting attachments to images")
          : job.phase === "verifying" ? (isArabic ? "جارٍ التأكد من حفظ الصور في التقرير" : "Verifying report attachments")
          : (isArabic ? "جارٍ رفع الصور وحفظها" : "Uploading and saving images");
        return <div key={job.id} className="overflow-hidden rounded-2xl border bg-white p-4 shadow-xl" role="status">
          <div className="flex items-center gap-2">
            {complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Loader2 className={`h-5 w-5 text-sky-700 ${failed || waiting ? "" : "animate-spin"}`} />}
            <p className="flex-1 text-sm font-bold">{phase}</p>
            {complete && <button aria-label={isArabic ? "إغلاق" : "Dismiss"} onClick={() => dismiss(job.id)}><X className="h-4 w-4" /></button>}
          </div>
          <p className="mt-2 truncate text-xs font-semibold" title={job.label}>{job.label}</p>
          <p className="my-2 text-xs tabular-nums">{done} / {job.items.length} · {percent}%</p>
          {job.attachment && <p className="mb-2 text-xs text-slate-600">{isArabic ? `صور محفوظة في التقرير: ${savedPages}` : `Images saved to report: ${savedPages}`}</p>}
          <div className="h-1.5 overflow-hidden rounded bg-slate-100"><div className="h-full bg-sky-600 transition-all" style={{ width: `${percent}%` }} /></div>
          {!complete && <p className="mt-2 text-xs text-slate-500">{staging
            ? (isArabic ? "انتظر اكتمال التجهيز قبل إعادة تحميل الصفحة." : "Wait for preparation before reloading the page.")
            : (isArabic ? "يمكنك التنقل. يُستأنف المتبقي بعد إعادة تحميل الصفحة." : "You can navigate away. Remaining files resume after reloading.")}</p>}
          {failed && <p className="mt-2 break-words text-xs text-rose-700">{job.error}</p>}
          {(failed || waiting) && <button className="mt-2 flex items-center gap-1 text-xs font-bold text-sky-800" onClick={() => void retryUpload(job.id)}><RefreshCw className="h-3 w-3" />{isArabic ? "إعادة المحاولة" : "Retry"}</button>}
          {(failed || waiting) && <button className="mt-2 text-xs text-slate-500" onClick={() => dismiss(job.id)}>{isArabic ? "إلغاء الملفات المتبقية" : "Cancel remaining files"}</button>}
        </div>;
      })}
    </aside>
  );
}
