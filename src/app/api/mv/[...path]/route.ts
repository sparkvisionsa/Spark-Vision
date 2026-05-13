import type { NextRequest } from "next/server";
import { proxyMvPathToNest } from "@/lib/mv-nest-proxy";

/**
 * يمرّر طلبات `/api/mv/*` إلى SparkVision-Backend مع ترويسة `Cookie` وغيرها.
 * يضمن أن جلسة المستخدم تصل إلى Nest (بعض إعدادات الـ rewrite لا تعيد توجيه الكوكيز بشكل موثوق).
 *
 * ملاحظة: تنزيل ملفات المعاين تحت ‎`projects/[pid]/inspectorFiles/.../download`‎ له ‎route.ts‎ صريح
 * لأن وجود مجلد ‎`projects/[pid]/`‎ قد يمنع الـ catch-all من مطابقة بعض العناوين.
 */
export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteCtx) {
  const { path } = await context.params;
  return proxyMvPathToNest(request, path ?? []);
}

export async function HEAD(request: NextRequest, context: RouteCtx) {
  const { path } = await context.params;
  return proxyMvPathToNest(request, path ?? []);
}

export async function POST(request: NextRequest, context: RouteCtx) {
  const { path } = await context.params;
  return proxyMvPathToNest(request, path ?? []);
}

export async function PUT(request: NextRequest, context: RouteCtx) {
  const { path } = await context.params;
  return proxyMvPathToNest(request, path ?? []);
}

export async function PATCH(request: NextRequest, context: RouteCtx) {
  const { path } = await context.params;
  return proxyMvPathToNest(request, path ?? []);
}

export async function DELETE(request: NextRequest, context: RouteCtx) {
  const { path } = await context.params;
  return proxyMvPathToNest(request, path ?? []);
}
