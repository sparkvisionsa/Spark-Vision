"use client";

import { useContext, useState, useRef, useCallback } from "react";
import { UploadCloud, FileText, X, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";
import type { MvUploadResponse } from "./types";

const copy = {
  en: {
    title: "Import File",
    dragDrop: "Drag & drop your file here, or",
    browse: "browse",
    supported: "Supported: Excel (.xlsx, .xls, .csv), PDF, Word (.docx)",
    uploading: "Uploading and parsing…",
    savingSheets: "Saving sheets on server…",
    error: "Failed to parse file. Please try again.",
    back: "Back",
  },
  ar: {
    title: "استيراد ملف",
    dragDrop: "اسحب وأفلت الملف هنا، أو",
    browse: "تصفح",
    supported: "مدعوم: Excel (.xlsx, .xls, .csv), PDF, Word (.docx)",
    uploading: "جاري الرفع والتحليل…",
    savingSheets: "جاري حفظ الجداول على الخادم…",
    error: "فشل تحليل الملف. حاول مرة أخرى.",
    back: "رجوع",
  },
} as const;

const ACCEPTED =
  ".xlsx,.xls,.csv,.pdf,.doc,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface FileUploadProps {
  projectId: string;
  subProjectId?: string;
  onParsed: (result: MvUploadResponse) => void | Promise<void>;
  onCancel: () => void;
}

export default function FileUpload({
  projectId,
  subProjectId,
  onParsed,
  onCancel,
}: FileUploadProps) {
  const langCtx = useContext(LanguageContext);
  const isArabic = langCtx?.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingSheets, setSavingSheets] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setSelectedFile(file);
      setError("");
      setUploading(true);
      setSavingSheets(false);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);
        formData.append("persist", "1");
        formData.append("sourceFileNameUtf8", file.name);
        if (subProjectId) formData.append("subProjectId", subProjectId);

        const res = await fetch("/api/mv/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!res.ok) throw new Error("upload failed");

        const result = (await res.json()) as MvUploadResponse;
        setUploading(false);
        setSavingSheets(true);
        await Promise.resolve(onParsed(result));
      } catch {
        setError(t.error);
      } finally {
        setUploading(false);
        setSavingSheets(false);
      }
    },
    [projectId, subProjectId, onParsed, t.error]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={onCancel}
        >
          <ArrowLeft className={cn("h-4 w-4 ltr:mr-1 rtl:ml-1", isArabic && "rotate-180")} />
          {t.back}
        </Button>
        <h2 className="text-lg font-semibold text-slate-900">{t.title}</h2>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && !savingSheets && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-all duration-200",
          dragging
            ? "border-emerald-400 bg-emerald-50/60 scale-[1.01]"
            : "border-slate-300 bg-white hover:border-emerald-300 hover:bg-emerald-50/30",
          (uploading || savingSheets) && "pointer-events-none opacity-70"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED}
          onChange={onInputChange}
        />

        {uploading || savingSheets ? (
          <>
            <Loader2 className="h-12 w-12 text-emerald-500 animate-spin" />
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileText className="h-4 w-4" />
                <span className="truncate max-w-[min(100%,280px)]" dir="auto">
                  {selectedFile.name}
                </span>
              </div>
            )}
            <p className="text-sm text-slate-500">
              {savingSheets ? t.savingSheets : t.uploading}
            </p>
          </>
        ) : (
          <>
            <UploadCloud className="h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-600">
              {t.dragDrop}{" "}
              <span className="font-semibold text-emerald-600 hover:underline">
                {t.browse}
              </span>
            </p>
            <p className="text-xs text-slate-400">{t.supported}</p>
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <X className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
