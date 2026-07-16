"use client";

import {
  Component,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ErrorInfo,
  type ReactNode,
} from "react";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "@/components/prefetch-link";
import { cn } from "@/lib/utils";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import {
  getMvLoadingSnapshot,
  getMvLoadingState,
  subscribeMvLoading,
} from "./mv-loading-state";
import { useMvI18n } from "./mv-i18n";

type BoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

type BoundaryState = {
  error: Error | null;
};

function MvRenderErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t, dir } = useMvI18n();

  return (
    <main className="flex min-h-[min(70vh,680px)] w-full items-center justify-center px-4 py-12" dir={dir}>
      <section className="w-full max-w-xl rounded-3xl border border-red-200/80 bg-white p-6 text-center shadow-xl shadow-slate-900/5 sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-lg font-black text-slate-950">{t("shell.error.unexpectedTitle")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          {t("shell.error.unexpectedBody")}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={onRetry} className="rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800">
            <RefreshCw className="h-4 w-4" />
            {t("common.retry")}
          </Button>
          <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white px-5">
            <Link href="/machine-valuation/projects">{t("shell.error.backToProjects")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

class MvRenderErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[machine-valuation] render failed", error, info.componentStack);
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return <MvRenderErrorFallback onRetry={this.retry} />;
  }
}

function MvConnectivityNotice() {
  const { t, dir } = useMvI18n();
  const [online, setOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    wasOffline.current = !navigator.onLine;

    const onOffline = () => {
      wasOffline.current = true;
      setShowRestored(false);
      setOnline(false);
    };
    const onOnline = () => {
      setOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        setShowRestored(true);
      }
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    if (!showRestored) return;
    const timeout = window.setTimeout(() => setShowRestored(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [showRestored]);

  if (online && !showRestored) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold shadow-xl backdrop-blur",
        online
          ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
          : "border-amber-200 bg-amber-50/95 text-amber-900",
      )}
      role="status"
      aria-live="polite"
      dir={dir}
    >
      {online ? <CheckCircle2 className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      {online ? t("shell.connectivity.restored") : t("shell.connectivity.offline")}
    </div>
  );
}

function MvNavigationFeedback() {
  const { t } = useMvI18n();
  const { currentPath, isNavigating } = useMvInPageNavigation();
  useSyncExternalStore(subscribeMvLoading, getMvLoadingSnapshot, getMvLoadingSnapshot);
  const dataLoading = getMvLoadingState();
  const active = isNavigating || dataLoading.active;
  const visible = useStableLoadingVisibility(active);
  const label = isNavigating
    ? t("shell.nav.openingPage")
    : dataLoading.label || t("common.loading.default");

  return (
    <>
      {visible ? <MvMachineLoadingOverlay label={label} /> : null}
      <span className="sr-only" role="status" aria-live="polite">
        {active ? label : t("shell.nav.opened", { path: currentPath })}
      </span>
    </>
  );
}

function useStableLoadingVisibility(active: boolean) {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef(0);

  useEffect(() => {
    if (active) {
      if (visible) return;
      const showTimer = window.setTimeout(() => {
        shownAtRef.current = performance.now();
        setVisible(true);
      }, 120);
      return () => window.clearTimeout(showTimer);
    }

    if (!visible) return;
    const elapsed = performance.now() - shownAtRef.current;
    const hideTimer = window.setTimeout(() => setVisible(false), Math.max(0, 460 - elapsed));
    return () => window.clearTimeout(hideTimer);
  }, [active, visible]);

  return visible;
}

function MvMachineLoadingOverlay({ label }: { label: string }) {
  const { dir } = useMvI18n();

  return (
    <div
      className="mv-machine-loader fixed inset-0 z-[130] flex items-center justify-center overflow-hidden bg-[#061a33]/90 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
      dir={dir}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_43%,rgba(14,165,233,0.14),transparent_31%),radial-gradient(circle_at_52%_47%,rgba(201,150,58,0.1),transparent_47%),linear-gradient(145deg,rgba(2,12,27,0.12),rgba(6,26,51,0.4))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.15)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]" />

      <div className="relative flex h-56 w-56 items-center justify-center" aria-hidden>
        <div className="mv-loader-halo absolute inset-2 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="mv-loader-orbit absolute inset-5 rounded-full border border-cyan-200/15 border-t-cyan-300/80 border-r-[#d4a84f]/65" />
        <div className="mv-loader-orbit-reverse absolute inset-9 rounded-full border border-white/10 border-b-white/55" />
        <div className="absolute inset-[3.15rem] rounded-[2rem] border border-white/10 bg-[#071d39]/75 shadow-[0_24px_70px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl" />
        <div className="mv-loader-logo relative h-28 w-36 overflow-hidden">
          <Image
            src="/value-tech-icon.png"
            alt=""
            width={280}
            height={280}
            priority
            sizes="280px"
            className="absolute left-1/2 top-[-64px] h-[280px] w-[280px] max-w-none -translate-x-1/2 object-cover"
            style={{
              maskImage: "radial-gradient(ellipse 47% 34% at 50% 37%, black 72%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(ellipse 47% 34% at 50% 37%, black 72%, transparent 100%)",
            }}
          />
        </div>
        <div className="mv-loader-sheen absolute bottom-8 h-px w-20 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-8 bg-gradient-to-r from-transparent via-[#e7c270] to-transparent" />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function MvExperienceBoundary({ children }: { children: ReactNode }) {
  const { currentPath } = useMvInPageNavigation();

  return (
    <MvRenderErrorBoundary resetKey={currentPath}>
      {children}
      <MvNavigationFeedback />
      <MvConnectivityNotice />
    </MvRenderErrorBoundary>
  );
}
