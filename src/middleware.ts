import { NextRequest, NextResponse } from "next/server";

const FORCED_PATH = "/evaluation-source/cars";

function isStaticAsset(pathname: string) {
  return /\.[^/]+$/.test(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname === FORCED_PATH ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/__nextjs") ||
    isStaticAsset(pathname)
  ) {
    return NextResponse.next();
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = FORCED_PATH;
  rewriteUrl.search = search;
  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: "/:path*",
};
