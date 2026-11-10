// app/default-values/page.tsx
import { WorkspaceView } from "@/components/workspace/workspace-view";

export const dynamic = "force-dynamic";

export default function DefaultValuesPage() {
  return <WorkspaceView slug={["default-values"]} />;
}
