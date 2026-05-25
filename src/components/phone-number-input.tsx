"use client";

import { useEffect, useState } from "react";
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_COUNTRY_DIAL_CODE,
  composeInternationalPhone,
  splitInternationalPhone,
} from "@/lib/auth-phone";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PhoneNumberInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
  inputClassName?: string;
  selectClassName?: string;
  allowRawIdentifier?: boolean;
};

export function PhoneNumberInput({
  id,
  value,
  onChange,
  disabled,
  placeholder = "5XXXXXXXX",
  autoComplete = "tel",
  className,
  inputClassName,
  selectClassName,
  allowRawIdentifier = false,
}: PhoneNumberInputProps) {
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_DIAL_CODE);
  const [nationalNumber, setNationalNumber] = useState("");

  useEffect(() => {
    if (!value.trim()) {
      setNationalNumber("");
      return;
    }
    const parsed = splitInternationalPhone(value);
    setCountryCode(parsed.countryCode || DEFAULT_COUNTRY_DIAL_CODE);
    setNationalNumber(parsed.nationalNumber);
  }, [value]);

  const emit = (nextCountryCode: string, nextNationalNumber: string) => {
    onChange(
      composeInternationalPhone(nextCountryCode, nextNationalNumber, {
        allowRawIdentifier,
      })
    );
  };

  return (
    <div className={cn("flex gap-2", className)} dir="ltr">
      <Select
        value={countryCode}
        onValueChange={(next) => {
          setCountryCode(next);
          emit(next, nationalNumber);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn("h-10 w-[9.25rem] shrink-0 rounded-xl", selectClassName)}
          aria-label="كود البلد"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[980]" dir="rtl">
          {COUNTRY_DIAL_CODES.map((country) => (
            <SelectItem key={country.iso2} value={country.dialCode}>
              {country.nameAr} {country.dialCode}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        value={nationalNumber}
        onChange={(event) => {
          const next = event.target.value;
          setNationalNumber(next);
          emit(countryCode, next);
        }}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        dir="ltr"
        className={cn("h-10 min-w-0 flex-1 rounded-xl text-left", inputClassName)}
      />
    </div>
  );
}
