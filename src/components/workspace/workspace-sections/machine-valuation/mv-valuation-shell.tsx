"use client";

import MvValuationAccountingWorkspace from "./mv-valuation-accounting-workspace";
import type { MvValuationPhaseSlug } from "./mv-valuation-workflow-model";

interface MvValuationShellProps {
  projectId: string;
  phaseSlug: MvValuationPhaseSlug;
}

export default function MvValuationShell({ projectId }: MvValuationShellProps) {
  return <MvValuationAccountingWorkspace projectId={projectId} />;
}
