import type { NextRequest } from "next/server";
import { proxyMvPathToNest } from "@/lib/mv-nest-proxy";

/**
 * مسار صريح — وجود مجلد ‎projects/[pid]/‎ قد يمنع الـ catch-all من مطابقة بعض العناوين.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pid: string }> },
) {
  const { pid } = await context.params;
  return proxyMvPathToNest(request, ["projects", pid, "duplicate"]);
}
