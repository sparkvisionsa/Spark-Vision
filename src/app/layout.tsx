import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import AppProviders from "./providers";

export const metadata: Metadata = {
  title: "Spark Vision",
  description: "Smart Software Solutions for a Smarter Future",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
  },
};

/**
 * Runs before any webpack chunk (including this very layout's own chunk) has a chance to
 * load, so it can recover even when `app/layout.js` itself times out on a cold dev-server
 * start. Without this, a failed chunk load leaves the user stuck on the error overlay until
 * they manually reload.
 */
const CHUNK_ERROR_RECOVERY_SCRIPT = `(function () {
  try {
    var STORAGE_KEY = "sv:chunk-reload-at";
    var MIN_INTERVAL_MS = 4000;
    function isChunkLoadFailure(message) {
      return /ChunkLoadError|Loading (chunk|CSS chunk) [\\s\\S]*? failed/i.test(String(message || ""));
    }
    function recover(message) {
      if (!isChunkLoadFailure(message)) return;
      var now = Date.now();
      var last = Number(sessionStorage.getItem(STORAGE_KEY) || 0);
      if (now - last < MIN_INTERVAL_MS) return;
      sessionStorage.setItem(STORAGE_KEY, String(now));
      window.location.reload();
    }
    window.addEventListener("error", function (event) {
      recover(event && (event.message || (event.error && event.error.message)));
    });
    window.addEventListener("unhandledrejection", function (event) {
      var reason = event && event.reason;
      recover(reason && (reason.message || reason));
    });
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning={true}>
      <body className="font-body antialiased">
        <Script id="chunk-error-recovery" strategy="beforeInteractive">
          {CHUNK_ERROR_RECOVERY_SCRIPT}
        </Script>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
