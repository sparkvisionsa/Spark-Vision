"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/prefetch-link";
import {
  BarChart3,
  Building2,
  FolderKanban,
  Wrench,
} from "lucide-react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import type { MvProject } from "./types";
import { MvMetricCard, MvTopBar } from "./mv-ui";

export default function MvDashboardHome() {
  const { user, loading: authLoading } = useAuthTracking();
  const [projects, setProjects] = useState<MvProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/mv/projects", { credentials: "include" });
      if (!res.ok) throw new Error();
      setProjects((await res.json()) as MvProject[]);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load, user?.id, user?.companyId, user?.role]);

  const scoped = useMemo(() => {
    if (!user) return [];
    return projects;
  }, [projects, user]);

  const metrics = useMemo(() => {
    const active = scoped.filter((p) => (p.sheetCount ?? 0) > 0).length;
    return [
      { title: "مشاريع التقييم", value: loading ? "…" : scoped.length, hint: "ضمن شركتك / صلاحياتك" },
      { title: "بها بيانات", value: loading ? "…" : active, hint: "جداول أو استيراد" },
    ];
  }, [scoped, loading]);

  const tiles = [
    {
      href: "/machine-valuation/projects",
      title: "إحصائيات المشاريع",
      desc: "بطاقات وجدول ملخص لكل المشاريع.",
      icon: <BarChart3 className="h-5 w-5 text-sky-700" />,
    },
    {
      href: "/machine-valuation/company",
      title: "لوحة إدارة الشركة",
      desc: "إدارة مستخدمي الشركة والإعدادات والتوقيعات.",
      icon: <Building2 className="h-5 w-5 text-[#0C447C]" />,
    },
  ] as const;

  return (
    <div className="min-h-screen" dir="rtl">
      <MvTopBar
        breadcrumbs={[{ label: "لوحة التحكم" }]}
        sticky
        className="top-0 z-30 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85"
      />

      <div className="space-y-5 px-5 py-5">
        <section className="overflow-hidden rounded-2xl border border-sky-200/60 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-amber-100 text-[#0C447C]">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-2">
                <h1 className="text-[17px] font-semibold text-slate-900">لوحة تحكم تقييم الآلات</h1>
                <p className="text-[13px] leading-relaxed text-slate-600">
                  <span className="font-medium text-slate-800">لوحة التحكم</span> تعرض اختصارات الإدارة الأساسية فقط:
                  إحصائيات المشاريع ولوحة إدارة الشركة.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          {metrics.map((m) => (
            <MvMetricCard
              key={m.title}
              title={m.title}
              value={m.value}
              hint={m.hint}
              icon={m.title.includes("بيانات") ? <BarChart3 className="h-5 w-5 text-[#378ADD]" /> : <FolderKanban className="h-5 w-5 text-[#0C447C]" />}
            />
          ))}
        </div>

        <div>
          <h2 className="mb-3 text-[14px] font-medium text-slate-900">وصول سريع</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {tiles.map((tile) => (
              <Link
                key={tile.href + tile.title}
                href={tile.href}
                className="group flex gap-3 rounded-xl border border-slate-200/90 bg-white/90 p-3.5 text-right shadow-sm transition hover:border-sky-300/70 hover:bg-sky-50/40"
              >
                <div className="mt-0.5 shrink-0 rounded-lg bg-slate-50 p-2 transition group-hover:bg-white">{tile.icon}</div>
                <div className="min-w-0 space-y-1">
                  <div className="text-[13px] font-semibold text-slate-900">{tile.title}</div>
                  <p className="text-[11px] leading-snug text-slate-600">{tile.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
