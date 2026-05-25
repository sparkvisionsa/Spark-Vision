import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ path?: string[] }> };

const FORWARD_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "if-modified-since",
  "if-none-match",
  "range",
  "x-csrf-token",
  "x-request-id",
] as const;

const RESPONSE_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
  "location",
  "x-accel-buffering",
] as const;

function collectSetCookieHeaders(upstream: Response): string[] {
  const anyHeaders = upstream.headers as unknown as { getSetCookie?: () => string[] };
  const fromMethod = anyHeaders.getSetCookie?.();
  if (fromMethod && fromMethod.length > 0) return fromMethod;
  const single = upstream.headers.get("set-cookie");
  return single ? [single] : [];
}

async function proxyApiPathToBackend(request: NextRequest, context: RouteCtx) {
  const { path = [] } = await context.params;
  if (path.length === 0 || path.some((segment) => segment === ".." || segment.includes("\\"))) {
    return NextResponse.json({ error: "invalid_api_path" }, { status: 400 });
  }

  const url = new URL(request.url);
  const joinedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const target = `${mvBackendOriginForProxy()}/api/${joinedPath}${url.search}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = request.method.toUpperCase();
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    const body = request.body;
    if (body) {
      init.body = body;
      init.duplex = "half";
    }
  }

  try {
    const upstream = await fetch(target, init);
    const outHeaders = new Headers();
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) outHeaders.set(name, value);
    }

    const response = new NextResponse(method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
    response.headers.set("x-spark-proxy", "api-backend");
    for (const cookie of collectSetCookieHeaders(upstream)) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (err) {
    console.error("[api proxy] upstream failed", err);
    return NextResponse.json(
      {
        error: "backend_unreachable",
        message:
          "تعذر الاتصال بالخادم الخلفي. شغل SparkVision-Backend أو عدل BACKEND_URL / NEXT_PUBLIC_API_BASE_URL.",
      },
      { status: 503 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteCtx) {
  return proxyApiPathToBackend(request, context);
}

export async function HEAD(request: NextRequest, context: RouteCtx) {
  return proxyApiPathToBackend(request, context);
}

export async function POST(request: NextRequest, context: RouteCtx) {
  return proxyApiPathToBackend(request, context);
}

export async function PUT(request: NextRequest, context: RouteCtx) {
  return proxyApiPathToBackend(request, context);
}

export async function PATCH(request: NextRequest, context: RouteCtx) {
  return proxyApiPathToBackend(request, context);
}

export async function DELETE(request: NextRequest, context: RouteCtx) {
  return proxyApiPathToBackend(request, context);
}
