import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

/**
 * Streams multipart uploads to Nest without using next.config rewrites.
 * Rewrites can break large multipart bodies; this route runs on the Node server
 * and forwards the raw stream to the backend.
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

  let body: ArrayBuffer | undefined;
  if (method !== "GET") {
    try {
      body = await request.arrayBuffer();
    } catch (err) {
      console.error("[api/mv/projects/.../files] read body failed", err);
      return NextResponse.json(
        {
          error: "bad_request",
          message: "تعذر قراءة الملفات المرفوعة. جرّب ملفًا أصغر أو أعد المحاولة.",
        },
        { status: 400 },
      );
    }

    if (body.byteLength === 0) {
      return NextResponse.json(
        { error: "bad_request", message: "لم يصل أي محتوى للرفع." },
        { status: 400 },
      );
    }
  }

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: "manual",
    });

    const outHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) outHeaders.set("content-type", contentType);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
  } catch (err) {
    console.error("[api/mv/projects/.../files] proxy POST failed", err);
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
