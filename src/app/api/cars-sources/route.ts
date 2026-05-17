import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 120_000;

const FORWARD_HEADERS = ["cookie", "authorization", "accept", "accept-language"] as const;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const target = `${mvBackendOriginForProxy()}/api/cars-sources${url.search}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const body = await upstream.arrayBuffer();
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);

    return new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[api/cars-sources] upstream failed", error);
    return NextResponse.json(
      {
        error: "upstream_unavailable",
        message: "تعذر جلب نتائج البحث. حاول مرة أخرى أو فعّل «تطابق» للدقة.",
      },
      { status: 502 }
    );
  }
}
