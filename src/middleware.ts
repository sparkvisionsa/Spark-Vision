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

  if (pathname === "/machine-valuation") {
    return NextResponse.redirect(new URL("/machine-valuation/projects", request.url));
  }

  const mvSegments = pathname.split("/").filter(Boolean);
  if (
    mvSegments.length === 4 &&
    mvSegments[0] === "machine-valuation" &&
    mvSegments[2] === "workflow" &&
    mvSegments[3] === "folders"
  ) {
    return NextResponse.redirect(
      new URL(`/machine-valuation/${mvSegments[1]}/workflow/asset-images`, request.url),
    );
  }

  if (
    mvSegments.length === 3 &&
    mvSegments[0] === "machine-valuation" &&
    mvSegments[2] === "workflow"
  ) {
    return NextResponse.redirect(
      new URL(`/machine-valuation/${mvSegments[1]}/workflow/report-data`, request.url),
    );
  }

  if (
    mvSegments.length === 2 &&
    mvSegments[0] === "machine-valuation" &&
    mvSegments[1] !== "projects" &&
    mvSegments[1] !== "dashboard" &&
    mvSegments[1] !== "company"
  ) {
    return NextResponse.redirect(
      new URL(`/machine-valuation/${mvSegments[1]}/workflow/report-data`, request.url),
    );
  }

  /** صفحة ثابتة تحت ‎/machine-valuation/company‎ — لا تُعاد كتابتها إلى ‎/w‎ حتى تُحمَّل من ‎app/machine-valuation/company‎ مع الهيكل الصحيح. */
  if (pathname === "/machine-valuation/company") {
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
