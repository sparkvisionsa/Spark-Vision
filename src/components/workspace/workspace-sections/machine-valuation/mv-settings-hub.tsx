"use client";

import Link from "@/components/prefetch-link";
import { cn } from "@/lib/utils";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import CompanyAdminDashboard from "@/components/company-admin-dashboard";
import { useMvI18n } from "./mv-i18n";
import MvSerialNumberingSettings from "./mv-serial-numbering-settings";
import {
  MV_SETTINGS_SECTIONS,
  MV_SETTINGS_TABS,
  type MvSettingsSection,
} from "./mv-settings-nav";

export type { MvSettingsSection };

export default function MvSettingsHub({
  section,
  tab,
}: {
  section: MvSettingsSection;
  tab: string;
}) {
  const { t, dir } = useMvI18n();
  const { user } = useAuthTracking();
  const isCompanyAdmin = user?.role === "company_admin";
  const items =
    !isCompanyAdmin && section !== "general"
      ? []
      : MV_SETTINGS_TABS[section];
  const sectionLabel = MV_SETTINGS_SECTIONS.find((item) => item.key === section)?.labelKey;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row" dir={dir}>
      {items.length > 0 ? (
        <aside className="w-full shrink-0 rounded-xl border border-slate-200/80 bg-white p-1.5 lg:w-52">
          {sectionLabel ? (
            <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold text-slate-400">{t(sectionLabel)}</p>
          ) : null}
          <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {items.map((item) => {
              const active = item.key === tab;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "flex min-w-max items-center rounded-xl px-3 py-2.5 text-[13px] font-bold transition",
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
        </aside>
      ) : null}

      <div
        className={cn(
          "min-h-0 min-w-0 flex-1",
          section === "serial-numbering" ? "flex flex-col overflow-hidden" : "overflow-y-auto",
        )}
      >
        {section === "general" ? (
          <CompanyAdminDashboard
            variant="embedded"
            productId="machine-valuation"
            tab={tab}
            hideTabList
          />
        ) : null}
        {section === "report" ? (
          <CompanyAdminDashboard
            variant="embedded"
            mode="report-defaults"
            productId="machine-valuation"
            tab={tab}
            hideTabList
          />
        ) : null}
        {section === "serial-numbering" ? <MvSerialNumberingSettings /> : null}
      </div>
    </div>
  );
}
