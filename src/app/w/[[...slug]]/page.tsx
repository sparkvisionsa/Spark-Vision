import { WorkspaceView } from "@/components/workspace/workspace-view";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <WorkspaceView slug={slug} />;
}
