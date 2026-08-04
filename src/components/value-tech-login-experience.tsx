"use client";

import { useEffect, useId, useState } from "react";
import Link from "@/components/prefetch-link";
import { ArrowRight, ChevronDown, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_COUNTRY_DIAL_CODE,
  composeInternationalPhone,
  splitInternationalPhone,
} from "@/lib/auth-phone";
import { cn } from "@/lib/utils";

type ValueTechLoginCardProps = {
  phone: string;
  password: string;
  rememberMe: boolean;
  submitting: boolean;
  error?: string;
  mode?: "screen" | "modal";
  onPhoneChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (value: boolean) => void;
  onSubmit: () => void | Promise<void>;
};

type ValueTechLoginScreenProps = ValueTechLoginCardProps;

const COUNTRY_NAMES_AR: Record<string, string> = {
  SA: "السعودية",
  AE: "الإمارات",
  KW: "الكويت",
  BH: "البحرين",
  QA: "قطر",
  OM: "عمان",
  EG: "مصر",
  JO: "الأردن",
  LB: "لبنان",
  US: "أمريكا",
  GB: "بريطانيا",
  IN: "الهند",
  PK: "باكستان",
};

const FLAG_BY_ISO: Record<string, string> = {
  SA: "🇸🇦",
  AE: "🇦🇪",
  KW: "🇰🇼",
  BH: "🇧🇭",
  QA: "🇶🇦",
  OM: "🇴🇲",
  EG: "🇪🇬",
  JO: "🇯🇴",
  LB: "🇱🇧",
  US: "🇺🇸",
  GB: "🇬🇧",
  IN: "🇮🇳",
  PK: "🇵🇰",
};

function countryName(iso2: string, fallback: string) {
  return COUNTRY_NAMES_AR[iso2] ?? fallback;
}

function ValueTechPhoneField({
  value,
  onChange,
  disabled,
  mode,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  mode: "screen" | "modal";
}) {
  const inputId = useId();
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_DIAL_CODE);
  const [nationalNumber, setNationalNumber] = useState("");

  useEffect(() => {
    const parsed = splitInternationalPhone(value);
    setCountryCode(parsed.countryCode || DEFAULT_COUNTRY_DIAL_CODE);
    setNationalNumber(parsed.nationalNumber);
  }, [value]);

  const selectedCountry =
    COUNTRY_DIAL_CODES.find((country) => country.dialCode === countryCode) ??
    COUNTRY_DIAL_CODES[0];

  const emit = (nextCountryCode: string, nextNationalNumber: string) => {
    onChange(
      composeInternationalPhone(nextCountryCode, nextNationalNumber, {
        allowRawIdentifier: true,
      }),
    );
  };

  return (
    <div className="vt-login-field vt-login-phone-field" dir="rtl">
      <div
        className={cn(
          "relative flex h-full shrink-0 items-center justify-center border-l border-[#d8b46a]/35 px-4",
          mode === "screen" ? "w-[13.8rem]" : "w-[12.6rem]",
        )}
      >
        <div className="pointer-events-none flex min-w-0 items-center gap-2.5 text-[#f5f0e5]">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#2d8b5d] text-[15px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
            {FLAG_BY_ISO[selectedCountry.iso2] ?? "🏳️"}
          </span>
          <span className="truncate text-[15px] font-medium">
            {countryName(selectedCountry.iso2, selectedCountry.nameAr)} {selectedCountry.dialCode}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#f6d184]" aria-hidden />
        </div>
        <select
          aria-label="كود البلد"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={countryCode}
          disabled={disabled}
          onChange={(event) => {
            const nextCountryCode = event.target.value;
            setCountryCode(nextCountryCode);
            emit(nextCountryCode, nationalNumber);
          }}
        >
          {COUNTRY_DIAL_CODES.map((country) => (
            <option key={country.iso2} value={country.dialCode}>
              {countryName(country.iso2, country.nameAr)} {country.dialCode}
            </option>
          ))}
        </select>
      </div>
      <input
        id={inputId}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        className="h-full min-w-0 flex-1 bg-transparent px-7 text-right text-[16px] font-medium text-[#f8efe0] outline-none placeholder:text-[#b7bcc8]"
        placeholder="رقم الهاتف"
        value={nationalNumber}
        disabled={disabled}
        onChange={(event) => {
          const nextNationalNumber = event.target.value;
          setNationalNumber(nextNationalNumber);
          emit(countryCode, nextNationalNumber);
        }}
      />
    </div>
  );
}

function ValueTechPasswordField({
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const inputId = useId();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="vt-login-field relative">
      <input
        id={inputId}
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        autoFocus={autoFocus}
        className="h-full w-full bg-transparent py-0 pl-16 pr-7 text-right text-[16px] font-medium text-[#f8efe0] outline-none placeholder:text-[#b7bcc8]"
        placeholder="كلمة المرور"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="absolute left-5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#f2f4f8] transition hover:bg-white/10 hover:text-[#f7cf82] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c879]/60"
        aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        disabled={disabled}
        onClick={() => setShowPassword((current) => !current)}
      >
        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

export function ValueTechLoginCard({
  phone,
  password,
  rememberMe,
  submitting,
  error,
  mode = "screen",
  onPhoneChange,
  onPasswordChange,
  onRememberMeChange,
  onSubmit,
}: ValueTechLoginCardProps) {
  const compact = mode === "modal";

  return (
    <div
      className={cn(
        "vt-login-card w-full text-center",
        compact
          ? "max-w-[32rem] px-6 pb-7 pt-8 sm:px-8"
          : "min-h-[37.5rem] max-w-[39rem] px-7 pb-8 pt-12 sm:px-10 sm:pt-14",
      )}
      dir="rtl"
    >
      <h1
        className={cn(
          "vt-login-title mx-auto font-extrabold",
          compact ? "text-[1.85rem] leading-[1.25]" : "text-[2.35rem] leading-[1.2]",
        )}
      >
        تسجيل الدخول - فاليو تك
      </h1>
      {/* <p
        className={cn(
          "mx-auto mt-5 max-w-[31rem] text-center font-medium leading-8 text-[#d7dde8]",
          compact ? "text-[14px]" : "text-[16px]",
        )}
      >
        أدخل رقم الهاتف وكلمة المرور الصادرة عن المسؤول
        <br />
        للوصول إلى المنتجات
      </p> */}

      <form
        className={cn("mx-auto w-full max-w-[35rem]", compact ? "mt-6 space-y-4" : "mt-8 space-y-4")}
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <ValueTechPhoneField
          value={phone}
          onChange={onPhoneChange}
          disabled={submitting}
          mode={mode}
        />
        <ValueTechPasswordField
          value={password}
          onChange={onPasswordChange}
          disabled={submitting}
        />

        <label className="flex cursor-pointer select-none items-center gap-3 text-right text-[16px] font-medium text-[#dbe3ef]">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={rememberMe}
            disabled={submitting}
            onChange={(event) => onRememberMeChange(event.target.checked)}
          />
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#f3c976] bg-[#f5c76e] text-[#071326] shadow-[0_0_20px_rgba(245,199,110,0.22)] peer-focus-visible:ring-2 peer-focus-visible:ring-[#f7d693]/70">
            <span className={cn("text-[20px] font-black leading-none", !rememberMe && "opacity-0")}>
              ✓
            </span>
          </span>
          تذكرني على هذا الجهاز
        </label>

        {error ? (
          <p className="rounded-xl border border-rose-300/45 bg-rose-950/45 px-4 py-3 text-sm font-medium leading-6 text-rose-100">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="vt-login-submit group relative flex h-[3.9rem] w-full items-center justify-center overflow-hidden rounded-xl text-[1.4rem] font-extrabold text-white transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffe1a2]/80 disabled:pointer-events-none disabled:opacity-60"
          disabled={submitting || !phone.trim() || !password}
        >
          {submitting ? <Loader2 className="ml-2 h-6 w-6 animate-spin" /> : null}
          دخول
        </button>

        <div className="flex items-center gap-4 pt-2 text-[16px] font-medium text-[#d0d7e4]">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/35 to-white/10" />
          <span>أو</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent via-white/35 to-white/10" />
        </div>

        <button
          type="button"
          className="text-[16px] font-semibold text-[#f2c76d] transition hover:text-[#ffe1a2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c879]/55"
        >
          نسيت كلمة المرور؟
        </button>

        {!compact ? (
          <Link
            href="/"
            className="mx-auto flex w-fit items-center justify-center gap-2 rounded-xl border border-[#d8b46a]/40 bg-[#0b1b31]/70 px-4 py-2.5 text-sm font-bold text-[#f5d083] transition hover:border-[#f5d083]/70 hover:bg-[#132945] hover:text-[#ffe3a6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2c879]/60"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            العودة إلى الصفحة الرئيسية
          </Link>
        ) : null}
      </form>
    </div>
  );
}

export function ValueTechLoginScreen(props: ValueTechLoginScreenProps) {
  return (
    <div className="vt-login-screen fixed inset-0 z-[100] flex items-center justify-center px-4 py-8">
      <div className="vt-login-card-shell relative z-10 flex w-full justify-center">
        <ValueTechLoginCard {...props} mode="screen" />
      </div>
    </div>
  );
}
