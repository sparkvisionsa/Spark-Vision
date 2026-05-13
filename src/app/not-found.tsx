"use client";

import Link from "@/components/prefetch-link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-10" dir="rtl">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">الصفحة غير موجودة</h1>
        <p className="text-sm text-slate-600">
          الرابط المطلوب غير متاح حاليًا. يمكنك العودة للصفحة الرئيسية.
        </p>
        <Button asChild>
          <Link href="/">العودة للرئيسية</Link>
        </Button>
      </div>
    </main>
  );
}
