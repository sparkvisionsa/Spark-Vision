"use client";

import CompanyAdminDashboard from "@/components/company-admin-dashboard";
import MachineValuationShell from "@/components/machine-valuation-shell";

export default function MachineValuationCompanyPage() {
  return (
    <MachineValuationShell>
      <CompanyAdminDashboard variant="embedded" />
    </MachineValuationShell>
  );
}
