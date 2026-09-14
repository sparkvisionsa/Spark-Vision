"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, Check, Code2, Download, History, Lightbulb, Loader2, Mic, Monitor, Pause, Play, Send, Square, Trash2, Video, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { useScreenRecorder } from "./use-screen-recorder";
import { supportError, uploadSupportFile, useSupportApi } from "./support-api";
import { developerRequestsHref, productFromPath, type SupportFile, type SupportTicket } from "./support-types";
import { useSupport } from "./support-provider";
import { cn } from "@/lib/utils";

export default function ScreenRecorder({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const recording = useScreenRecorder();
  const { user, csrfToken } = useAuthTracking();
  const api = useSupportApi(); const router = useRouter(); const { refresh, openDeveloperRequests } = useSupport();
  const [url, setUrl] = useState(""); const [kind, setKind] = useState<"bug" | "idea">("bug");
  const [title, setTitle] = useState(""); const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false); const [progress, setProgress] = useState(0);
  const [saved, setSaved] = useState<SupportTicket | null>(null);
  const page = useRef("/"); const requestId = useRef(crypto.randomUUID());
  const ticket = useRef<SupportTicket | null>(null); const attached = useRef<SupportFile | null>(null);
  const controller = useRef<AbortController>();
  const active = recording.state === "recording" || recording.state === "paused";
  const openTracking = (product: ReturnType<typeof productFromPath>) => {
    onOpenChange(false);
    if (product === "general") window.setTimeout(() => openDeveloperRequests(), 0);
    else router.push(developerRequestsHref(product));
  };
  useEffect(() => {
    if (!recording.blob) { setUrl(""); return; }
    const objectUrl = URL.createObjectURL(recording.blob); setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [recording.blob]);
  useEffect(() => { if (recording.state === "preview") onOpenChange(true); }, [recording.state, onOpenChange]);
  useEffect(() => () => controller.current?.abort(), []);
  const start = () => {
    page.current = window.location.pathname; setError(""); setSaved(null); ticket.current = null; attached.current = null; requestId.current = crypto.randomUUID();
    void recording.start();
  };
  const send = async () => {
    if (!recording.blob || uploading) return;
    setUploading(true); setError(""); setProgress(0);
    const abort = new AbortController(); controller.current = abort;
    try {
      const product = productFromPath(page.current);
      if (!ticket.current) {
        const result = await api<{ ticket: SupportTicket }>("/tickets", { method: "POST", signal: abort.signal, body: JSON.stringify({ subject: title.trim() || (kind === "idea" ? "فكرة تطوير من كن مطور" : "بلاغ مصوّر من كن مطور"), product, kind, page: page.current, clientId: requestId.current }) });
        ticket.current = result.ticket;
      }
      if (!attached.current) attached.current = await uploadSupportFile(ticket.current._id, recording.blob, `spark-${kind}-${Date.now()}.${recording.blob.type.includes("mp4") ? "mp4" : "webm"}`, csrfToken, setProgress, abort.signal);
      await api(`/tickets/${ticket.current._id}/messages`, { method: "POST", signal: abort.signal, body: JSON.stringify({ text: title.trim() || (kind === "idea" ? "فكرة تطوير — تسجيل الشاشة والصوت" : "شرح المشكلة — تسجيل الشاشة والصوت"), attachments: [attached.current.id], clientId: `recording-${requestId.current}` }) });
      setSaved(ticket.current); recording.reset(); setTitle(""); refresh();
    } catch (cause) { setError(cause instanceof DOMException && cause.name === "AbortError" ? "توقف الرفع. التسجيل ما زال جاهزاً لإعادة الإرسال." : supportError(cause)); }
    finally { setUploading(false); controller.current = undefined; }
  };
  const clock = `${Math.floor(recording.seconds / 60).toString().padStart(2, "0")}:${(recording.seconds % 60).toString().padStart(2, "0")}`;
  return <>
    {active && <div data-support-recorder-control className="fixed bottom-4 left-1/2 z-[85] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/15 bg-slate-950 px-3 py-2 text-white shadow-2xl" dir="rtl" role="region" aria-label="التحكم في تسجيل الشاشة">
      <span className={cn("h-2 w-2 rounded-full", recording.state === "paused" ? "bg-amber-400" : "animate-pulse bg-red-500")} />
      <span className="font-mono text-sm tabular-nums" aria-label="مدة التسجيل">{clock}</span>
      <span className="hidden text-xs text-slate-300 sm:inline">{recording.state === "paused" ? "متوقف مؤقتاً" : "كن مطور"}</span>
      <Mic className="h-4 w-4 text-violet-300" /><span className="h-1 w-8 overflow-hidden rounded-full bg-white/20"><span className="block h-full bg-emerald-400 transition-[width]" style={{ width: `${recording.level}%` }} /></span>
      <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 hover:text-white" onClick={recording.togglePause} aria-label={recording.state === "paused" ? "استئناف التسجيل" : "إيقاف مؤقت"}>{recording.state === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</Button>
      <Button size="sm" className="h-8 bg-red-500 hover:bg-red-600" onClick={recording.stop}><Square className="h-3 w-3 fill-current" />إنهاء</Button>
    </div>}
    {!open && !active && recording.blob && <button onClick={() => onOpenChange(true)} className="fixed bottom-4 left-1/2 z-[85] flex -translate-x-1/2 items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-xs text-white shadow-lg"><Video className="h-4 w-4" />{uploading ? `جارٍ الرفع ${progress}%` : "تسجيل جاهز للإرسال"}</button>}
    <Dialog open={open && !active} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90dvh] max-w-xl gap-3 overflow-y-auto rounded-2xl p-4 sm:p-5" onInteractOutside={e => { if (recording.state === "starting") e.preventDefault(); }}>
        <div className="flex items-center gap-2 ps-1"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><Code2 className="h-5 w-5" /></span><DialogTitle className="flex-1 text-base">كن مطور</DialogTitle><Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[11px] text-violet-700 hover:bg-violet-50" onClick={() => openTracking(productFromPath(window.location.pathname))}><History className="h-3.5 w-3.5" />متابعة طلباتي</Button></div>
        <DialogDescription className="sr-only">تسجيل الشاشة والصوت وإرسال بلاغ أو فكرة لفريق الدعم</DialogDescription>
        {saved ? <div className="flex flex-col items-center gap-3 py-4 text-center"><span className="rounded-full bg-emerald-100 p-3 text-emerald-600"><Check className="h-6 w-6" /></span><p className="text-sm font-semibold">وصل تسجيلك · {saved.number}</p><Button onClick={() => openTracking(saved.product)}>متابعة الطلب</Button><Button size="sm" variant="ghost" onClick={() => { setSaved(null); }}>تسجيل جديد</Button></div> : <>
          {url ? <video src={url} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-slate-950" aria-label="معاينة تسجيل الشاشة والصوت" /> : <div className="flex aspect-[2.4] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-violet-200 bg-violet-50/60"><div className="flex items-center gap-3 text-violet-500"><Monitor className="h-10 w-10" /><span className="h-1 w-5 rounded-full bg-violet-200" /><Mic className="h-7 w-7" /></div><span className="text-sm font-medium text-slate-700">شاشتك وصوتك، والفكرة تصل</span><span className="text-xs text-slate-500">اختر تبويب النظام · حتى 5 دقائق</span></div>}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span className="rounded-full bg-slate-100 px-2 py-1">{user?.companyName || "حساب شخصي"}</span><span dir="ltr">{user?.phone || user?.username}</span>{recording.blob && <span className="ms-auto">{(recording.blob.size / 1024 / 1024).toFixed(1)} MB · {clock}</span>}</div>
          {(error || recording.error) && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs leading-6 text-rose-700">{error || recording.error}</p>}
          {recording.blob ? <>
            <div className="flex gap-2">{([{ id: "bug", label: "بلاغ", Icon: Bug }, { id: "idea", label: "فكرة تطوير", Icon: Lightbulb }] as const).map(({ id, label, Icon }) => <button key={id} disabled={uploading || !!ticket.current} onClick={() => setKind(id)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold", kind === id ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500")}><Icon className="h-4 w-4" />{label}</button>)}</div>
            <Input aria-label="عنوان التسجيل، اختياري" placeholder="عنوان مختصر (اختياري)" maxLength={160} value={title} disabled={uploading || !!ticket.current} onChange={e => setTitle(e.target.value)} className="h-9 text-sm" />
            {uploading && <div className="space-y-1" role="status"><div className="flex justify-between text-xs text-violet-700"><span>{progress >= 99 ? "جارٍ حفظ التسجيل…" : "جارٍ رفع التسجيل…"}</span><span>{progress}%</span></div><div role="progressbar" aria-label="رفع التسجيل" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600 transition-[width]" style={{ width: `${progress}%` }} /></div></div>}
            <div className="flex items-center gap-2"><Button className="h-9 flex-1 bg-violet-600 hover:bg-violet-700" onClick={() => void send()} disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{uploading ? "جارٍ الإرسال" : error ? "إعادة الإرسال" : "إرسال التسجيل"}</Button><Button asChild variant="outline" size="icon" className="h-9 w-9"><a href={url} download={`spark-recording.${recording.blob.type.includes("mp4") ? "mp4" : "webm"}`} aria-label="حفظ نسخة على الجهاز"><Download className="h-4 w-4" /></a></Button>{uploading ? <Button size="icon" variant="outline" className="h-9 w-9" aria-label="إلغاء الرفع" onClick={() => controller.current?.abort()}><X className="h-4 w-4" /></Button> : <Button size="icon" variant="outline" className="h-9 w-9 text-rose-600" aria-label="حذف التسجيل" onClick={() => { recording.reset(); setError(""); }}><Trash2 className="h-4 w-4" /></Button>}</div>
          </> : <Button className="h-10 bg-violet-600 hover:bg-violet-700" disabled={recording.state === "starting"} onClick={start}>{recording.state === "starting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}{recording.state === "starting" ? "بانتظار مشاركة الشاشة والميكروفون" : "بدء التسجيل"}</Button>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
