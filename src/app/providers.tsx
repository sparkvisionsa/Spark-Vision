"use client";

import type { ReactNode } from "react";
import AuthTrackingProvider from "@/components/auth-tracking-provider";
import LayoutProvider from "@/components/layout-provider";
import RoutePrefetcher from "@/components/route-prefetcher";
import { Toaster } from "@/components/ui/toaster";
import { RealtimeProvider } from "@/components/support/realtime-provider";
import { SupportProvider } from "@/components/support/support-provider";
import { HelperRecordingProvider } from "@/components/helper-recording-provider";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LayoutProvider>
      <AuthTrackingProvider>
        <RealtimeProvider>
        <HelperRecordingProvider>
        <SupportProvider>
        {children}
        <RoutePrefetcher />
        <Toaster />
        </SupportProvider>
        </HelperRecordingProvider>
        </RealtimeProvider>
      </AuthTrackingProvider>
    </LayoutProvider>
  );
}
