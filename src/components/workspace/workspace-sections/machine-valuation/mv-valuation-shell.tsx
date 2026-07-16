"use client";

import dynamic from "next/dynamic";
import { MvPageLoading } from "./mv-ui";
import { useMvI18n } from "./mv-i18n";

function MvValuationLoading() {
  const { t } = useMvI18n();
  return <MvPageLoading label={t("valuation.breadcrumb")} />;
}

const MvValuationAccountingWorkspace = dynamic(
  () => import("./mv-valuation-accounting-workspace"),
  { loading: () => <MvValuationLoading /> },
);

interface MvValuationShellProps {
  projectId: string;
}

export default function MvValuationShell({ projectId }: MvValuationShellProps) {
  return <MvValuationAccountingWorkspace projectId={projectId} />;
}
