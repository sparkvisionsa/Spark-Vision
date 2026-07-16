"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * إطار صفحات مراحل التقرير المبسّط: الرأس ثابت في أعلى العمود، والمحتوى يتمرّر أسفله فقط
 * (بدون تداخل مع شريط المسار/الخطوات).
 */
export function MvWorkflowPageFrame({
  children,
  className,
  dir,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: "rtl" | "ltr";
}) {
  return (
    <div dir={dir} className={cn("mv-page-frame flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function MvWorkflowPageScrollBody({
  children,
  className,
  ...rest
}: { children: React.ReactNode; className?: string } & Omit<ComponentProps<"div">, "children" | "className">) {
  return (
    <div className={cn("mv-scroll-region min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain", className)} {...rest}>
      {children}
    </div>
  );
}
