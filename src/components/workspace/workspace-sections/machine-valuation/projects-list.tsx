"use client";

import MvProjectsDashboard from "./mv-projects-dashboard";
import { useMvI18n } from "./mv-i18n";

export default function ProjectsList() {
  const { dir } = useMvI18n();
  return (
    <div dir={dir}>
      <MvProjectsDashboard />
    </div>
  );
}
