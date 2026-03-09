"use client";
import { useState } from "react";
import { ValuationStatusStrip } from "@/components/ui/realEstateStatusCards";
import {
  RealEstateSearch,
  type RealEstateSearchValues,
} from "@/components/ui/real-estate-search";
import {
  NewTransactionButton,
  NewTransactionModal,
} from "@/components/ui/new-transaction-modal";

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
    <div className="min-h-screen bg-[#f7f4ee] text-slate-900">
      <main className="container py-8">
        <RealEstateSearch
          onSearch={(v) => console.log("search:", v)}
          className="mb-6"
        />
        <ValuationStatusStrip counts={DUMMY_COUNTS} className="mb-4" />
        <NewTransactionButton
          onClick={() => setModalOpen(true)}
          className="mb-6"
        />
      </main>

      <NewTransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(values) => console.log("new transaction:", values)}
      />
    </div>
  );
};

export default RealEstateValuationPage;
