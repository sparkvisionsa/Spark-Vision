import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Agent, fetch as undiciFetch } from "undici";
import { mvBackendOriginForProxy } from "@/lib/mv-backend-origin";

/**
 * ‎fetch‎ المدمج في Node (عبر undici داخلياً) له مهلة افتراضية لرؤوس/جسم الاستجابة تُقارب
 * 300 ثانية (‎UND_ERR_HEADERS_TIMEOUT‎) — عمليات مثل دمج Word لمشروع بمئات الصور أو تنزيل
 * أرشيف صور ضخم قد تستغرق أطول من ذلك على خادم مُحمَّل، فيُفشلها الوكيل بـ502 رغم أن Nest
 * لا يزال يعالجها فعلياً. نستخدم هنا ‎undici‎ صريحاً (بدل الكائن العام) مع ‎Agent‎ بمهلة
 * أطول بكثير، مخصّص لهذا الوكيل وحده.
 */
const MV_PROXY_TIMEOUT_MS = 15 * 60_000;
const mvProxyAgent = new Agent({
  headersTimeout: MV_PROXY_TIMEOUT_MS,
  bodyTimeout: MV_PROXY_TIMEOUT_MS,
  connectTimeout: 30_000,
});

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
  const init: RequestInit & { duplex?: "half"; dispatcher?: Agent } = {
    method,
    headers,
    redirect: "manual",
    dispatcher: mvProxyAgent,
  };

  if (method !== "GET" && method !== "HEAD") {
    const body = request.body;
    if (body) {
      init.body = body;
      init.duplex = "half";
    }
  }

  try {
    const upstream = await undiciFetch(target, init as never);
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
      "x-asset-folder-count",
      "x-asset-image-count",
      "x-word-merge-stats",
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
    // نوع ‎ReadableStream‎ في undici (‎stream/web‎) وDOM lib متطابقان بنيوياً وقت التشغيل
    // لكن من مصدرين مختلفين في تعريفات TypeScript — تحويل صريح آمن هنا.
    return new NextResponse(upstream.body as unknown as BodyInit | null, {
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
