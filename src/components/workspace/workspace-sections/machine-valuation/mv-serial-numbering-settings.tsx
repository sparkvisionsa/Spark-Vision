"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { toApiUrl } from "@/lib/api-url";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REFERENCE_NUMBER_PATTERN,
  formatReferenceNumber,
  inspectPrefixLettersInput,
  sanitizePrefixLetters,
  sanitizeReferenceNumberPattern,
  type PrefixLettersIssue,
  type ReferenceNumberPattern,
  type ReferencePrefixKind,
  type ReferenceValueType,
} from "@/lib/mv-serial-numbering";
import { useMvI18n } from "./mv-i18n";

type SerialNumberingPayload = {
  settings?: { referenceNumber?: ReferenceNumberPattern };
  currentCounter?: number;
  nextSequence?: number;
};

const VALUE_TYPES: ReferenceValueType[] = ["numbers", "letters", "mixed"];
const PREFIX_KINDS: ReferencePrefixKind[] = ["letters", "year", "month", "day"];

async function serialApi<T>(url: string, csrfToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(toApiUrl(url), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(body.message || body.error || "تعذر حفظ البيانات. حاول مرة أخرى.");
  }
  return body;
}

function SettingsChoice({
  id,
  label,
  hint,
  value,
  onChange,
  offLabel,
  onLabel,
}: {
  id: string;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  offLabel: string;
  onLabel: string;
}) {
  return (
    <div className="border-t border-slate-100 py-3">
      <p id={`${id}-label`} className="text-[13px] font-medium text-slate-700">
        {label}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</p> : null}
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        dir="ltr"
        className="mt-2 grid max-w-[12.5rem] grid-cols-2 gap-0.5 rounded-lg bg-slate-100 p-0.5"
      >
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          onClick={() => onChange(false)}
          className={cn(
            "h-7 rounded-md text-[11px] font-semibold transition",
            !value
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
              : "text-slate-500 hover:bg-white/60 hover:text-slate-800",
          )}
        >
          {offLabel}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value}
          onClick={() => onChange(true)}
          className={cn(
            "h-7 rounded-md text-[11px] font-semibold transition",
            value
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-white/60 hover:text-slate-800",
          )}
        >
          {onLabel}
        </button>
      </div>
    </div>
  );
}

function SettingsRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-[minmax(9rem,11.5rem)_minmax(0,1fr)] sm:gap-4">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-slate-600">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function MvSerialNumberingSettings() {
  const { t, dir } = useMvI18n();
  const { user, csrfToken, loading } = useAuthTracking();
  const isCompanyAdmin = user?.role === "company_admin";
  const [pattern, setPattern] = useState<ReferenceNumberPattern>(DEFAULT_REFERENCE_NUMBER_PATTERN);
  const [currentCounter, setCurrentCounter] = useState(0);
  const [nextSequence, setNextSequence] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lettersIssue, setLettersIssue] = useState<PrefixLettersIssue | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const payload = await serialApi<SerialNumberingPayload>(
        "/api/company/admin/serial-numbering",
        csrfToken,
      );
      setPattern(sanitizeReferenceNumberPattern(payload.settings?.referenceNumber));
      setCurrentCounter(payload.currentCounter ?? 0);
      setNextSequence(payload.nextSequence ?? 1);
      setLettersIssue(null);
      setLoaded(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t("settingsHub.loadFailed"));
    }
  }, [csrfToken, t]);

  useEffect(() => {
    if (!loading && isCompanyAdmin) void load();
  }, [isCompanyAdmin, load, loading]);

  const previewAt = useMemo(() => new Date(), []);
  const examplePreview = formatReferenceNumber(pattern, 1, previewAt);
  const nextPreview = formatReferenceNumber(pattern, Math.max(1, nextSequence), previewAt);
  const prefixKinds = pattern.prefixKinds ?? [];
  const prefixMissing =
    pattern.hasPrefix && prefixKinds.includes("letters") && !pattern.prefixLetters.trim();
  const prefixKindsMissing = pattern.hasPrefix && prefixKinds.length === 0;

  const prefixLettersError =
    lettersIssue === "arabic"
      ? t("settingsHub.prefixLettersArabic")
      : lettersIssue === "digits"
        ? t("settingsHub.prefixLettersDigits")
        : lettersIssue === "invalid"
          ? t("settingsHub.prefixLettersInvalid")
          : lettersIssue === "tooLong"
            ? t("settingsHub.prefixLettersTooLong")
            : null;

  const updatePattern = (patch: Partial<ReferenceNumberPattern>) => {
    setPattern((current) => sanitizeReferenceNumberPattern({ ...current, ...patch }));
    setStatus(null);
    setSubmitError(null);
  };

  const onPrefixLettersChange = (raw: string) => {
    const issue = inspectPrefixLettersInput(raw);
    setLettersIssue(issue);
    updatePattern({ prefixLetters: sanitizePrefixLetters(raw) });
    if (issue) {
      setSubmitError(
        issue === "arabic"
          ? t("settingsHub.prefixLettersArabic")
          : issue === "digits"
            ? t("settingsHub.prefixLettersDigits")
            : issue === "invalid"
              ? t("settingsHub.prefixLettersInvalid")
              : t("settingsHub.prefixLettersTooLong"),
      );
    }
  };

  const togglePrefixKind = (kind: ReferencePrefixKind) => {
    const selected = new Set(pattern.prefixKinds);
    if (selected.has(kind)) selected.delete(kind);
    else selected.add(kind);
    updatePattern({ prefixKinds: Array.from(selected), hasPrefix: true });
  };

  const save = async () => {
    if (prefixKindsMissing) {
      setSubmitError(t("settingsHub.prefixKindsRequired"));
      return;
    }
    if (prefixMissing) {
      setSubmitError(t("settingsHub.prefixLettersRequired"));
      return;
    }
    if (lettersIssue) {
      setSubmitError(prefixLettersError);
      return;
    }
    setBusy(true);
    setSubmitError(null);
    setStatus(null);
    try {
      const payload = await serialApi<SerialNumberingPayload>(
        "/api/company/admin/serial-numbering",
        csrfToken,
        {
          method: "PATCH",
          body: JSON.stringify({ referenceNumber: pattern }),
        },
      );
      setPattern(sanitizeReferenceNumberPattern(payload.settings?.referenceNumber));
      setCurrentCounter(payload.currentCounter ?? currentCounter);
      setNextSequence(payload.nextSequence ?? nextSequence);
      setStatus(t("settingsHub.saved"));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("settingsHub.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (!loading && !isCompanyAdmin) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4" dir={dir}>
        <p className="text-sm font-medium text-slate-600">{t("settingsHub.adminOnly")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white" dir={dir}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[22px] font-semibold tracking-wide text-slate-950" dir="ltr">
            {loaded ? examplePreview || "—" : "—"}
          </p>
          {loaded ? (
            <p className="mt-0.5 truncate text-[12px] text-slate-500" dir="ltr">
              {nextPreview}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 gap-1.5 rounded-lg bg-[#0C447C] px-3 text-[12px] font-semibold hover:bg-[#0a3a66]"
          disabled={busy || !loaded || Boolean(lettersIssue)}
          onClick={() => void save()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t("settingsHub.save")}
        </Button>
      </div>

      {loadError ? (
        <p className="shrink-0 border-b border-rose-100 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">{loadError}</p>
      ) : null}
      {submitError ? (
        <p className="shrink-0 border-b border-rose-100 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">{submitError}</p>
      ) : null}
      {status ? (
        <p className="shrink-0 border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-[12px] text-emerald-800">
          {status}
        </p>
      ) : null}

      {!loaded && !loadError ? (
        <div className="flex flex-1 items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <SettingsRow label={t("settingsHub.valueType")}>
            <div className="inline-flex max-w-full flex-wrap rounded-lg bg-slate-100 p-0.5">
              {VALUE_TYPES.map((value) => {
                const active = pattern.valueType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updatePattern({ valueType: value })}
                    className={cn(
                      "h-8 rounded-md px-3 text-[12px] font-semibold transition",
                      active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    {t(`settingsHub.valueTypes.${value}`)}
                  </button>
                );
              })}
            </div>
          </SettingsRow>

          <SettingsRow label={t("settingsHub.length")} htmlFor="reference-length">
            <Input
              id="reference-length"
              type="number"
              min={1}
              max={12}
              value={pattern.length}
              onChange={(event) => updatePattern({ length: Number(event.target.value) })}
              className="h-8 w-20 rounded-lg text-left text-[13px] font-semibold tabular-nums"
              dir="ltr"
            />
          </SettingsRow>

          <SettingsChoice
            id="reference-has-prefix"
            label={t("settingsHub.hasPrefix")}
            value={pattern.hasPrefix}
            onChange={(hasPrefix) => updatePattern({ hasPrefix })}
            offLabel={t("settingsHub.off")}
            onLabel={t("settingsHub.on")}
          />

          {pattern.hasPrefix ? (
            <>
            <SettingsRow label={t("settingsHub.prefixKind")}>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {PREFIX_KINDS.map((value) => {
                    const active = prefixKinds.includes(value);
                    return (
                      <label
                        key={value}
                        className={cn(
                          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition",
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => togglePrefixKind(value)}
                          className="sr-only"
                        />
                        <span
                          className={cn(
                            "flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                            active ? "border-white bg-white text-slate-900" : "border-slate-300 bg-white text-transparent",
                          )}
                          aria-hidden
                        >
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                        {t(`settingsHub.prefixKinds.${value}`)}
                      </label>
                    );
                  })}
                </div>
                {prefixKinds.includes("letters") ? (
                  <div className="space-y-1.5">
                    <Input
                      id="reference-prefix-letters"
                      value={pattern.prefixLetters}
                      onChange={(event) => onPrefixLettersChange(event.target.value)}
                      placeholder="SV"
                      className={cn(
                        "h-8 w-28 rounded-lg text-left text-[13px] font-semibold tracking-wide",
                        prefixLettersError && "border-rose-400 ring-2 ring-rose-100 focus-visible:ring-rose-200",
                      )}
                      dir="ltr"
                      aria-invalid={Boolean(prefixLettersError) || undefined}
                      aria-describedby={prefixLettersError ? "reference-prefix-letters-error" : undefined}
                      aria-label={t("settingsHub.prefixLetters")}
                    />
                    {prefixLettersError ? (
                      <p id="reference-prefix-letters-error" className="text-[12px] font-semibold text-rose-700" role="alert">
                        {prefixLettersError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </SettingsRow>
            <SettingsChoice
              id="reference-separate-prefix"
              label={t("settingsHub.separatePrefix")}
              hint={t("settingsHub.separatePrefixHint")}
              value={pattern.separatePrefix}
              onChange={(separatePrefix) => updatePattern({ separatePrefix })}
              offLabel={t("settingsHub.off")}
              onLabel={t("settingsHub.on")}
            />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
