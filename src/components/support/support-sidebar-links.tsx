"use client";
import Link from "next/link";
import { Headset, History } from "lucide-react";
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useSupport } from "./support-provider";
import { developerRequestsHref, supportHref, type SupportProduct } from "./support-types";
import { cn } from "@/lib/utils";
export function SupportSidebarLinks({ product = "general", dark = false }: { product?: SupportProduct; dark?: boolean }) {
  const { summary } = useSupport();
  const style = cn("h-9 rounded-lg text-xs", dark ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-700 hover:bg-slate-100");
  return <SidebarGroup className="px-0 py-1"><SidebarGroupContent><SidebarMenu className="gap-1">
    <SidebarMenuItem><SidebarMenuButton asChild tooltip="الدعم والتذاكر" className={style}>
      <Link href={supportHref(product)}><Headset className="h-4 w-4 text-cyan-500" /><span>الدعم والتذاكر</span>{summary.unread > 0 && <span className="ms-auto rounded-full bg-cyan-600 px-1.5 text-[10px] text-white">{summary.unread > 99 ? "99+" : summary.unread}</span>}</Link>
    </SidebarMenuButton></SidebarMenuItem>
    <SidebarMenuItem><SidebarMenuButton asChild tooltip="تتبع طلبات كن مطور" className={style}><Link href={developerRequestsHref(product)}><History className="h-4 w-4 text-violet-500" /><span>تتبع طلبات كن مطور</span></Link></SidebarMenuButton></SidebarMenuItem>
  </SidebarMenu></SidebarGroupContent></SidebarGroup>;
}
