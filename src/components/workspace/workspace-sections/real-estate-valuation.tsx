"use client";
import { useState } from "react";
import { ValuationStatusStrip } from "@/components/ui/realEstateStatusCards";
import { RealEstateSearch } from "@/components/ui/real-estate-search";
import { NewTransactionButton } from "@/components/ui/new-transaction-modal";
import { NewTransactionPage } from "@/components/ui/new-transaction-page";
import { TransactionEvaluationPage } from "@/components/ui/TransactionValuationPage"; // 👈 import this
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

type View =
  | { name: "list" }
  | { name: "new" }
  | { name: "evaluation"; transactionId: string };

const RealEstateValuationSection = () => {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "new") {
    return (
      <NewTransactionPage
        onBack={() => setView({ name: "list" })}
        onSubmit={(created) =>
          setView({
            name: "evaluation",
            transactionId: created._id ?? created.id,
          })
        }
      />
    );
  }

  if (view.name === "evaluation") {
    return (
      <TransactionEvaluationPage
        transactionId={view.transactionId}
        onBack={() => setView({ name: "list" })}
      />
    );
  }

  return (
    <>
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm sm:p-6">
        <RealEstateSearch
          onSearch={(v) => console.log("search:", v)}
          className="mb-6"
        />
        <ValuationStatusStrip counts={DUMMY_COUNTS} className="mb-4" />
        <NewTransactionButton
          onClick={() => setView({ name: "new" })}
          className="mb-6"
        />
      </div>
      <ValuationTable
        className="mt-4"
        onOpenTransaction={(id) =>
          setView({ name: "evaluation", transactionId: id })
        }
      />
    </>
  );
};

export default RealEstateValuationSection;
