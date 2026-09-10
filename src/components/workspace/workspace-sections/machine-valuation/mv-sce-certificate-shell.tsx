"use client";

import dynamic from "next/dynamic";
import { MvPageLoading } from "./mv-ui";

const MvClientFilesWorkspace = dynamic(() => import("./mv-client-files-workspace"), {
  loading: () => <MvPageLoading label="جارٍ فتح شهادة نظام الهيئة…" />,
});

export default function MvSceCertificateShell({ projectId }: { projectId: string }) {
  return <MvClientFilesWorkspace projectId={projectId} kind="certificate" />;
}
