import type { Metadata } from "next";
import "./globals.css";
import LayoutProvider from "@/components/layout-provider";
import AuthTrackingProvider from "@/components/auth-tracking-provider";
import RoutePrefetcher from "@/components/route-prefetcher";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Spark Vision",
  description: "Smart Software Solutions for a Smarter Future",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning={true}>
      {/* <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head> */}
      <body className="font-body antialiased">
        <LayoutProvider>
          <AuthTrackingProvider>
            {children}
            <RoutePrefetcher />
            <Toaster />
          </AuthTrackingProvider>
        </LayoutProvider>
      </body>
    </html>
  );
}
