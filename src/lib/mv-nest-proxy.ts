import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

const FORWARD_HEADERS = [
  "cookie",
  "authorization",
  "content-type",
  "range",
  "x-csrf-token",
  "x-request-id",
] as const;

/**
 * يمرّر طلبًا إلى Nest على ‎`/api/mv/${pathSegments.join("/")}`‎ مع نفس ترويسات الوكيل.
 * يُستعمل من ‎`[...path]‎` ومن مسارات ‎`projects/[pid]/inspectorFiles/...`‎ الصريحة.
 */
export async function proxyMvPathToNest(request: NextRequest, pathSegments: string[]) {
  const joined = pathSegments.map((s) => encodeURIComponent(s)).join("/");
  const url = new URL(request.url);
  const target = `${mvBackendOriginForProxy()}/api/mv/${joined}${url.search}`;

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
    const passthrough = [
      "content-type",
      "content-disposition",
      "cache-control",
      "content-length",
      "content-range",
      "accept-ranges",
      "location",
      "etag",
      "x-accel-buffering",
    ] as const;
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
    console.error("[mv-nest-proxy] upstream failed", err);
    return NextResponse.json(
      {
        error: "upstream_unreachable",
        message:
          "تعذر الاتصال بخادم التقييم (Nest). محلياً شغّل الخلفية على المنفذ المتوقع؛ على السحابة عيّن MV_INTERNAL_API_ORIGIN أو BACKEND_URL لعنوان Nest (ليس 127.0.0.1 إن كان في حاوية أخرى).",
      },
      { status: 502 },
    );
  }
}
