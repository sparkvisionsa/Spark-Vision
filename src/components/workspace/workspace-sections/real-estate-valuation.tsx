"use client";
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { ValuationStatusStrip } from "@/components/ui/realEstateStatusCards";
import { RealEstateSearch } from "@/components/ui/real-estate-search";
import {
  NewTransactionButton,
  NewTransactionLawyerButton,
} from "@/components/ui/new-transaction-modal";
import { NewTransactionPage } from "@/components/ui/new-transaction-page";
import { TransactionEvaluationPage } from "@/components/ui/TransactionValuationPage";
import { ValuationTable } from "@/components/ui/valuation-table";
import { LanguageContext } from "@/components/layout-provider";
import type { RealEstateSearchValues } from "@/components/ui/real-estate-search";

import type { ApiTransaction } from "@/components/ui/valuation-table";
import {
  AttachmentsModal,
  ImagesModal,
  NotesModal,
  AR_COPY,
  EN_COPY,
  EditTransactionModal,
} from "@/components/ui/valuation-table";
import { toApiUrl } from "@/lib/api-url";

type View =
  | { name: "list" }
  | { name: "new"; isLawyer?: boolean }
  | { name: "evaluation"; transactionId: string };

type ModalTarget = {
  transactionId: string;
  requester: string;
};

// ─── Derive status counts ─────────────────────────────────────────────────────

function deriveStatusCounts(
  transactions: Array<{ status?: string; evalData?: { status?: string } }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tx of transactions) {
    const status = tx.evalData?.status ?? tx.status ?? "new";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

// ─── STATUS_MAP — maps status key → search filter value string ────────────────
// This is the reverse of the STATUS_MAP inside valuation-table's applyFilters.
const STATUS_KEY_TO_FILTER: Record<string, string> = {
  new: "1",
  inspection: "2",
  review: "3",
  audit: "4",
  approved: "5",
  sent: "6",
  cancelled: "7",
  pending: "8",
};

// ─── Main section ─────────────────────────────────────────────────────────────

const RealEstateValuationSection = () => {
  const [view, setView] = useState<View>({ name: "list" });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";

  const [searchValues, setSearchValues] =
    useState<RealEstateSearchValues | null>(null);

  // Active status card filter (null = show all)
  const [activeStatusCard, setActiveStatusCard] = useState<string | null>(null);

  const handleSearch = useCallback((values: RealEstateSearchValues) => {
    setSearchValues(values);
    // If the user explicitly searches, clear the card filter so they're not
    // fighting each other. The card filter is re-applied on top of search values
    // via mergedFilterValues below.
    setActiveStatusCard(null);
  }, []);

  // Merge card-based status filter on top of the search form values.
  // The card takes precedence over whatever status the search form has selected.
  const mergedFilterValues: RealEstateSearchValues | null =
    activeStatusCard != null
      ? {
          ...(searchValues ?? {
            query: "",
            dateType: "created",
            dateFrom: "",
            dateTo: "",
            status: "-1",
            region: "-1",
            city: "",
            neighborhood: "",
            propertyCategory: "-1",
            propertyType: "",
            valuationPurpose: "-1",
            valuationBasis: "-1",
            ownershipType: "-1",
            valuationHypothesis: "-1",
            isDraft: "-1",
            branch: "-1",
          }),
          status: STATUS_KEY_TO_FILTER[activeStatusCard] ?? "-1",
        }
      : searchValues;

  const handleStatusCardClick = useCallback((status: string | null) => {
    setActiveStatusCard(status);
  }, []);

  const goNewLawyer = useCallback(
    () => setView({ name: "new", isLawyer: true }),
    [],
  );

  // ── Modal state ────────────────────────────────────────────────────────────
  const [attachmentsTarget, setAttachmentsTarget] =
    useState<ModalTarget | null>(null);
  const [notesTarget, setNotesTarget] = useState<ModalTarget | null>(null);
  const [imagesTarget, setImagesTarget] = useState<ModalTarget | null>(null);
  const [editTarget, setEditTarget] = useState<{
    transactionId: string;
    requester: string;
    onSaved?: (tx: ApiTransaction) => void;
  } | null>(null);

  const [attachmentCounts, setAttachmentCounts] = useState<
    Record<string, number>
  >({});
  const [imageCounts, setImageCounts] = useState<Record<string, number>>({});

  // ─── Fetch / refresh transactions ─────────────────────────────────────────

  const fetchTransactions = useCallback(() => {
    fetch(toApiUrl("/api/transactions"), {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const arr = Array.isArray(data)
          ? data
          : (data.data ?? data.transactions ?? data.items ?? []);
        setStatusCounts(deriveStatusCounts(arr));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTransactions();
    const id = setInterval(fetchTransactions, 30_000);
    return () => clearInterval(id);
  }, [fetchTransactions]);

  // ─── Navigation helpers ────────────────────────────────────────────────────

  const goList = useCallback(() => setView({ name: "list" }), []);
  const goNew = useCallback(() => setView({ name: "new" }), []);
  const goEvaluation = useCallback((transactionId: string) => {
    setView({ name: "evaluation", transactionId });
  }, []);

  // ─── Modal openers ─────────────────────────────────────────────────────────

  const openAttachments = useCallback(
    (transactionId: string, requester: string) =>
      setAttachmentsTarget({ transactionId, requester }),
    [],
  );
  const openNotes = useCallback(
    (transactionId: string, requester: string) =>
      setNotesTarget({ transactionId, requester }),
    [],
  );
  const openImages = useCallback(
    (transactionId: string, requester: string) =>
      setImagesTarget({ transactionId, requester }),
    [],
  );
  const openEdit = useCallback(
    (
      transactionId: string,
      requester: string,
      onSaved?: (tx: ApiTransaction) => void,
    ) => {
      setEditTarget({ transactionId, requester, onSaved });
    },
    [],
  );

  const t = language === "ar" ? AR_COPY : EN_COPY;
  const isRtl = language === "ar";

  // ─── Render ────────────────────────────────────────────────────────────────

  if (view.name === "new") {
    return (
      <NewTransactionPage
        onBack={goList}
        isLawyer={view.isLawyer ?? false}
        onSubmit={(created) => {
          fetchTransactions();
          goEvaluation((created._id ?? created.id) as string);
        }}
      />
    );
  }

  if (view.name === "evaluation") {
    return (
      <>
        <TransactionEvaluationPage
          transactionId={view.transactionId}
          onBack={goList}
          onOpenAttachments={openAttachments}
          onOpenNotes={openNotes}
          onOpenImages={openImages}
          onOpenEdit={openEdit}
          onStatusSaved={fetchTransactions}
        />

        {attachmentsTarget && (
          <AttachmentsModal
            transactionId={attachmentsTarget.transactionId}
            requester={attachmentsTarget.requester}
            onClose={() => setAttachmentsTarget(null)}
            onCountChange={(count) =>
              setAttachmentCounts((p) => ({
                ...p,
                [attachmentsTarget.transactionId]: count,
              }))
            }
            t={t}
            isRtl={isRtl}
          />
        )}
        {notesTarget && (
          <NotesModal
            transactionId={notesTarget.transactionId}
            requester={notesTarget.requester}
            onClose={() => setNotesTarget(null)}
            t={t}
            isRtl={isRtl}
          />
        )}
        {imagesTarget && (
          <ImagesModal
            transactionId={imagesTarget.transactionId}
            requester={imagesTarget.requester}
            onClose={() => setImagesTarget(null)}
            onCountChange={(count) =>
              setImageCounts((p) => ({
                ...p,
                [imagesTarget.transactionId]: count,
              }))
            }
            t={t}
            isRtl={isRtl}
          />
        )}
        {editTarget && (
          <EditTransactionModal
            transactionId={editTarget.transactionId}
            requester={editTarget.requester}
            onClose={() => setEditTarget(null)}
            onSaved={(updated) => {
              if (editTarget.onSaved) editTarget.onSaved(updated);
              fetchTransactions();
              setEditTarget(null);
            }}
            t={t}
            isRtl={isRtl}
          />
        )}
      </>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm sm:p-6">
        <RealEstateSearch onSearch={handleSearch} className="mb-6" />
        <ValuationStatusStrip
          counts={statusCounts}
          activeStatus={activeStatusCard}
          onStatusClick={handleStatusCardClick}
          className="mb-4"
        />
        <div className="mb-6 flex flex-wrap gap-3">
          <NewTransactionButton onClick={goNew} />
          <NewTransactionLawyerButton onClick={goNewLawyer} />
        </div>
      </div>

      <ValuationTable
        className="mt-4"
        onOpenTransaction={goEvaluation}
        filterValues={mergedFilterValues}
        onOpenAttachments={openAttachments}
        onOpenNotes={openNotes}
        onOpenImages={openImages}
        onOpenEdit={openEdit}
        onTransactionMutated={fetchTransactions}
      />

      {attachmentsTarget && (
        <AttachmentsModal
          transactionId={attachmentsTarget.transactionId}
          requester={attachmentsTarget.requester}
          onClose={() => setAttachmentsTarget(null)}
          onCountChange={(count) =>
            setAttachmentCounts((p) => ({
              ...p,
              [attachmentsTarget.transactionId]: count,
            }))
          }
          t={t}
          isRtl={isRtl}
        />
      )}
      {notesTarget && (
        <NotesModal
          transactionId={notesTarget.transactionId}
          requester={notesTarget.requester}
          onClose={() => setNotesTarget(null)}
          t={t}
          isRtl={isRtl}
        />
      )}
      {imagesTarget && (
        <ImagesModal
          transactionId={imagesTarget.transactionId}
          requester={imagesTarget.requester}
          onClose={() => setImagesTarget(null)}
          onCountChange={(count) =>
            setImageCounts((p) => ({
              ...p,
              [imagesTarget.transactionId]: count,
            }))
          }
          t={t}
          isRtl={isRtl}
        />
      )}
      {editTarget && (
        <EditTransactionModal
          transactionId={editTarget.transactionId}
          requester={editTarget.requester}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            if (editTarget.onSaved) editTarget.onSaved(updated);
            fetchTransactions();
            setEditTarget(null);
          }}
          t={t}
          isRtl={isRtl}
        />
      )}
    </>
  );
};

export default RealEstateValuationSection;
