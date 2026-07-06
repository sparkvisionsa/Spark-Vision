"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ValueTechPasswordGateScreen } from "@/components/value-tech-login-experience";

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
      <main className="vt-login-screen fixed inset-0 z-[100] flex items-center justify-center" dir="rtl">
        <div className="h-12 w-12 animate-pulse rounded-full border border-[#f5c76e]/50 bg-[#f5c76e]/25" aria-label="جاري التحميل" />
      </main>
    );
  }

  if (gateState === "locked") {
    return (
      <ValueTechPasswordGateScreen
        password={password}
        error={error}
        onPasswordChange={(value) => {
          setPassword(value);
          setError("");
        }}
        onSubmit={() => {
          if (password === PASSWORD) {
            cachedGateState = "allowed";
            storeAllowedGateState();
            setGateState("allowed");
            setError("");
            return;
          }
          setError("كلمة المرور غير صحيحة");
        }}
      />
    );
  }

  return <>{children}</>;
}
