import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

/**
 * Streams multipart uploads to Nest without buffering the whole request in
 * Next.js memory. Serverless platforms can still enforce their own hard body
 * limit, so large valuation-accounting images are compressed before this route.
 */
export const runtime = "nodejs";

const FORWARD_HEADERS = [
  "cookie",
  "authorization",
  "content-type",
  "x-csrf-token",
  "x-request-id",
] as const;

async function proxyFilesRequest(
  request: NextRequest,
  context: { params: Promise<{ pid: string }> },
  method: "GET" | "POST",
) {
  const { pid } = await context.params;
  const url = new URL(request.url);
  const target = `${mvBackendOriginForProxy()}/api/mv/projects/${encodeURIComponent(pid)}/files${url.search}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const body = method === "GET" ? undefined : request.body;

  try {
    const init: RequestInit & { duplex?: "half" } = {
      method,
      headers,
      body,
      redirect: "manual",
    };
    if (body) init.duplex = "half";

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
    console.error("[api/mv/projects/.../files] proxy failed", err);
    return NextResponse.json(
      {
        error: "upstream_unreachable",
        message: "تعذر الاتصال بخادم التقييم. تأكد أن الخلفية تعمل.",
      },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pid: string }> },
) {
  return proxyFilesRequest(request, context, "GET");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pid: string }> },
) {
  return proxyFilesRequest(request, context, "POST");
}
