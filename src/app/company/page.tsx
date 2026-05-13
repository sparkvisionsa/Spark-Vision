"use client";

import Header from "@/components/header";
import Footer from "@/components/footer";
import CompanyAdminDashboard from "@/components/company-admin-dashboard";

export default function CompanyDashboardPage() {
  return (
    <div className="flex min-h-screen flex-col text-slate-900" dir="rtl">
      <Header />
      <CompanyAdminDashboard variant="standalone" />
      <Footer />
    </div>
  );
}
