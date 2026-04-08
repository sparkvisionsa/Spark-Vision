import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * يعيد كتابة مسارات فاليو تك العامة إلى مسار Next واحد (`/w/...`) حتى يُجمَّع مسار واحد فقط
 * ويُحمَّل كل قسم كوحدة (dynamic import) دون إعادة تجميع صفحة كاملة لكل رابط.
 * عنوان المتصفح يبقى كما هو (مثل /clients) — إعادة كتابة داخلية فقط.
 */
const EXACT_REWRITES: [string, string][] = [
  ["/value-tech", "/w/vt"],
  ["/value-tech-app", "/w/value-tech-app"],
  ["/real-estate-valuation", "/w/real-estate-valuation"],
  ["/asset-inventory", "/w/asset-inventory"],
  ["/asset-inspection", "/w/asset-inspection"],
  ["/clients", "/w/clients"],
  ["/settings", "/w/settings"],
];

const PREFIX_REWRITES = ["/machine-valuation", "/evaluation-source"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/w")) {
    return NextResponse.next();
  }

  for (const prefix of PREFIX_REWRITES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return NextResponse.rewrite(new URL(`/w${pathname}`, request.url));
    }
  }

  for (const [from, to] of EXACT_REWRITES) {
    if (pathname === from) {
      return NextResponse.rewrite(new URL(to, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/value-tech",
    "/value-tech-app",
    "/real-estate-valuation",
    "/machine-valuation",
    "/machine-valuation/:path*",
    "/asset-inventory",
    "/asset-inspection",
    "/clients",
    "/settings",
    "/evaluation-source",
    "/evaluation-source/:path*",
  ],
};
