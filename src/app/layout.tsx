import type { Metadata } from "next";
import "./globals.css";
import AppProviders from "./providers";

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
      <body className="font-body antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
