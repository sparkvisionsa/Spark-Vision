import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

export const runtime = "nodejs";

const FORWARD_HEADERS = [
  "cookie",
  "authorization",
  "content-type",
  "x-csrf-token",
  "x-request-id",
] as const;

export async function POST(request: NextRequest) {
  const target = `${mvBackendOriginForProxy()}/api/mv/upload`;
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const init: RequestInit & { duplex?: "half" } = {
      method: "POST",
      headers,
      body: request.body,
      redirect: "manual",
    };
    if (request.body) init.duplex = "half";

    const upstream = await fetch(target, init);
    const outHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) outHeaders.set("content-type", contentType);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
  } catch (err) {
    console.error("[api/mv/upload] proxy failed", err);
    return NextResponse.json(
      {
        error: "upstream_unreachable",
        message: "تعذر الاتصال بخادم التقييم. تأكد أن الخلفية تعمل.",
      },
      { status: 502 },
    );
  }
}
