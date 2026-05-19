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

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function forwardUpstreamResponse(upstream: Response, slug: string) {
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
  res.headers.set("x-spark-proxy", slug);
  for (const c of collectSetCookieHeaders(upstream)) {
    res.headers.append("set-cookie", c);
  }
  return res;
}

async function patchBodyJsonString(request: NextRequest): Promise<
  { ok: true; body: string } | { ok: false; status: number; message: string }
> {
  const ct = (request.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("application/json")) {
    try {
      const data: unknown = await request.json();
      if (data === null || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, status: 400, message: "جسم الطلب يجب أن يكون كائن JSON." };
      }
      return { ok: true, body: JSON.stringify(data) };
    } catch {
      return { ok: false, status: 400, message: "تعذر قراءة JSON من الطلب." };
    }
  }
  const text = await request.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, status: 400, message: "الطلب فارغ: أرسل JSON في جسم PATCH." };
  }
  try {
    const data: unknown = JSON.parse(trimmed);
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, status: 400, message: "JSON يجب أن يكون كائنًا." };
    }
    return { ok: true, body: JSON.stringify(data) };
  } catch {
    return { ok: false, status: 400, message: "الجسم ليس JSON صالحًا." };
  }
}

const TARGET_PATH = "/api/company/admin/report-defaults" as const;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const target = `${mvBackendOriginForProxy()}${TARGET_PATH}${url.search}`;
  const headers = buildForwardHeaders(request);
  try {
    const upstream = await fetch(target, { method: "GET", headers, redirect: "manual" });
    return forwardUpstreamResponse(upstream, "company-report-defaults-admin");
  } catch (err) {
    console.error("[api/company/admin/report-defaults GET] upstream failed", err);
    return NextResponse.json(
      { error: "upstream_unreachable", message: "تعذر الاتصال بالخادم." },
      { status: 502 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const url = new URL(request.url);
  const target = `${mvBackendOriginForProxy()}${TARGET_PATH}${url.search}`;
  const headers = buildForwardHeaders(request);
  const prepared = await patchBodyJsonString(request);
  if (!prepared.ok) {
    return NextResponse.json(
      { error: "invalid_payload", message: prepared.message },
      { status: prepared.status },
    );
  }
  headers.set("content-type", "application/json; charset=utf-8");
  try {
    const upstream = await fetch(target, {
      method: "PATCH",
      headers,
      body: prepared.body,
      redirect: "manual",
    });
    return forwardUpstreamResponse(upstream, "company-report-defaults-admin");
  } catch (err) {
    console.error("[api/company/admin/report-defaults PATCH] upstream failed", err);
    return NextResponse.json(
      { error: "upstream_unreachable", message: "تعذر الاتصال بالخادم." },
      { status: 502 },
    );
  }
}
