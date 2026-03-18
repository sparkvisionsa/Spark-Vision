"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import Link from "@/components/prefetch-link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Logo                                                               */
/* ------------------------------------------------------------------ */

function HeroLogo({ size = 40 }: { size?: number }) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-bg`}
          x1="0"
          y1="0"
          x2="36"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0d9488" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient
          id={`${id}-sh`}
          x1="18"
          y1="0"
          x2="18"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0.28" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="9" fill={`url(#${id}-bg)`} />
      <rect width="36" height="36" rx="9" fill={`url(#${id}-sh)`} />
      <path
        d="M11.5 11L18 26L24.5 11"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 7.5L19.2 9.5L18 11.5L16.8 9.5Z"
        fill="white"
        fillOpacity="0.8"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Interactive smoke canvas                                           */
/* ------------------------------------------------------------------ */

interface Mou {
  x: number;
  y: number;
  active: boolean;
}

function SmokeCanvas({
  mouse,
}: {
  mouse: { readonly current: Mou };
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let t = 0;

    interface P {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      a: number;
      sd: number;
      sp: number;
      h: number;
      s: number;
      l: number;
    }

    let pts: P[] = [];

    const resize = () => {
      const rc = cvs.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = rc.width;
      h = rc.height;
      cvs.width = w * dpr;
      cvs.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      resize();
      const n = Math.min(Math.floor((w * h) / 6500), 170);
      pts = [];
      for (let i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.06,
          r: Math.random() * 100 + 25,
          a: Math.random() * 0.10 + 0.02,
          sd: Math.random() * 6283,
          sp: Math.random() * 0.08 + 0.02,
          h: 0,
          s: 0,
          l: Math.random() * 15 + 85,
        });
      }
    };

    const tick = () => {
      t += 0.0008;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const m = mouse.current;
      const mx = m.x * w;
      const my = m.y * h;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];

        p.x += p.vx + Math.sin(t * p.sp + p.sd) * 0.12;
        p.y += p.vy + Math.cos(t * p.sp * 0.7 + p.sd + 2) * 0.08;

        if (m.active) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const d2 = dx * dx + dy * dy;
          const R = 280;
          if (d2 < R * R && d2 > 1) {
            const d = Math.sqrt(d2);
            const f = (1 - d / R) * 1.2;
            p.x += (dx / d) * f;
            p.y += (dy / d) * f;
          }
        }

        if (p.x < -p.r) p.x += w + p.r * 2;
        else if (p.x > w + p.r) p.x -= w + p.r * 2;
        if (p.y < -p.r) p.y += h + p.r * 2;
        else if (p.y > h + p.r) p.y -= h + p.r * 2;

        const al = p.a * (0.6 + 0.4 * Math.sin(t * 0.4 + p.sd));
        ctx.globalAlpha = al;
        ctx.fillStyle = `hsl(${p.h},${p.s}%,${p.l}%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    seed();
    tick();

    const onResize = () => {
      const oldW = w;
      const oldH = h;
      resize();
      if (oldW > 0 && oldH > 0) {
        const sx = w / oldW;
        const sy = h / oldH;
        for (const p of pts) {
          p.x *= sx;
          p.y *= sy;
        }
      }
    };

    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [mouse]);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 h-full w-full"
      style={{ filter: "blur(45px)" }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export type ValueTechHeroCopy = {
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  ctaHint: string;
};

type ValueTechHeroProps = {
  copy: ValueTechHeroCopy;
  isArabic?: boolean;
  videoSrc?: string | null;
  className?: string;
  ctaScrollToId?: string;
};

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

export default function ValueTechHero({
  copy,
  isArabic,
  className,
  ctaScrollToId,
}: ValueTechHeroProps) {
  const mouseRef = useRef<Mou>({ x: 0.5, y: 0.5, active: false });
  const glowRef = useRef<HTMLDivElement>(null);

  const handleScrollToProducts = () => {
    const el =
      typeof document !== "undefined"
        ? document.getElementById(ctaScrollToId!)
        : null;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rc = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rc.left;
    const y = e.clientY - rc.top;
    mouseRef.current = { x: x / rc.width, y: y / rc.height, active: true };
    if (glowRef.current) {
      glowRef.current.style.background = `radial-gradient(550px circle at ${x}px ${y}px,rgba(13,148,136,0.13),transparent 65%)`;
      glowRef.current.style.opacity = "1";
    }
  }, []);

  const onLeave = useCallback(() => {
    mouseRef.current.active = false;
    if (glowRef.current) glowRef.current.style.opacity = "0";
  }, []);

  return (
    <section
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        "relative flex min-h-[72vh] w-full items-center justify-center overflow-hidden rounded-3xl border border-white/[0.06] bg-slate-950 shadow-2xl shadow-slate-900/30",
        className,
      )}
      aria-label="Hero"
    >
      {/* ---- Animated smoke background ---- */}
      <div className="absolute inset-0">
        <SmokeCanvas mouse={mouseRef} />

        {/* Subtle dark overlay to ensure text readability */}
        <div
          className="absolute inset-0 bg-slate-950/55"
          aria-hidden
        />

        {/* Mouse-following glow */}
        <div
          ref={glowRef}
          className="absolute inset-0 pointer-events-none opacity-0"
          style={{ transition: "opacity 0.6s ease" }}
          aria-hidden
        />

        {/* Edge gradients for depth */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-transparent to-slate-950/70"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,transparent_40%,rgba(2,6,23,0.5))]"
          aria-hidden
        />
      </div>

      {/* ---- Content ---- */}
      <div
        className={cn(
          "relative z-10 mx-auto max-w-3xl px-6 py-16 text-center md:px-10 md:py-20",
          isArabic && "font-value-tech",
        )}
      >
        {/* Logo + Badge */}
        <div className="value-tech-hero-badge flex flex-col items-center gap-4">
          <span className="inline-flex rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/[0.08] backdrop-blur-sm">
            <HeroLogo size={44} />
          </span>
          <span className="inline-flex items-center rounded-full border border-teal-400/20 bg-teal-500/10 px-4 py-1.5 text-[13px] font-medium tracking-wide text-teal-200/90 backdrop-blur-sm">
            {copy.badge}
          </span>
        </div>

        <h1 className="value-tech-hero-title mt-8 text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-[4.25rem] lg:leading-[1.1]">
          <span className="bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
            {copy.title}
          </span>
        </h1>

        <p className="value-tech-hero-subtitle mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-slate-400 sm:text-lg">
          {copy.subtitle}
        </p>

        <div className="value-tech-hero-cta mt-10 flex flex-wrap items-center justify-center gap-4">
          {ctaScrollToId ? (
            <Button
              type="button"
              size="lg"
              onClick={handleScrollToProducts}
              className="group min-w-[200px] rounded-xl border border-white/10 bg-white/[0.08] px-7 py-6 text-[15px] font-medium text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.14] hover:border-white/20"
              aria-label={copy.ctaHint}
            >
              <span className="flex items-center justify-center gap-2.5">
                {copy.cta}
                <ArrowRight
                  className={cn(
                    "h-4 w-4 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5",
                    isArabic && "rotate-180",
                  )}
                  aria-hidden
                />
              </span>
            </Button>
          ) : (
            <Button
              asChild
              size="lg"
              className="group min-w-[200px] rounded-xl border border-white/10 bg-white/[0.08] px-7 py-6 text-[15px] font-medium text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.14] hover:border-white/20"
            >
              <Link
                href="/value-tech-app"
                className="flex items-center justify-center gap-2.5"
              >
                {copy.cta}
                <ArrowRight
                  className={cn(
                    "h-4 w-4 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5",
                    isArabic && "rotate-180",
                  )}
                  aria-hidden
                />
              </Link>
            </Button>
          )}
        </div>
        <p className="sr-only">{copy.ctaHint}</p>
      </div>
    </section>
  );
}
