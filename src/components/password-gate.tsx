"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type GateState = "checking" | "allowed" | "locked";

const PASSWORD = "11447";
const STORAGE_KEY = "spark-vision-password-gate";

let cachedGateState: GateState | null = null;

function readStoredGateState(): GateState | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "allowed"
      ? "allowed"
      : null;
  } catch {
    return null;
  }
}

function storeAllowedGateState() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "allowed");
  } catch {
    // Session storage may be unavailable in strict privacy modes.
  }
}

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [gateState, setGateState] = useState<GateState>(
    cachedGateState ?? "checking",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const nextState = cachedGateState ?? readStoredGateState();
    if (nextState) {
      cachedGateState = nextState;
      setGateState(nextState);
      return;
    }

    setGateState("locked");
  }, []);

  if (gateState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6" dir="rtl">
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" aria-label="جاري التحميل" />
      </main>
    );
  }

  if (gateState === "locked") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6" dir="rtl">
        <form
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-right shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (password === PASSWORD) {
              cachedGateState = "allowed";
              storeAllowedGateState();
              setGateState("allowed");
              setError("");
              return;
            }
            setError("كلمة المرور غير صحيحة");
          }}
        >
          <h1 className="text-lg font-bold text-foreground">دخول Spark Vision</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            أدخل كلمة المرور لعرض الواجهة.
          </p>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            autoFocus
            className="mt-5 h-11 w-full rounded-xl border border-input bg-background px-3 text-right text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          />
          {error ? <p className="mt-3 text-sm font-semibold text-destructive">{error}</p> : null}
          <button
            type="submit"
            className="mt-5 h-11 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            دخول
          </button>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}
