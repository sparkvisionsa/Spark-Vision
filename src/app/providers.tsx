"use client";

import type { ReactNode } from "react";
import AuthTrackingProvider from "@/components/auth-tracking-provider";
import LayoutProvider from "@/components/layout-provider";
import PasswordGate from "@/components/password-gate";
import RoutePrefetcher from "@/components/route-prefetcher";
import { Toaster } from "@/components/ui/toaster";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PasswordGate>
      <LayoutProvider>
        <AuthTrackingProvider>
          {children}
          <RoutePrefetcher />
          <Toaster />
        </AuthTrackingProvider>
      </LayoutProvider>
    </PasswordGate>
  );
}
