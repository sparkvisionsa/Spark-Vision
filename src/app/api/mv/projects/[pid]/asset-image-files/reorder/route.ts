import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

/**
 * توجيه صريح لـ .../asset-image-files/reorder نحو Nest (تفادي 404 من المسار العام ‎[...path]‎).
 */
export const runtime = "nodejs";

const FORWARD_HEADERS = [
  "cookie",
  "authorization",
  "content-type",
  "x-csrf-token",
  "x-request-id",
] as const;

async function proxyReorder(request: NextRequest, pid: string) {
  const url = new URL(request.url);
  const target = `${mvBackendOriginForProxy()}/api/mv/projects/${encodeURIComponent(pid)}/asset-image-files/reorder${url.search}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  try {
    const upstream = await fetch(target, init);
    const outHeaders = new Headers();
    const passthrough = ["content-type", "content-disposition", "cache-control"];
    for (const name of passthrough) {
      const v = upstream.headers.get(name);
      if (v) outHeaders.set(name, v);
    }
    if (!upstream.ok) {
      const body = await upstream.arrayBuffer();
      return new NextResponse(body.byteLength > 0 ? body : null, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: outHeaders,
      });
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
  } catch (err) {
    console.error("[api/mv/asset-image-files/reorder] upstream failed", err);
    return NextResponse.json(
      {
        error: "upstream_unreachable",
        message: "تعذر الاتصال بخادم التقييم. تأكد أن الخلفية تعمل.",
      },
      { status: 502 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ pid: string }> },
) {
  const { pid } = await context.params;
  return proxyReorder(request, pid);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pid: string }> },
) {
  const { pid } = await context.params;
  return proxyReorder(request, pid);
}
