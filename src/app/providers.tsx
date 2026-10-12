"use client";

import type { ReactNode } from "react";
import AuthTrackingProvider, { useAuthTracking } from "@/components/auth-tracking-provider";
import LayoutProvider from "@/components/layout-provider";
import RoutePrefetcher from "@/components/route-prefetcher";
import { Toaster } from "@/components/ui/toaster";
import { RealtimeProvider } from "@/components/support/realtime-provider";
import { SupportProvider } from "@/components/support/support-provider";
import { HelperRecordingProvider } from "@/components/helper-recording-provider";
import { MvBackgroundUploadProvider } from "@/components/mv-background-upload-provider";

function AuthSessionScope({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthTracking();
  // A key here deliberately unmounts every authenticated workspace/provider
  // when the principal changes. No component state can survive account or
  // company switching in the same tab.
  const principalKey = loading
    ? "auth-loading"
    : user
      ? `${user.id}:${user.companyId ?? ""}:${user.role}`
      : "signed-out";

  return (
    <RealtimeProvider key={principalKey}>
      <HelperRecordingProvider>
      <SupportProvider>
      {children}
      <MvBackgroundUploadProvider />
      <RoutePrefetcher />
      <Toaster />
      </SupportProvider>
      </HelperRecordingProvider>
    </RealtimeProvider>
  );
}

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LayoutProvider>
      <AuthTrackingProvider>
        <AuthSessionScope>{children}</AuthSessionScope>
      </AuthTrackingProvider>
    </LayoutProvider>
  );
}
