import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

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

async function jsonBodyString(request: NextRequest): Promise<
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
          message: "جسم الطلب يجب أن يكون كائن JSON.",
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
    return { ok: false, status: 400, message: "أرسل JSON في جسم الطلب." };
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

function resolveUserIdFromRequest(
  request: NextRequest,
  params: { userId?: string },
): string | null {
  const fromParam = params?.userId?.trim();
  if (fromParam) return fromParam;

  const pathname = request.nextUrl.pathname.replace(/\/+$/, "");
  const prefix = "/api/company/users/";
  if (pathname.startsWith(prefix)) {
    const rest = pathname.slice(prefix.length);
    if (rest && !rest.includes("/")) return decodeURIComponent(rest);
  }
  return null;
}

async function proxyToNest(
  request: NextRequest,
  userId: string,
  method: "PATCH" | "DELETE",
) {
  const id = userId.trim();
  if (!id) {
    return NextResponse.json(
      { error: "invalid_path", message: "معرّف المستخدم مفقود في المسار." },
      { status: 400 },
    );
  }
  const encoded = encodeURIComponent(id);
  const target = `${mvBackendOriginForProxy()}/api/company/users/${encoded}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init: RequestInit = {
    method,
    headers,
    redirect: "manual",
  };

  if (method === "PATCH") {
    const prepared = await jsonBodyString(request);
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
    res.headers.set("x-spark-proxy", "company-users-member");
    for (const c of collectSetCookieHeaders(upstream)) {
      res.headers.append("set-cookie", c);
    }
    return res;
  } catch (err) {
    console.error("[api/company/users/[userId] proxy] upstream failed", err);
    return NextResponse.json(
      { error: "upstream_unreachable", message: "تعذر الاتصال بالخادم." },
      { status: 502 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const fromParams = await context.params;
  const userId = resolveUserIdFromRequest(request, fromParams) ?? "";
  return proxyToNest(request, userId, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const fromParams = await context.params;
  const userId = resolveUserIdFromRequest(request, fromParams) ?? "";
  return proxyToNest(request, userId, "DELETE");
}
