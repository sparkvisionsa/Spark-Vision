"use client";
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { ValuationStatusStrip } from "@/components/ui/realEstateStatusCards";
import { RealEstateSearch } from "@/components/ui/real-estate-search";
import { NewTransactionButton } from "@/components/ui/new-transaction-modal";
import { NewTransactionPage } from "@/components/ui/new-transaction-page";
import { TransactionEvaluationPage } from "@/components/ui/TransactionValuationPage";
import { ValuationTable } from "@/components/ui/valuation-table";
import { LanguageContext } from "@/components/layout-provider";
import type { ApiTransaction } from "@/components/ui/valuation-table";
import {
  AttachmentsModal,
  ImagesModal,
  NotesModal,
  AR_COPY,
  EN_COPY,
  EditTransactionModal,
} from "@/components/ui/valuation-table"; // see note below *
import { toApiUrl } from "@/lib/api-url";

// * If the modals aren't exported from valuation-table yet, see the
//   valuation-table patch further below — we export them there.

type View =
  | { name: "list" }
  | { name: "new" }
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

// ─── Main section ─────────────────────────────────────────────────────────────

const RealEstateValuationSection = () => {
  const [view, setView] = useState<View>({ name: "list" });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";

  // ── Modal state (shared between table rows and evaluation page) ────────────
  const [attachmentsTarget, setAttachmentsTarget] =
    useState<ModalTarget | null>(null);
  const [notesTarget, setNotesTarget] = useState<ModalTarget | null>(null);
  const [imagesTarget, setImagesTarget] = useState<ModalTarget | null>(null);
  const [editTarget, setEditTarget] = useState<{
    transactionId: string;
    requester: string;
    onSaved?: (tx: ApiTransaction) => void;
  } | null>(null);

  // ── Row counts (kept in sync when modals mutate attachment/image counts) ───
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
      .catch(() => {
        // silently ignore — strip shows zeros
      });
  }, []);

  // Initial fetch + 30-second polling for real-time updates
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

  // ─── Modal openers (passed down to both table and evaluation page) ─────────

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

  // ─── Shared copy (modals need a language object) ───────────────────────────
  // We expose language so the lifted modals can use the right copy.
  // The LanguageContext is consumed inside ValuationTable already; here we
  // just default to Arabic (same as the table default).

  const t = language === "ar" ? AR_COPY : EN_COPY;
  const isRtl = language === "ar";

  // ─── Render ────────────────────────────────────────────────────────────────

  if (view.name === "new") {
    return (
      <NewTransactionPage
        onBack={goList}
        onSubmit={(created: { _id?: string; id?: string }) => {
          fetchTransactions(); // refresh counts after creation
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
          // Pass modal openers so the action buttons inside the page work
          onOpenAttachments={openAttachments}
          onOpenNotes={openNotes}
          onOpenImages={openImages}
          onOpenEdit={openEdit}
          // Notify on status save so the strip refreshes
          onStatusSaved={fetchTransactions}
        />

        {/* Shared modals rendered at this level */}
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
              // Call the stored onSaved callback from ValuationTable first
              if (editTarget.onSaved) {
                editTarget.onSaved(updated);
              }
              // Then refresh our local data
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
        <RealEstateSearch
          onSearch={(v) => console.log("search:", v)}
          className="mb-6"
        />
        <ValuationStatusStrip counts={statusCounts} className="mb-4" />
        <NewTransactionButton onClick={goNew} className="mb-6" />
      </div>

      <ValuationTable
        className="mt-4"
        onOpenTransaction={goEvaluation}
        // Pass shared modal openers so table rows use them too
        onOpenAttachments={openAttachments}
        onOpenNotes={openNotes}
        onOpenImages={openImages}
        onOpenEdit={openEdit}
        onTransactionMutated={fetchTransactions}
      />

      {/* Shared modals — also available from the list view */}
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
            if (editTarget.onSaved) {
              editTarget.onSaved(updated);
            }
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

// ─── Minimal copy objects for the lifted modals ───────────────────────────────
// These mirror the relevant keys from valuation-table's `copy` constant.
