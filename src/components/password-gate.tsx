"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type GateState = "checking" | "allowed" | "denied";

const PASSWORD = "11447";

let cachedGateState: GateState | null = null;

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [gateState, setGateState] = useState<GateState>(
    cachedGateState ?? "checking",
  );

  useEffect(() => {
    if (cachedGateState) {
      setGateState(cachedGateState);
      return;
    }

    const user = window.prompt("ادخل كلمة المرور:");
    cachedGateState = user === PASSWORD ? "allowed" : "denied";
    setGateState(cachedGateState);
  }, []);

  if (gateState === "checking") {
    return null;
  }

  if (gateState === "denied") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-xl font-semibold text-destructive">
        كلمة المرور غير صحيحة
      </main>
    );
  }

  return <>{children}</>;
}
