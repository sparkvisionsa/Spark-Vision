"use client";
import { useState } from "react";
import ValueTechShell from "@/components/value-tech-shell";
import { ValuationStatusStrip } from "@/components/ui/realEstateStatusCards";
import {
  RealEstateSearch,
  type RealEstateSearchValues,
} from "@/components/ui/real-estate-search";
import {
  NewTransactionButton,
  NewTransactionModal,
} from "@/components/ui/new-transaction-modal";
import { ValuationTable } from "@/components/ui/valuation-table";

const DUMMY_COUNTS = {
  new: 12,
  inspection: 5,
  review: 8,
  audit: 3,
  approved: 21,
  sent: 17,
  cancelled: 4,
  pending: 9,
};

const RealEstateValuationPage = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <ValueTechShell>
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm sm:p-6">
        <RealEstateSearch
          onSearch={(v) => console.log("search:", v)}
          className="mb-6"
        />
        <ValuationStatusStrip counts={DUMMY_COUNTS} className="mb-4" />
        <NewTransactionButton
          onClick={() => setModalOpen(true)}
          className="mb-6"
        />
      </div>

      <ValuationTable className="mt-4" />

      <NewTransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(values) => console.log("new transaction:", values)}
      />
    </ValueTechShell>
  );
};

export default RealEstateValuationPage;
