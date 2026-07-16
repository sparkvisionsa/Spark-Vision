"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { useMvI18n } from "./mv-i18n";

export const MvDialog = DialogPrimitive.Root;
export const MvDialogTrigger = DialogPrimitive.Trigger;
export const MvDialogClose = DialogPrimitive.Close;

export interface MvDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  showClose?: boolean;
  closeLabel?: string;
  /** زر إغلاق فاتح على رؤوس داكنة (مثل ترويسة بيانات الأصول). */
  closeOnDark?: boolean;
}

export const MvDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  MvDialogContentProps
>(
  (
    {
      className,
      children,
      showClose = true,
      closeLabel,
      closeOnDark = false,
      dir: dirProp,
      ...props
    },
    ref,
  ) => {
    const { dir: contextDir, t } = useMvI18n();
    const dir = dirProp ?? contextDir;
    const label = closeLabel ?? t("common.close");

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          dir={dir}
          data-mv-dialog="true"
          className={cn(
            "fixed left-1/2 top-1/2 z-[910] grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "sm:rounded-lg",
            className,
          )}
          {...props}
        >
          {children}
          {showClose ? (
            <DialogPrimitive.Close
              type="button"
              aria-label={label}
              className={cn(
                "mv-dialog-close absolute end-4 top-4 z-[70]",
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                "border shadow-md transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/45 focus-visible:ring-offset-2",
                "disabled:pointer-events-none",
                closeOnDark
                  ? "border-white/30 bg-white/95 text-slate-900 hover:bg-white hover:text-slate-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
MvDialogContent.displayName = "MvDialogContent";

/** يحجز مساحة لزر الإغلاق حتى لا يتداخل مع العنوان. */
export function MvDialogHeaderBar({
  className,
  children,
  dark = false,
}: {
  className?: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "mv-dialog-header relative shrink-0 pe-14 ps-5 py-4 text-start",
        dark ? "text-white" : "border-b border-slate-200/80 bg-slate-50",
        className,
      )}
    >
      {children}
    </div>
  );
}
