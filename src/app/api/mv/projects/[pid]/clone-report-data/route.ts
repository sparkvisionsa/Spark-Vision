import type { NextRequest } from "next/server";
import { proxyMvPathToNest } from "@/lib/mv-nest-proxy";

/**
 * مسار صريح لاستنساخ بيانات التقرير فقط إلى المشروع الحالي.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pid: string }> },
) {
  const { pid } = await context.params;
  return proxyMvPathToNest(request, ["projects", pid, "clone-report-data"]);
}
