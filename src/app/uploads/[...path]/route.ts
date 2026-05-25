import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ path?: string[] }> };

const FORWARD_HEADERS = ["range", "if-none-match", "if-modified-since", "x-request-id"] as const;
const RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "cache-control",
  "etag",
  "last-modified",
] as const;

async function proxyUpload(request: NextRequest, context: RouteCtx) {
  const { path = [] } = await context.params;
  if (path.length === 0 || path.some((segment) => segment === ".." || segment.includes("\\"))) {
    return NextResponse.json({ error: "invalid_upload_path" }, { status: 400 });
  }

  const url = new URL(request.url);
  const joinedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const target = `${mvBackendOriginForProxy()}/uploads/${joinedPath}${url.search}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      redirect: "manual",
    });

    const outHeaders = new Headers();
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) outHeaders.set(name, value);
    }

    if (!outHeaders.has("cache-control")) {
      outHeaders.set("cache-control", "public, max-age=31536000, immutable");
    }

    return new NextResponse(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
  } catch (err) {
    console.error("[uploads proxy] upstream failed", err);
    return NextResponse.json(
      { error: "upstream_unreachable", message: "تعذر تحميل الملف من الخادم." },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteCtx) {
  return proxyUpload(request, context);
}

export async function HEAD(request: NextRequest, context: RouteCtx) {
  return proxyUpload(request, context);
}
