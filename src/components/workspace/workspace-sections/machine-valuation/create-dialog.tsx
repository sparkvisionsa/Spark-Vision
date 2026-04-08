"use client";

import { useContext, useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageContext } from "@/components/layout-provider";
import { Loader2 } from "lucide-react";

const copy = {
  en: {
    createProject: "Create New Project",
    createSub: "Create New Sub-Project",
    projectPlaceholder: "Project name…",
    subPlaceholder: "Sub-project name…",
    projectDesc: "Enter a name for the new project.",
    subDesc: "Enter a name for the new sub-project.",
    ok: "Create",
    cancel: "Cancel",
  },
  ar: {
    createProject: "إنشاء مشروع جديد",
    createSub: "إنشاء مشروع فرعي",
    projectPlaceholder: "اسم المشروع…",
    subPlaceholder: "اسم المشروع الفرعي…",
    projectDesc: "أدخل اسمًا للمشروع الجديد.",
    subDesc: "أدخل اسمًا للمشروع الفرعي الجديد.",
    ok: "إنشاء",
    cancel: "إلغاء",
  },
} as const;

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: "project" | "sub-project";
  loading?: boolean;
  onSubmit: (name: string) => void;
}

export default function CreateDialog({
  open,
  onOpenChange,
  variant,
  loading,
  onSubmit,
}: CreateDialogProps) {
  const langCtx = useContext(LanguageContext);
  const isArabic = langCtx?.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const title = variant === "project" ? t.createProject : t.createSub;
  const desc = variant === "project" ? t.projectDesc : t.subDesc;
  const placeholder =
    variant === "project" ? t.projectPlaceholder : t.subPlaceholder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-4"
        >
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            className="rounded-xl h-11"
            dir="auto"
            disabled={loading}
          />

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t.cancel}
            </Button>
            <Button
              type="submit"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white min-w-[90px]"
              disabled={!name.trim() || loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t.ok
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
