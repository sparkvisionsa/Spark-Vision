import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

/**
 * يمرّر `/api/company/users` إلى Nest مع جسم JSON صالح وترويسات الجلسة.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORWARD_HEADERS = [
  "cookie",
  "authorization",
  "content-type",
  "x-csrf-token",
  "x-request-id",
] as const;

function collectSetCookieHeaders(upstream: Response): string[] {
  const anyHeaders = upstream.headers as unknown as {
    getSetCookie?: () => string[];
  };
  const fromMethod = anyHeaders.getSetCookie?.();
  if (fromMethod && fromMethod.length > 0) return fromMethod;
  const single = upstream.headers.get("set-cookie");
  return single ? [single] : [];
}

/** يبني جسم POST كسلسلة JSON موحّدة؛ يمنع إرسال Nest طلبًا بلا كائن JSON. */
async function postBodyJsonString(request: NextRequest): Promise<
  | { ok: true; body: string }
  | { ok: false; status: number; message: string }
> {
  const ct = (request.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("application/json")) {
    try {
      const data: unknown = await request.json();
      if (data === null || typeof data !== "object" || Array.isArray(data)) {
        return {
          ok: false,
          status: 400,
          message: "جسم الطلب يجب أن يكون كائن JSON (username, password, role, …).",
        };
      }
      return { ok: true, body: JSON.stringify(data) };
    } catch {
      return { ok: false, status: 400, message: "تعذر قراءة JSON من الطلب." };
    }
  }

  const text = await request.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, status: 400, message: "الطلب فارغ: أرسل JSON في جسم POST." };
  }
  try {
    const data: unknown = JSON.parse(trimmed);
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, status: 400, message: "JSON يجب أن يكون كائنًا وليس مصفوفة أو null." };
    }
    return { ok: true, body: JSON.stringify(data) };
  } catch {
    return { ok: false, status: 400, message: "الجسم ليس JSON صالحًا." };
  }
}

async function proxyToNest(request: NextRequest) {
  const url = new URL(request.url);
  const target = `${mvBackendOriginForProxy()}/api/company/users${url.search}`;

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
    const prepared = await postBodyJsonString(request);
    if (!prepared.ok) {
      return NextResponse.json(
        { error: "invalid_payload", message: prepared.message },
        { status: prepared.status },
      );
    }
    init.body = prepared.body;
    headers.set("content-type", "application/json; charset=utf-8");
  }

  try {
    const upstream = await fetch(target, init);
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
    res.headers.set("x-spark-proxy", "company-users");
    for (const c of collectSetCookieHeaders(upstream)) {
      res.headers.append("set-cookie", c);
    }
    return res;
  } catch (err) {
    console.error("[api/company/users proxy] upstream failed", err);
    return NextResponse.json(
      { error: "upstream_unreachable", message: "تعذر الاتصال بالخادم." },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyToNest(request);
}

export async function POST(request: NextRequest) {
  return proxyToNest(request);
}
