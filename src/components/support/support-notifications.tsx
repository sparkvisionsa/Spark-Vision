"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSupportApi, supportError } from "./support-api";
import { useSupport } from "./support-provider";
import { useRealtime } from "./realtime-provider";
import { developerRequestsHref, productFromPath, supportHref, type SupportNotification } from "./support-types";
import { useAuthTracking } from "@/components/auth-tracking-provider";

const date = (value: string) => new Intl.DateTimeFormat("ar-SA", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(value));

/** A compact inbox: each alert remains private to its recipient and opens its own conversation. */
export default function SupportNotifications({ dark = false }: { dark?: boolean }) {
  const { user } = useAuthTracking(); const api = useSupportApi(); const router = useRouter(); const { summary, refresh, openSupport, openDeveloperRequests } = useSupport(); const { socket } = useRealtime();
  const [open, setOpen] = useState(false); const [items, setItems] = useState<SupportNotification[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { const result = await api<{ notifications: SupportNotification[] }>("/notifications"); setItems(result.notifications); }
    catch (cause) { setError(supportError(cause)); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open) void load(); }, [open]); // The API callback is stable per session.
  useEffect(() => {
    const changed = () => { if (open) void load(); refresh(); };
    socket?.on("support:notifications", changed);
    return () => { socket?.off("support:notifications", changed); };
  }, [socket, open, refresh]);
  const visit = async (item: SupportNotification) => {
    if (!item.readAt) {
      setItems(current => current.map(row => row._id === item._id ? { ...row, readAt: new Date().toISOString() } : row));
      void api("/notifications/read", { method: "POST", body: JSON.stringify({ ids: [item._id] }) }).then(refresh).catch(() => {});
    }
    setOpen(false);
    const product = productFromPath(window.location.pathname);
    if (product === "general") {
      if (item.channel === "developer") openDeveloperRequests(); else openSupport();
      return;
    }
    router.push(item.channel === "developer" ? developerRequestsHref(product, item.ticketId) : supportHref(product, item.ticketId));
  };
  const markAll = async () => {
    setItems(current => current.map(item => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    try { await api("/notifications/read", { method: "POST", body: JSON.stringify({}) }); refresh(); }
    catch (cause) { setError(supportError(cause)); }
  };
  if (!user) return null;
  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild>
      <button type="button" aria-label="الإشعارات" className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl outline-none transition ${dark ? "text-slate-200 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
        <Bell className="h-[18px] w-[18px]" />
        {summary.notificationUnread > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">{summary.notificationUnread > 99 ? "99+" : summary.notificationUnread}</span>}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className="w-[min(360px,calc(100vw-1rem))] rounded-xl p-1.5 shadow-xl">
      <div dir="rtl">
        <div className="flex items-center gap-2 px-2 py-1.5"><Bell className="h-4 w-4 text-cyan-600" /><span className="flex-1 text-xs font-bold">الإشعارات</span>{items.some(item => !item.readAt) && <button onClick={() => void markAll()} className="flex items-center gap-1 text-[10px] text-cyan-700 hover:text-cyan-900"><CheckCheck className="h-3.5 w-3.5" />قراءة الكل</button>}</div>
        <DropdownMenuSeparator />
        <div className="max-h-[min(420px,65dvh)] overflow-y-auto">
          {loading ? <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />جارٍ تحميل الإشعارات</div> : error ? <p className="p-3 text-xs text-rose-600">{error}</p> : !items.length ? <p className="p-5 text-center text-xs text-slate-400">لا توجد إشعارات جديدة</p> : items.map(item => <DropdownMenuItem key={item._id} onSelect={event => { event.preventDefault(); void visit(item); }} className={`mb-1 flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-right ${item.readAt ? "opacity-70" : "bg-cyan-50/70"}`}>
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.readAt ? "bg-slate-300" : item.channel === "developer" ? "bg-violet-500" : "bg-cyan-500"}`} />
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{item.title}</span><span className="mt-0.5 block line-clamp-2 text-[11px] leading-5 text-slate-500">{item.body}</span><time className="mt-0.5 block text-[9px] text-slate-400">{date(item.createdAt)}</time></span>
          </DropdownMenuItem>)}
        </div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>;
}
