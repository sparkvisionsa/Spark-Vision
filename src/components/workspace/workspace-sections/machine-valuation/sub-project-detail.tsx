"use client";

import MvDriveExplorer from "./mv-drive-explorer";

interface SubProjectDetailProps {
  projectId: string;
  subProjectId: string;
}

export default function SubProjectDetail({
  projectId,
  subProjectId,
}: SubProjectDetailProps) {
  return <MvDriveExplorer projectId={projectId} currentSubProjectId={subProjectId} />;
}
