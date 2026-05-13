import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORWARD_HEADERS = ["cookie", "authorization", "content-type", "x-csrf-token", "x-request-id"] as const;

function collectSetCookieHeaders(upstream: Response): string[] {
  const anyHeaders = upstream.headers as unknown as { getSetCookie?: () => string[] };
  const fromMethod = anyHeaders.getSetCookie?.();
  if (fromMethod && fromMethod.length > 0) return fromMethod;
  const single = upstream.headers.get("set-cookie");
  return single ? [single] : [];
}

async function proxyToNest(request: NextRequest) {
  const url = new URL(request.url);
  const target = `${mvBackendOriginForProxy()}/api/company/report-defaults${url.search}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const upstream = await fetch(target, {
    method: "GET",
    headers,
    redirect: "manual",
  });

  const outHeaders = new Headers();
  for (const name of ["content-type", "content-disposition", "cache-control"] as const) {
    const v = upstream.headers.get(name);
    if (v) outHeaders.set(name, v);
  }

  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
  res.headers.set("x-spark-proxy", "company-report-defaults");
  for (const c of collectSetCookieHeaders(upstream)) {
    res.headers.append("set-cookie", c);
  }
  return res;
}

export async function GET(request: NextRequest) {
  return proxyToNest(request);
}
