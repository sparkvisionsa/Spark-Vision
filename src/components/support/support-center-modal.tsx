"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import SupportPage from "./support-page";
import type { SupportProduct } from "./support-types";

export default function SupportCenterModal({ open, onOpenChange, mode, product }: { open: boolean; onOpenChange: (value: boolean) => void; mode: "support" | "developer"; product: SupportProduct }) {
  const title = mode === "developer" ? "طلبات كن مطور" : "الدعم والتذاكر";
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="h-[min(820px,calc(100dvh-1rem))] w-[min(1320px,calc(100vw-1rem))] max-w-none overflow-hidden rounded-2xl p-3 shadow-2xl sm:p-4">
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <DialogDescription className="sr-only">عرض {title} داخل الصفحة الحالية</DialogDescription>
      <SupportPage key={`${mode}:${product}`} mode={mode} embedded productOverride={product} />
    </DialogContent>
  </Dialog>;
}
