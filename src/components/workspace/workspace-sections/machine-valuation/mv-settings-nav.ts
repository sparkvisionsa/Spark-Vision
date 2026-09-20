export type MvSettingsSection = "general" | "report" | "serial-numbering";

export const MV_SETTINGS_SECTIONS: Array<{
  key: MvSettingsSection;
  href: string;
  labelKey: "settingsHub.general" | "settingsHub.report" | "settingsHub.serialNumbering";
  defaultTab: string;
}> = [
  {
    key: "general",
    href: "/machine-valuation/settings/general",
    labelKey: "settingsHub.general",
    defaultTab: "info",
  },
  {
    key: "report",
    href: "/machine-valuation/settings/report",
    labelKey: "settingsHub.report",
    defaultTab: "word-template",
  },
  {
    key: "serial-numbering",
    href: "/machine-valuation/settings/serial-numbering",
    labelKey: "settingsHub.serialNumbering",
    defaultTab: "reference",
  },
];

export const MV_SETTINGS_TABS: Record<
  MvSettingsSection,
  Array<{
    key: string;
    href: string;
    labelKey:
      | "settingsHub.tabs.companyInfo"
      | "settingsHub.tabs.companyUsers"
      | "settingsHub.tabs.signatories"
      | "settingsHub.tabs.assetDescriptions"
      | "settingsHub.tabs.wordTemplates"
      | "settingsHub.tabs.pptxTemplates"
      | "settingsHub.tabs.letterhead"
      | "settingsHub.tabs.reportDataModels"
      | "settingsHub.referenceNumber";
  }>
> = {
  general: [
    { key: "info", href: "/machine-valuation/settings/general/info", labelKey: "settingsHub.tabs.companyInfo" },
    { key: "users", href: "/machine-valuation/settings/general/users", labelKey: "settingsHub.tabs.companyUsers" },
    {
      key: "signatories",
      href: "/machine-valuation/settings/general/signatories",
      labelKey: "settingsHub.tabs.signatories",
    },
    {
      key: "asset-descriptions",
      href: "/machine-valuation/settings/general/asset-descriptions",
      labelKey: "settingsHub.tabs.assetDescriptions",
    },
  ],
  report: [
    {
      key: "word-template",
      href: "/machine-valuation/settings/report/word-template",
      labelKey: "settingsHub.tabs.wordTemplates",
    },
    {
      key: "pptx-template",
      href: "/machine-valuation/settings/report/pptx-template",
      labelKey: "settingsHub.tabs.pptxTemplates",
    },
    {
      key: "letterhead",
      href: "/machine-valuation/settings/report/letterhead",
      labelKey: "settingsHub.tabs.letterhead",
    },
    {
      key: "report-data-models",
      href: "/machine-valuation/settings/report/report-data-models",
      labelKey: "settingsHub.tabs.reportDataModels",
    },
  ],
  "serial-numbering": [
    {
      key: "reference",
      href: "/machine-valuation/settings/serial-numbering/reference",
      labelKey: "settingsHub.referenceNumber",
    },
  ],
};

export function resolveSettingsSection(raw?: string | null): MvSettingsSection {
  if (raw === "report" || raw === "report-settings") return "report";
  if (raw === "serial-numbering" || raw === "serial") return "serial-numbering";
  return "general";
}

export function resolveSettingsTab(section: MvSettingsSection, raw?: string | null): string {
  const tabs = MV_SETTINGS_TABS[section];
  const match = tabs.find((tab) => tab.key === raw);
  return match?.key ?? tabs[0]!.key;
}
