"use client";

import dynamic from "next/dynamic";
import { MvPageLoading } from "./mv-ui";
import { useMvI18n } from "./mv-i18n";

function MvClientFilesLoading() {
  const { t } = useMvI18n();
  return <MvPageLoading label={t("clientFiles.loading")} />;
}

const MvClientFilesWorkspace = dynamic(() => import("./mv-client-files-workspace"), {
  loading: () => <MvClientFilesLoading />,
});

interface MvClientFilesShellProps {
  projectId: string;
}

export default function MvClientFilesShell({ projectId }: MvClientFilesShellProps) {
  return <MvClientFilesWorkspace projectId={projectId} />;
}
