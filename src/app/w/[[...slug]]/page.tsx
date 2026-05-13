import { WorkspaceView } from "@/components/workspace/workspace-view";

/** Skip static prerender for this catch-all route (avoids build-time failures on heavy client bundles). */
export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <WorkspaceView slug={slug} />;
}
